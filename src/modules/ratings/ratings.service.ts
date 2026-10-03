import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MatchWinner, RatingType } from '../../common/enums';
import { RatingHistory } from './entities/rating-history.entity';
import { Rating } from './entities/rating.entity';
import { updateDuel } from './glicko2';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating) private readonly ratings: Repository<Rating>,
    @InjectRepository(RatingHistory) private readonly history: Repository<RatingHistory>,
  ) {}

  findAll(userId: string, query: PaginationQueryDto): Promise<Rating[]> {
    return this.ratings.find({
      where: { userId },
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
    });
  }

  findOne(userId: string, type: RatingType): Promise<Rating | null> {
    return this.ratings.findOneBy({ userId, type });
  }

  findHistory(userId: string, query: PaginationQueryDto): Promise<RatingHistory[]> {
    return this.history.find({
      where: { userId },
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }

  /** Tạo 3 dòng rating mặc định cho user mới (gọi khi register). */
  async ensureDefaults(userId: string): Promise<Rating[]> {
    const out: Rating[] = [];
    for (const type of [RatingType.COMPETITIVE, RatingType.CROWD, RatingType.PREDICTION]) {
      out.push(await this.ensureRating(userId, type));
    }
    return out;
  }

  async ensureRating(userId: string, type: RatingType): Promise<Rating> {
    const existing = await this.findOne(userId, type);
    if (existing) return existing;
    return this.ratings.save(this.ratings.create({ userId, type }));
  }

  /** Top rating theo loại (leaderboard). */
  leaderboard(type: RatingType, limit = 20): Promise<Rating[]> {
    return this.ratings.find({
      where: { type },
      take: Math.min(Math.max(limit, 1), 100),
      order: { rating: 'DESC' },
    });
  }

  /**
   * Cập nhật Glicko-2 sau ván RANKED (chỉ loại COMPETITIVE).
   * CASUAL/CROWD_MATCH không động vào rating.
   */
  async applyRankedResult(
    matchId: string,
    redUserId: string,
    blackUserId: string,
    winner: MatchWinner,
  ): Promise<void> {
    if (redUserId === blackUserId) return;
    const [red, black] = await Promise.all([
      this.ensureRating(redUserId, RatingType.COMPETITIVE),
      this.ensureRating(blackUserId, RatingType.COMPETITIVE),
    ]);
    const scoreRed = winner === MatchWinner.RED ? 1 : winner === MatchWinner.BLACK ? 0 : 0.5;
    const [redNext, blackNext] = updateDuel(
      { rating: red.rating, rd: red.ratingDeviation, vol: red.volatility },
      { rating: black.rating, rd: black.ratingDeviation, vol: black.volatility },
      scoreRed,
    );
    await this.ratings.save([
      {
        ...red,
        rating: redNext.rating,
        ratingDeviation: redNext.rd,
        volatility: redNext.vol,
        games: red.games + 1,
      },
      {
        ...black,
        rating: blackNext.rating,
        ratingDeviation: blackNext.rd,
        volatility: blackNext.vol,
        games: black.games + 1,
      },
    ]);
    await this.history.save([
      this.history.create({
        userId: redUserId,
        matchId,
        type: RatingType.COMPETITIVE,
        ratingBefore: red.rating,
        ratingAfter: redNext.rating,
      }),
      this.history.create({
        userId: blackUserId,
        matchId,
        type: RatingType.COMPETITIVE,
        ratingBefore: black.rating,
        ratingAfter: blackNext.rating,
      }),
    ]);
  }
}
