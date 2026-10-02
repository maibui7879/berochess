import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { CreateVoteDto } from './dto/create-vote.dto';
import { CrowdReaction } from './entities/crowd-reaction.entity';
import { CrowdVote } from './entities/crowd-vote.entity';

@Injectable()
export class CrowdService {
  constructor(
    @InjectRepository(CrowdVote) private readonly votes: Repository<CrowdVote>,
    @InjectRepository(CrowdReaction)
    private readonly reactions: Repository<CrowdReaction>,
  ) {}

  /** Mỗi user 1 vote / nước đi — vote lại thì cập nhật. */
  async upsertVote(userId: string, dto: CreateVoteDto): Promise<CrowdVote> {
    const existing = await this.votes.findOneBy({
      matchId: dto.matchId,
      moveNumber: dto.moveNumber,
      userId,
    });
    if (existing) {
      existing.from = dto.from;
      existing.to = dto.to;
      return this.votes.save(existing);
    }
    return this.votes.save(
      this.votes.create({
        matchId: dto.matchId,
        userId,
        moveNumber: dto.moveNumber,
        from: dto.from,
        to: dto.to,
      }),
    );
  }

  findVotes(matchId: string, query: PaginationQueryDto): Promise<CrowdVote[]> {
    return this.votes.find({
      where: { matchId },
      take: Math.min(query.limit ?? 20, 200),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }

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
