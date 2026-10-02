import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Commentary } from './entities/commentary.entity';

@Injectable()
export class CommentaryService {
  constructor(
    @InjectRepository(Commentary)
    private readonly commentaries: Repository<Commentary>,
  ) {}

  findByMatch(matchId: string, query: PaginationQueryDto): Promise<Commentary[]> {
    return this.commentaries.find({
      where: { matchId },
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: string): Promise<Commentary | null> {
    return this.commentaries.findOneBy({ id });
  }
}
