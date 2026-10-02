import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { GameState } from './entities/game-state.entity';
import { Move } from './entities/move.entity';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(GameState) private readonly states: Repository<GameState>,
    @InjectRepository(Move) private readonly moves: Repository<Move>,
  ) {}

  findState(matchId: string): Promise<GameState | null> {
    return this.states.findOneBy({ matchId });
  }

  findMoves(matchId: string, query: PaginationQueryDto): Promise<Move[]> {
    return this.moves.find({
      where: { matchId },
      take: Math.min(query.limit ?? 20, 200),
      skip: query.offset ?? 0,
      order: { moveNumber: 'ASC' },
    });
  }
}
