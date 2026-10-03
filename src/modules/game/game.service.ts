import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { START_FEN, applyMove, createGame } from 'xiangqi-engine';
import type { EngineState } from 'xiangqi-engine';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MatchStatus, Side } from '../../common/enums';
import { GameState } from './entities/game-state.entity';
import { Move } from './entities/move.entity';

export interface ApplyMoveResultInput {
  matchId: string;
  playerId: string;
  from: string;
  to: string;
  capturedPiece?: string | null;
  notation?: string | null;
  boardHash?: string | null;
  /** Full FEN sau nước đi (engine là nguồn duy nhất của board truth). */
  boardFen: string;
  turn: Side;
  status: MatchStatus;
}

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(GameState) private readonly states: Repository<GameState>,
    @InjectRepository(Move) private readonly moves: Repository<Move>,
    @InjectDataSource() private readonly dataSource: DataSource,
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

  /**
   * Dựng lại engine state bằng cách replay toàn bộ moves từ thế khai cuộc.
   * Cho repetition/history đúng ngay cả sau restart server.
   */
  async loadEngineState(matchId: string): Promise<EngineState | null> {
    const moves = await this.moves.find({
      where: { matchId },
      order: { moveNumber: 'ASC' },
    });
    try {
      let engine = createGame();
      for (const m of moves) {
        engine = applyMove(engine, m.from, m.to);
        if (engine.result.over) break;
      }
      return engine;
    } catch {
      return null;
    }
  }

  /**
   * Persist 1 nước đi đã được engine validate (gọi từ Gateway).
   * Move + state update trong 1 transaction.
   */
  async applyMoveResult(input: ApplyMoveResultInput): Promise<{ move: Move; state: GameState }> {
    return this.dataSource.transaction(async (em) => {
      const moveNumber = (await em.count(Move, { where: { matchId: input.matchId } })) + 1;
      const move = await em.save(
        em.create(Move, {
          matchId: input.matchId,
          moveNumber,
          playerId: input.playerId,
          from: input.from,
          to: input.to,
          capturedPiece: input.capturedPiece ?? null,
          notation: input.notation ?? `${input.from}-${input.to}`,
          boardHash: input.boardHash ?? null,
        }),
      );
      let state = await em.findOne(GameState, { where: { matchId: input.matchId } });
      if (!state) {
        state = em.create(GameState, {
          matchId: input.matchId,
          turn: input.turn,
          moveNumber,
          board: input.boardFen,
          status: input.status,
          lastMove: null,
        });
      } else {
        state.turn = input.turn;
        state.moveNumber = moveNumber;
        state.board = input.boardFen;
        state.status = input.status;
      }
      state.lastMove = { from: input.from, to: input.to, moveNumber };
      await em.save(state);
      return { move, state };
    });
  }
}
