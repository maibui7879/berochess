import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
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
  ) {}

  findAll(query: PaginationQueryDto): Promise<Match[]> {
    return this.matches.find({
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: string): Promise<Match | null> {
    return this.matches.findOneBy({ id });
  }

  findPlayers(matchId: string): Promise<MatchPlayer[]> {
    return this.players.findBy({ matchId });
  }

  findSpectators(matchId: string): Promise<MatchSpectator[]> {
    return this.spectators.findBy({ matchId });
  }
}
