import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { CrowdReaction } from './entities/crowd-reaction.entity';

@Injectable()
export class CrowdService {
  constructor(
    @InjectRepository(CrowdReaction)
    private readonly reactions: Repository<CrowdReaction>,
  ) {}

  createReaction(userId: string, dto: CreateReactionDto): Promise<CrowdReaction> {
    return this.reactions.save(
      this.reactions.create({ matchId: dto.matchId, userId, emoji: dto.emoji }),
    );
  }

  findReactions(matchId: string, query: PaginationQueryDto): Promise<CrowdReaction[]> {
    return this.reactions.find({
      where: { matchId },
      take: Math.min(query.limit ?? 20, 200),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }
}
