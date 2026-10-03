import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchEndReason, MatchMode, MatchStatus, MatchWinner, Side, UserRole } from '../../common/enums';
import { GameService } from '../game/game.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { JoinMatchDto } from './dto/join-match.dto';
import { MatchesQueryDto } from './dto/matches-query.dto';
import { MatchClock, ClockView, DEFAULT_TIME_CONTROL, TimeControl } from './entities/match-clock.entity';
import { RatingsService } from '../ratings/ratings.service';
import { SpectatorTeamDto } from './dto/spectator-team.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchPlayer } from './entities/match-player.entity';
import { MatchSpectator } from './entities/match-spectator.entity';
import { Match } from './entities/match.entity';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(MatchPlayer) private readonly players: Repository<MatchPlayer>,
    @InjectRepository(MatchSpectator)
    private readonly spectators: Repository<MatchSpectator>,
    @InjectRepository(MatchClock)
    private readonly clocks: Repository<MatchClock>,
    private readonly ratings: RatingsService,
    @Inject(forwardRef(() => GameService))
    private readonly game: GameService,
  ) {}

  /** Tạo match — người tạo ngồi ghế RED. */
  async create(creatorId: string, dto: CreateMatchDto): Promise<Match> {
    const match = await this.matches.save(
      this.matches.create({
        mode: dto.mode ?? MatchMode.CASUAL,
        status: MatchStatus.WAITING,
        redPlayerId: creatorId,
        blackPlayerId: null,
        ruleSet: {
          ...(dto.ruleSet ?? {}),
          ...(dto.clock ? { timeControl: { initialMs: dto.clock.initialMs, incrementMs: dto.clock.incrementMs } } : {}),
        },
      }),
    );
    await this.players.save(
      this.players.create({ matchId: match.id, userId: creatorId, color: Side.RED }),
    );
    return match;
  }

  findAll(query: MatchesQueryDto): Promise<Match[]> {
    return this.matches.find({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.mode ? { mode: query.mode } : {}),
      },
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Match> {
    const match = await this.matches.findOneBy({ id });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  /** Join ghế trống (ưu tiên màu yêu cầu). Đủ 2 người → READY. */
  async join(userId: string, matchId: string, dto: JoinMatchDto): Promise<MatchPlayer> {
    const match = await this.findOne(matchId);
    // Reconnect: player cũ luôn lấy lại được ghế của mình.
    const existing = await this.players.findOneBy({ matchId, userId });
    if (existing) {
      existing.leftAt = null;
      return this.players.save(existing);
    }
    if (match.status === MatchStatus.FINISHED) {
      throw new ConflictException('Match already finished');
    }
    if (match.status === MatchStatus.PLAYING) {
      throw new ConflictException('Match already in progress');
    }

    const taken = new Set(
      (await this.players.findBy({ matchId })).map((p) => p.color),
    );
    const color =
      dto.color && !taken.has(dto.color)
        ? dto.color
        : ([Side.RED, Side.BLACK] as const).find((c) => !taken.has(c));
    if (!color) throw new ConflictException('Match is full');

    const player = await this.players.save(
      this.players.create({ matchId, userId, color, joinedAt: new Date() }),
    );
    if (color === Side.RED) match.redPlayerId = userId;
    else match.blackPlayerId = userId;
    if (match.redPlayerId && match.blackPlayerId && match.status === MatchStatus.WAITING) {
      match.status = MatchStatus.READY;
    }
    await this.matches.save(match);
    return player;
  }

  async leave(userId: string, matchId: string): Promise<void> {
    const player = await this.players.findOneBy({ matchId, userId });
    if (!player) throw new NotFoundException('Not a player of this match');
    player.leftAt = new Date();
    await this.players.save(player);
    const match = await this.findOne(matchId);
    if (match.status === MatchStatus.READY) {
      match.status = MatchStatus.WAITING;
      await this.matches.save(match);
    }
  }

  /** Báo sẵn sàng. Cả 2 ready → PLAYING + tạo bàn cờ khai cuộc. */
  async setReady(userId: string, matchId: string): Promise<Match> {
    const player = await this.players.findOneBy({ matchId, userId });
    if (!player) throw new NotFoundException('Not a player of this match');
    player.isReady = true;
    await this.players.save(player);
    const match = await this.findOne(matchId);
    const all = await this.players.findBy({ matchId });
    if (all.length === 2 && all.every((p) => p.isReady) && match.status === MatchStatus.READY) {
      match.status = MatchStatus.PLAYING;
      match.startedAt = new Date();
      await this.matches.save(match);
      await this.ensureClock(matchId);
      await this.game.ensureState(matchId);
      await this.game.setStateStatus(matchId, MatchStatus.PLAYING);
    }
    return match;
  }

  /** Kết thúc match — dùng chung cho resign/timeout/draw/disconnect/forfeit/checkmate. */
  async finish(
    matchId: string,
    winner: MatchWinner,
    endReason: MatchEndReason,
  ): Promise<Match> {
    const match = await this.findOne(matchId);
    if (match.status === MatchStatus.FINISHED) return match;
    match.winner = winner;
    match.endReason = endReason;
    match.status = MatchStatus.FINISHED;
    match.endedAt = new Date();
    const finished = await this.matches.save(match);
    await this.stopClock(matchId);
    await this.game.setStateStatus(matchId, MatchStatus.FINISHED);
    // Chỉ RANKED mới động vào COMPETITIVE rating (CASUAL/CROWD không xếp hạng).
    if (match.mode === MatchMode.RANKED && match.redPlayerId && match.blackPlayerId) {
      await this.ratings.applyRankedResult(matchId, match.redPlayerId, match.blackPlayerId, winner);
    }
    return finished;
  }

  /** Đầu hàng — đối thủ thắng, match FINISHED. */
  async resign(userId: string, matchId: string): Promise<Match> {
    const match = await this.findOne(matchId);
    if (match.status !== MatchStatus.PLAYING && match.status !== MatchStatus.READY) {
      throw new ConflictException('Match is not in progress');
    }
    if (userId !== match.redPlayerId && userId !== match.blackPlayerId) {
      throw new ForbiddenException('Only players can resign');
    }
    return this.finish(
      matchId,
      userId === match.redPlayerId ? MatchWinner.BLACK : MatchWinner.RED,
      MatchEndReason.RESIGN,
    );
  }

  async update(
    userId: string,
    role: UserRole,
    matchId: string,
    dto: UpdateMatchDto,
  ): Promise<Match> {
    const match = await this.findOne(matchId);
    const isParticipant = userId === match.redPlayerId || userId === match.blackPlayerId;
    if (!isParticipant && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only participants or admin can update match');
    }
    if (dto.status !== undefined && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can force status');
    }
    Object.assign(match, dto);
    return this.matches.save(match);
  }

  /** Xóa match — admin only (check ở controller). */
  async remove(matchId: string): Promise<void> {
    await this.findOne(matchId);
    await this.matches.delete(matchId);
  }

  findPlayers(matchId: string): Promise<MatchPlayer[]> {
    return this.players.findBy({ matchId });
  }

  findSpectators(matchId: string): Promise<MatchSpectator[]> {
    return this.spectators.findBy({ matchId });
  }

  async joinSpectators(
    userId: string,
    matchId: string,
    dto: SpectatorTeamDto,
  ): Promise<MatchSpectator> {
    await this.findOne(matchId);
    const existing = await this.spectators.findOneBy({ matchId, userId });
    if (existing) {
      existing.team = dto.team;
      return this.spectators.save(existing);
    }
    return this.spectators.save(
      this.spectators.create({ matchId, userId, team: dto.team }),
    );
  }

  async leaveSpectators(userId: string, matchId: string): Promise<void> {
    await this.spectators.delete({ matchId, userId });
  }

  // ---------------------------------------------------------------- Clock

  private timeControlOf(match: Match): TimeControl {
    const tc = (match.ruleSet as { timeControl?: unknown } | null)?.timeControl as
      | TimeControl
      | undefined;
    if (
      tc &&
      Number.isFinite(tc.initialMs) &&
      Number.isFinite(tc.incrementMs) &&
      tc.initialMs > 0 &&
      tc.incrementMs >= 0
    ) {
      return { initialMs: Math.floor(tc.initialMs), incrementMs: Math.floor(tc.incrementMs) };
    }
    return { ...DEFAULT_TIME_CONTROL };
  }

  /** Tạo đồng hồ khi match bắt đầu (đỏ đi trước, tính từ startedAt). */
  async ensureClock(matchId: string): Promise<MatchClock> {
    const existing = await this.clocks.findOneBy({ matchId });
    if (existing) return existing;
    const match = await this.findOne(matchId);
    const tc = this.timeControlOf(match);
    return this.clocks.save(
      this.clocks.create({
        matchId,
        redMs: tc.initialMs,
        blackMs: tc.initialMs,
        incrementMs: tc.incrementMs,
        activeColor: Side.RED,
        lastTickAt: match.startedAt ?? new Date(),
      }),
    );
  }

  private toView(row: MatchClock, now: Date): ClockView {
    let redMs = row.redMs;
    let blackMs = row.blackMs;
    if (row.activeColor && row.lastTickAt) {
      const elapsed = Math.max(0, now.getTime() - row.lastTickAt.getTime());
      if (row.activeColor === Side.RED) redMs = Math.max(0, redMs - elapsed);
      else blackMs = Math.max(0, blackMs - elapsed);
    }
    return { redMs, blackMs, incrementMs: row.incrementMs, activeColor: row.activeColor, serverTime: now.toISOString() };
  }

  /** View đồng hồ với giờ server hiện tại (null nếu match chưa bắt đầu). */
  async getClockView(matchId: string): Promise<ClockView | null> {
    const row = await this.clocks.findOneBy({ matchId });
    if (!row) return null;
    return this.toView(row, new Date());
  }

  /**
   * Kiểm tra hết giờ (không ghi gì). Hết giờ → finish TIMEOUT ngay.
   * Gọi TRƯỚC khi validate nước đi.
   */
  async checkFlag(matchId: string, mover: Side): Promise<{ flagged: boolean }> {
    const row = await this.clocks.findOneBy({ matchId });
    if (!row || !row.activeColor || !row.lastTickAt) return { flagged: false };
    if (row.activeColor !== mover) return { flagged: false };
    const elapsed = Math.max(0, Date.now() - row.lastTickAt.getTime());
    const left = (mover === Side.RED ? row.redMs : row.blackMs) - elapsed;
    if (left <= 0) {
      await this.finish(
        matchId,
        mover === Side.RED ? MatchWinner.BLACK : MatchWinner.RED,
        MatchEndReason.TIMEOUT,
      );
      return { flagged: true };
    }
    return { flagged: false };
  }

  /**
   * Chốt đồng hồ sau nước đi hợp lệ: trừ giờ đã nghĩ + cộng increment + chuyển lượt.
   * Gọi SAU khi move đã persist thành công.
   */
  async commitMoveClock(matchId: string, mover: Side): Promise<ClockView | null> {
    const row = await this.clocks.findOneBy({ matchId });
    if (!row) return null;
    const now = new Date();
    if (row.activeColor === mover && row.lastTickAt) {
      const elapsed = Math.max(0, now.getTime() - row.lastTickAt.getTime());
      const left = Math.max(0, (mover === Side.RED ? row.redMs : row.blackMs) - elapsed);
      if (mover === Side.RED) row.redMs = left + row.incrementMs;
      else row.blackMs = left + row.incrementMs;
    }
    row.activeColor = mover === Side.RED ? Side.BLACK : Side.RED;
    row.lastTickAt = now;
    await this.clocks.save(row);
    return this.toView(row, now);
  }

  async stopClock(matchId: string): Promise<void> {
    await this.clocks.update({ matchId }, { activeColor: null });
  }

  /** Quét các match PLAYING bị hết giờ (gọi định kỳ từ Gateway). */
  async sweepTimeouts(): Promise<
    Array<{ matchId: string; winner: MatchWinner; endReason: MatchEndReason }>
  > {
    const playing = await this.matches.find({
      where: { status: MatchStatus.PLAYING },
      select: { id: true },
    });
    if (playing.length === 0) return [];
    const out: Array<{ matchId: string; winner: MatchWinner; endReason: MatchEndReason }> = [];
    const now = new Date();
    for (const m of playing) {
      const row = await this.clocks.findOneBy({ matchId: m.id });
      if (!row || !row.activeColor || !row.lastTickAt) continue;
      const elapsed = now.getTime() - row.lastTickAt.getTime();
      const left = (row.activeColor === Side.RED ? row.redMs : row.blackMs) - elapsed;
      if (left <= 0) {
        const winner = row.activeColor === Side.RED ? MatchWinner.BLACK : MatchWinner.RED;
        await this.finish(m.id, winner, MatchEndReason.TIMEOUT);
        out.push({ matchId: m.id, winner, endReason: MatchEndReason.TIMEOUT });
      }
    }
    return out;
  }
}
