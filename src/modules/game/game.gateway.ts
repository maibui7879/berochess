import {
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  applyMove,
  boardToFenPart,
  isInCheck,
  validateMove,
} from 'xiangqi-engine';
import type { GameResultReason } from 'xiangqi-engine';
import { Public } from '../../common/decorators/public.decorator';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard';
import { MatchEndReason, MatchStatus, MatchWinner, Side } from '../../common/enums';
import { MatchesService } from '../matches/matches.service';
import { WsMatchJoinDto, WsMoveRequestDto, WsReadyDto } from './dto/ws-move.dto';
import { GameService } from './game.service';

interface GatewayUser {
  userId: string;
  username: string;
  role: string;
}

type AuthedSocket = Socket & {
  data: { user?: GatewayUser; matches?: Set<string> };
};

const roomOf = (matchId: string) => `match:${matchId}`;
const WS_PIPE = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

function toDbFen(board: Parameters<typeof boardToFenPart>[0], turn: Side): string {
  return `${boardToFenPart(board)} ${turn === Side.RED ? 'w' : 'b'} - - 0 1`;
}

/**
 * Realtime game gateway (namespace /game).
 * Server-authoritative: client chỉ gửi ý định, mọi board truth do engine + DB quyết định.
 */
@Public()
@UseGuards(WsAuthGuard)
@WebSocketGateway({ namespace: '/game', cors: { origin: true, credentials: true } })
export class GameGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly game: GameService,
    @Inject(forwardRef(() => MatchesService))
    private readonly matches: MatchesService,
  ) {}

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

  @UsePipes(WS_PIPE)
  @SubscribeMessage('match:join')
  async handleJoin(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: WsMatchJoinDto) {
    try {
      const { userId } = this.userOf(client);
      const match = await this.matches.findOne(dto.matchId);
      const players = await this.matches.findPlayers(dto.matchId);
      const state = await this.game.findState(dto.matchId);
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
        state,
        myColor,
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
  async handleReady(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: WsReadyDto) {
    try {
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
  @SubscribeMessage('move:request')
  async handleMove(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: WsMoveRequestDto) {
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

      // 7-8. Broadcast + kết thúc match nếu engine đã over.
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
        result: next.result,
        state,
      };
      this.server.to(roomOf(dto.matchId)).emit('move:played', payload);

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

  handleDisconnect(client: AuthedSocket): void {
    const userId = client.data.user?.userId;
    if (!userId || !client.data.matches) return;
    for (const matchId of client.data.matches) {
      this.server
        .to(roomOf(matchId))
        .emit('player:disconnected', { matchId, userId });
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
