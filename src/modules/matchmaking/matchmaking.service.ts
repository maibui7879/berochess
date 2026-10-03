import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Redis } from 'ioredis';
import { MatchMode, RatingType, Side } from '../../common/enums';
import { MetricsService } from '../../observability/metrics.service';
import { TimeControlDto } from '../matches/dto/time-control.dto';
import { MatchesService } from '../matches/matches.service';
import { RatingsService } from '../ratings/ratings.service';
import { JoinQueueDto } from './dto/join-queue.dto';

/**
 * Matchmaking theo rating (Redis sorted set).
 * Keys: mm:queue:{MODE} (ZSET userId->rating), mm:meta:{userId} (HASH),
 * mm:result:{userId} (STRING matchId, TTL 5 phút), mm:lock:{MODE} (ghép cặp).
 */
@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    @Inject('REDIS') private readonly redis: Redis,
    private readonly matches: MatchesService,
    private readonly ratings: RatingsService,
    private readonly metrics: MetricsService,
  ) {}

  private queueKey(mode: MatchMode): string {
    return `mm:queue:${mode}`;
  }

  private metaKey(userId: string): string {
    return `mm:meta:${userId}`;
  }

  private resultKey(userId: string): string {
    return `mm:result:${userId}`;
  }

  private lockKey(mode: MatchMode): string {
    return `mm:lock:${mode}`;
  }

  /** Cửa sổ rating mở rộng theo thời gian chờ: 200 + 100/10s, tối đa 1000. */
  private windowFor(waitedMs: number): number {
    return Math.min(200 + Math.floor(Math.max(0, waitedMs) / 10_000) * 100, 1000);
  }

  async join(
    userId: string,
    dto: JoinQueueDto,
  ): Promise<{ status: 'waiting' | 'matched'; matchId?: string; waitedMs?: number }> {
    if (dto.mode !== MatchMode.RANKED && dto.mode !== MatchMode.CASUAL) {
      throw new BadRequestException('Only RANKED and CASUAL queues are supported');
    }
    const pending = await this.redis.get(this.resultKey(userId));
    if (pending) return { status: 'matched', matchId: pending };
    const meta = await this.redis.hgetall(this.metaKey(userId));
    if (meta && meta.mode) {
      if (meta.mode !== dto.mode) await this.leave(userId);
      else return { status: 'waiting', waitedMs: Date.now() - Number(meta.joinedAt || Date.now()) };
    }
    if (await this.matches.hasActiveMatch(userId)) {
      throw new ConflictException('ALREADY_IN_MATCH');
    }
    const rating =
      dto.mode === MatchMode.RANKED
        ? (await this.ratings.ensureRating(userId, RatingType.COMPETITIVE)).rating
        : 1500;
    const now = Date.now();
    const pipeline = this.redis.pipeline();
    pipeline.zadd(this.queueKey(dto.mode), rating.toString(), userId);
    pipeline.hset(this.metaKey(userId), {
      mode: dto.mode,
      joinedAt: String(now),
      timeControl: JSON.stringify(dto.clock ?? {}),
    });
    pipeline.expire(this.metaKey(userId), 3600);
    await pipeline.exec();

    const matchId = await this.tryPair(dto.mode, userId, rating, this.windowFor(0), dto.clock);
    if (matchId) return { status: 'matched', matchId };
    return { status: 'waiting', waitedMs: 0 };
  }

  async status(userId: string): Promise<
    | { status: 'idle' }
    | { status: 'waiting'; waitedMs: number; position: number | null }
    | { status: 'matched'; matchId: string }
  > {
    const pending = await this.redis.get(this.resultKey(userId));
    if (pending) {
      await this.redis.del(this.resultKey(userId));
      return { status: 'matched', matchId: pending };
    }
    const meta = await this.redis.hgetall(this.metaKey(userId));
    if (!meta || !meta.mode) return { status: 'idle' };
    const mode = meta.mode as MatchMode;
    const waitedMs = Date.now() - Number(meta.joinedAt || Date.now());
    const rating =
      mode === MatchMode.RANKED
        ? (await this.ratings.ensureRating(userId, RatingType.COMPETITIVE)).rating
        : 1500;
    // Thử ghép lại mỗi lần poll — cửa sổ đã mở rộng theo thời gian chờ.
    const matchId = await this.tryPair(mode, userId, rating, this.windowFor(waitedMs), this.parseClock(meta.timeControl));
    if (matchId) return { status: 'matched', matchId };
    const rank = await this.redis.zrevrank(this.queueKey(mode), userId);
    return { status: 'waiting', waitedMs, position: rank === null ? null : rank + 1 };
  }

  async leave(userId: string): Promise<{ left: true }> {
    const pipeline = this.redis.pipeline();
    pipeline.zrem(this.queueKey(MatchMode.RANKED), userId);
    pipeline.zrem(this.queueKey(MatchMode.CASUAL), userId);
    pipeline.del(this.metaKey(userId));
    pipeline.del(this.resultKey(userId));
    await pipeline.exec();
    return { left: true };
  }

  private parseClock(raw: string | undefined): TimeControlDto | undefined {
    try {
      const parsed = JSON.parse(raw ?? '{}') as Partial<TimeControlDto>;
      if (Number.isFinite(parsed.initialMs) && Number.isFinite(parsed.incrementMs)) {
        return { initialMs: parsed.initialMs as number, incrementMs: parsed.incrementMs as number };
      }
    } catch {
      // clock hỏng -> dùng mặc định
    }
    return undefined;
  }

  /**
   * Tìm đối thủ gần rating nhất trong cửa sổ rồi tạo match.
   * Serialize bằng Redis lock theo mode để 2 cặp ghép đồng thời không chồng nhau.
   */
  private async tryPair(
    mode: MatchMode,
    userId: string,
    rating: number,
    window: number,
    clock?: TimeControlDto,
  ): Promise<string | null> {
    const token = randomUUID();
    const acquired = await this.redis.set(this.lockKey(mode), token, 'PX', 5000, 'NX');
    if (acquired !== 'OK') return null;
    try {
      const partner = await this.popPartner(mode, userId, rating, window);
      if (!partner) return null;
      const partnerMeta = await this.redis.hgetall(this.metaKey(partner));
      const useClock = clock ?? this.parseClock(partnerMeta?.timeControl);
      const match = await this.matches.create(partner, {
        mode,
        ...(useClock ? { clock: useClock } : {}),
      });
      await this.matches.join(userId, match.id, { color: Side.BLACK });
      const pipeline = this.redis.pipeline();
      pipeline.del(this.metaKey(userId));
      pipeline.del(this.metaKey(partner));
      pipeline.set(this.resultKey(userId), match.id, 'EX', 300);
      pipeline.set(this.resultKey(partner), match.id, 'EX', 300);
      await pipeline.exec();
      this.metrics.pairs.inc({ mode });
      this.logger.log(`Paired ${partner} vs ${userId} -> match ${match.id}`);
      return match.id;
    } finally {
      // Chỉ xóa lock của chính mình.
      const script =
        "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";
      await this.redis.eval(script, 1, this.lockKey(mode), token).catch(() => null);
    }
  }

  /**
   * Bốc đối thủ khỏi queue — ATOMIC bằng Lua (tìm + xóa cả 2 trong 1 bước).
   * Trả userId đối thủ hoặc null.
   */
  private async popPartner(
    mode: MatchMode,
    userId: string,
    rating: number,
    window: number,
  ): Promise<string | null> {
    const res = (await this.redis.eval(
      `
      local cands = redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[2], ARGV[3])
      local best = nil
      local bestDiff = nil
      for _, m in ipairs(cands) do
        if m ~= ARGV[1] then
          local s = tonumber(redis.call('ZSCORE', KEYS[1], m))
          local d = math.abs(s - tonumber(ARGV[4]))
          if bestDiff == nil or d < bestDiff then
            best = m
            bestDiff = d
          end
        end
      end
      if best then
        redis.call('ZREM', KEYS[1], ARGV[1])
        redis.call('ZREM', KEYS[1], best)
      end
      return best
      `,
      1,
      this.queueKey(mode),
      userId,
      String(rating - window),
      String(rating + window),
      String(rating),
    )) as string | null;
    return res ?? null;
  }
}
