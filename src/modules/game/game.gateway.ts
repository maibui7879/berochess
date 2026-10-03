import {
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
  UseGuards,
  UsePipes,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Interval } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import {
  applyMove,
  isInCheck,
  validateMove,
} from 'xiangqi-engine';
import type { GameResultReason } from 'xiangqi-engine';
import { Public } from '../../common/decorators/public.decorator';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard';
import { WS_VALIDATION_PIPE, withWsJwt } from '../../common/ws/ws-utils';
import { COMMENTARY_CREATED, CommentaryCreatedPayload } from '../../common/events';
import { MetricsService } from '../../observability/metrics.service';
import { MatchEndReason, MatchStatus, MatchWinner, Side } from '../../common/enums';
import { MatchesService } from '../matches/matches.service';
import { WsMatchJoinDto, WsMoveRequestDto, WsReadyDto, WsSpectatorTeamDto } from './dto/ws-move.dto';
import { GameService, toDbFen } from './game.service';

interface GatewayUser {
  userId: string;
  username: string;
  role: string;
}

type AuthedSocket = Socket & {
  data: { user?: GatewayUser; matches?: Set<string> };
};

const roomOf = (matchId: string) => `match:${matchId}`;
const WS_PIPE = WS_VALIDATION_PIPE;

/**
 * Realtime game gateway (namespace /game).
 * Server-authoritative: client chỉ gửi ý định, mọi board truth do engine + DB quyết định.
 */
