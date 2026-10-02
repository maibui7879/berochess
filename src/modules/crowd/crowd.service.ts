import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CrowdReaction } from './entities/crowd-reaction.entity';
import { CrowdVote } from './entities/crowd-vote.entity';

@Injectable()
export class CrowdService {
  constructor(
    @InjectRepository(CrowdVote) private readonly votes: Repository<CrowdVote>,
    @InjectRepository(CrowdReaction)
    private readonly reactions: Repository<CrowdReaction>,
  ) {}

  findVotes(matchId: string, query: PaginationQueryDto): Promise<CrowdVote[]> {
    return this.votes.find({
      where: { matchId },
      take: Math.min(query.limit ?? 20, 200),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
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
