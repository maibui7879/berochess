import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { START_FEN } from 'xiangqi-engine';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MatchStatus, Side } from '../../common/enums';
import { GameState } from './entities/game-state.entity';
import { Move } from './entities/move.entity';

export interface RecordMoveInput {
  matchId: string;
  playerId: string;
  from: string;
  to: string;
  capturedPiece?: string | null;
  notation?: string | null;
  boardHash?: string | null;
}

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

  /** Tạo state ban đầu nếu chưa có. Board mặc định là thế cờ khai cuộc (FEN). */
  async ensureState(matchId: string, board: unknown = START_FEN): Promise<GameState> {
    const existing = await this.findState(matchId);
    if (existing) return existing;
    return this.states.save(
      this.states.create({
        matchId,
        turn: Side.RED,
        moveNumber: 0,
        board,
        status: MatchStatus.WAITING,
        lastMove: null,
      }),
    );
  }

  async setStateStatus(matchId: string, status: MatchStatus): Promise<void> {
    await this.states.update({ matchId }, { status });
  }

  /** Persist 1 nước đi (validation nằm ở engine/gateway Phase 6+). */
  async recordMove(input: RecordMoveInput): Promise<Move> {
    const last = await this.moves.find({
      where: { matchId: input.matchId },
      order: { moveNumber: 'DESC' },
      take: 1,
    });
    const moveNumber = (last[0]?.moveNumber ?? 0) + 1;
    const move = await this.moves.save(
      this.moves.create({
        matchId: input.matchId,
        moveNumber,
        playerId: input.playerId,
        from: input.from,
        to: input.to,
        capturedPiece: input.capturedPiece ?? null,
        notation: input.notation ?? null,
        boardHash: input.boardHash ?? null,
      }),
    );
    const state = await this.findState(input.matchId);
    if (state) {
      state.moveNumber = moveNumber;
      state.turn = state.turn === Side.RED ? Side.BLACK : Side.RED;
      state.lastMove = { from: input.from, to: input.to, moveNumber };
      await this.states.save(state);
    }
    return move;
  }
}