@Public()
@UseGuards(WsAuthGuard)
@WebSocketGateway({ namespace: '/game', cors: { origin: true, credentials: true } })
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(GameGateway.name);
  /** Mutex theo matchId: serialize mọi move:request, chống double-move khi race. */
  private readonly moveLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly game: GameService,
    @Inject(forwardRef(() => MatchesService))
    private readonly matches: MatchesService,
    private readonly jwt: JwtService,
    private readonly metrics: MetricsService,
  ) {}

  /** Chặn ngay tại handshake: socket không JWT hợp lệ thì connect_error. */
  afterInit(server: Server): void {
    withWsJwt(this.jwt, server);
  }

  private userOf(client: AuthedSocket): GatewayUser {
    const user = client.data.user;
    if (!user) throw new ForbiddenException('Unauthenticated socket');
    return user;
  }

  private track(client: AuthedSocket, matchId: string): void {
    if (!client.data.matches) client.data.matches = new Set();
    client.data.matches.add(matchId);
  }

  private untrack(client: AuthedSocket, matchId: string): void {
    client.data.matches?.delete(matchId);
  }

  private err(reason: string): { ok: false; reason: string } {
    return { ok: false, reason };
  }

  /** Chạy fn sau khi lock theo matchId xong (FIFO). Lock tự giải phóng. */
  private async withMatchLock<T>(matchId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.moveLocks.get(matchId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.moveLocks.set(matchId, prev.then(() => current));
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.moveLocks.get(matchId) === current) this.moveLocks.delete(matchId);
    }
  }

  @UsePipes(WS_PIPE)
  @SubscribeMessage('match:join')
  async handleJoin(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: WsMatchJoinDto) {
    try {
      const { userId } = this.userOf(client);
      const match = await this.matches.findOne(dto.matchId);
      const players = await this.matches.findPlayers(dto.matchId);
      const spectators = await this.matches.findSpectators(dto.matchId);
      const state = await this.game.findState(dto.matchId);
      const clock = await this.matches.getClockView(dto.matchId);
      const room = roomOf(dto.matchId);
      await client.join(room);
      this.track(client, dto.matchId);
      const myColor =
        match.redPlayerId === userId
          ? Side.RED
          : match.blackPlayerId === userId
            ? Side.BLACK
            : null;
      client.broadcast.to(room).emit('player:joined', {
        matchId: dto.matchId,
        userId,
        color: myColor,
      });
      return {
        ok: true,
        match,
        players,
        spectators,
        state,
        clock,
        myColor,
        myTeam: spectators.find((s) => s.userId === userId)?.team ?? null,
      };
    } catch (e) {
      return this.err(e instanceof NotFoundException ? 'MATCH_NOT_FOUND' : 'JOIN_FAILED');
    }
  }

  @UsePipes(WS_PIPE)
  @SubscribeMessage('match:leave')
  async handleLeave(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: WsMatchJoinDto) {
    const { userId } = this.userOf(client);
    await client.leave(roomOf(dto.matchId));
    this.untrack(client, dto.matchId);
    this.server.to(roomOf(dto.matchId)).emit('player:left', { matchId: dto.matchId, userId });
    return { ok: true };
  }

  @UsePipes(WS_PIPE)
  @SubscribeMessage('player:ready')
  async handleReady(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: WsReadyDto) {    try {
      const { userId } = this.userOf(client);
      const match = await this.matches.setReady(userId, dto.matchId);
      this.server.to(roomOf(dto.matchId)).emit('player:ready', {
        matchId: dto.matchId,
        userId,
        status: match.status,
      });
      if (match.status === MatchStatus.PLAYING) {
        const state = await this.game.findState(dto.matchId);
        this.server.to(roomOf(dto.matchId)).emit('game:state', { matchId: dto.matchId, state });
      }
      return { ok: true, status: match.status };
    } catch (e) {
      if (e instanceof NotFoundException) return this.err('MATCH_NOT_FOUND');
      return this.err('READY_FAILED');
    }
  }

  @UsePipes(WS_PIPE)
  @SubscribeMessage('spectator:team')
  async handleSpectatorTeam(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() dto: WsSpectatorTeamDto,
  ) {
    try {
      const { userId } = this.userOf(client);
      const spec = await this.matches.joinSpectators(userId, dto.matchId, { team: dto.team });
      this.server.to(roomOf(dto.matchId)).emit('spectator:team-changed', {
        matchId: dto.matchId,
        userId,
        team: spec.team,
      });
      return { ok: true, team: spec.team };
    } catch (e) {
      if (e instanceof NotFoundException) return this.err('MATCH_NOT_FOUND');
      return this.err('SPECTATOR_FAILED');
    }
  }

  @UsePipes(WS_PIPE)
  @SubscribeMessage('spectator:leave')
  async handleSpectatorLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() dto: WsMatchJoinDto,
  ) {
    const { userId } = this.userOf(client);
    await this.matches.leaveSpectators(userId, dto.matchId);
    this.server.to(roomOf(dto.matchId)).emit('spectator:left', { matchId: dto.matchId, userId });
    return { ok: true };
  }

  @UsePipes(WS_PIPE)
  @SubscribeMessage('move:request')
  async handleMove(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: WsMoveRequestDto) {
    // Serialize theo match: 2 request đồng thời không thể cùng qua turn-check.
    return this.withMatchLock(dto.matchId, () => this.applyMove(client, dto));
  }

  private async applyMove(client: AuthedSocket, dto: WsMoveRequestDto) {
    try {
      const { userId } = this.userOf(client);
      // 1-3. Match tồn tại + đang PLAYING + đúng player.
      const match = await this.matches.findOne(dto.matchId);
      if (match.status !== MatchStatus.PLAYING) return this.err('MATCH_NOT_PLAYING');
      const color =
        match.redPlayerId === userId
          ? Side.RED
          : match.blackPlayerId === userId
            ? Side.BLACK
            : null;
      if (!color) return this.err('NOT_A_PLAYER');

      // 3b. Đồng hồ server-time: hết giờ thì thua ngay (không ghi gì nếu còn giờ).
      const { flagged } = await this.matches.checkFlag(dto.matchId, color);
      if (flagged) return this.err('TIME_FLAGGED');

      // 4-5. Dựng engine từ replay + verify turn + validate nước đi.
      const engine = await this.game.loadEngineState(dto.matchId);
      if (!engine) return this.err('NO_STATE');
      if (engine.turn !== color) return this.err('NOT_YOUR_TURN');
      const checked = validateMove(engine, dto.from, dto.to);
      if (!checked.ok) return this.err(checked.reason);

      // 6. Apply + persist transaction.
      const next = applyMove(engine, dto.from, dto.to);
      const captured = engine.board[checked.move.to.rank][checked.move.to.file]?.type ?? null;
      const status = next.result.over ? MatchStatus.FINISHED : MatchStatus.PLAYING;
      const { move, state } = await this.game.applyMoveResult({
        matchId: dto.matchId,
        playerId: userId,
        from: dto.from,
        to: dto.to,
        capturedPiece: captured,
        boardFen: toDbFen(next.board, next.turn as Side),
        turn: next.turn as Side,
        status,
      });

      // 7-8. Chốt đồng hồ (trừ giờ + increment) + broadcast + kết thúc nếu over.
      const clock = await this.matches.commitMoveClock(dto.matchId, color);
      const check = !next.result.over && isInCheck(next.board, next.turn);
      const payload = {
        matchId: dto.matchId,
        moveNumber: move.moveNumber,
        playerId: userId,
        color,
        from: dto.from,
        to: dto.to,
        capturedPiece: captured,
        fen: toDbFen(next.board, next.turn as Side),
        turn: next.turn,
        check,
        clock,
        result: next.result,
        state,
      };
      this.server.to(roomOf(dto.matchId)).emit('move:played', payload);
      this.metrics.moves.inc({ color });

      if (next.result.over) {
        const { winner, endReason } = this.mapResult(next.result.reason, next.turn as Side);
        const finished = await this.matches.finish(dto.matchId, winner, endReason);
        this.server.to(roomOf(dto.matchId)).emit('game:ended', {
          matchId: dto.matchId,
          winner: finished.winner,
          endReason: finished.endReason,
          result: next.result,
        });
      }
      return { ok: true, moveNumber: move.moveNumber, check, result: next.result };
    } catch (e) {
      this.logger.warn(`move:request failed: ${(e as Error).message}`);
      if (e instanceof NotFoundException) return this.err('MATCH_NOT_FOUND');
      if (e instanceof ConflictException) return this.err('CONFLICT');
      if (e instanceof ForbiddenException) return this.err('FORBIDDEN');
      return this.err('MOVE_FAILED');
    }
  }

  handleConnection(): void {
    this.metrics.wsConnections.inc({ gateway: 'game' });
  }

  handleDisconnect(client: AuthedSocket): void {
    this.metrics.wsConnections.dec({ gateway: 'game' });
    const userId = client.data.user?.userId;
    if (!userId || !client.data.matches) return;
    for (const matchId of client.data.matches) {
      this.server
        .to(roomOf(matchId))
        .emit('player:disconnected', { matchId, userId });
    }
  }

  /** Bình luận mới -> đẩy realtime về room của match. */
  @OnEvent(COMMENTARY_CREATED)
  handleCommentaryCreated(payload: CommentaryCreatedPayload): void {
    this.server
      .to(roomOf(payload.matchId))
      .emit('commentary:new', { matchId: payload.matchId, commentary: payload.commentary });
  }

  /** Quét hết giờ mỗi 5s (server-time). Match nào flag thì broadcast game:ended. */
  @Interval(5000)
  async handleTimeoutSweep(): Promise<void> {    try {
      const timedOut = await this.matches.sweepTimeouts();
      for (const t of timedOut) {
        this.server.to(roomOf(t.matchId)).emit('game:ended', {
          matchId: t.matchId,
          winner: t.winner,
          endReason: t.endReason,
          result: { over: true, winner: t.winner, reason: 'TIMEOUT' },
        });
      }
    } catch (e) {
      this.logger.warn(`timeout sweep failed: ${(e as Error).message}`);
    }
  }

  /** Bên chiếu hết / ăn tướng = đối thủ của side đang tới lượt (bên bị hết cờ). */
  private mapResult(
    reason: GameResultReason | undefined,
    turn: Side,
  ): { winner: MatchWinner; endReason: MatchEndReason } {
    if (reason === 'CHECKMATE' || reason === 'KING_CAPTURED') {
      return {
        winner: turn === Side.RED ? MatchWinner.BLACK : MatchWinner.RED,
        endReason: MatchEndReason.CHECKMATE,
      };
    }
    return { winner: MatchWinner.DRAW, endReason: MatchEndReason.DRAW };
  }
}
