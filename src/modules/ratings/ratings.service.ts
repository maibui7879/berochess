import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
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

  findHistory(userId: string, query: PaginationQueryDto): Promise<RatingHistory[]> {
    return this.history.find({
      where: { userId },
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }
}
