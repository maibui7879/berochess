import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RatingType } from '../../common/enums';
import { RatingHistory } from './entities/rating-history.entity';
import { Rating } from './entities/rating.entity';

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
      const existing = await this.findOne(userId, type);
      if (existing) {
        out.push(existing);
        continue;
      }
      out.push(await this.ratings.save(this.ratings.create({ userId, type })));
    }
    return out;
  }
}
