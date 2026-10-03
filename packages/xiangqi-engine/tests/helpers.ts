import { emptyBoard, formatSquare, parseSquare, positionKey } from '../src/board';
import { getLegalMoves } from '../src/game';
import { Board, Color, EngineState, PieceType } from '../src/types';

/** Build an EngineState from a piece list: [type, color, square]. */
export function setupBoard(
  pieces: Array<[PieceType, Color, string]>,
  turn: Color = 'RED',
): EngineState {
  const board: Board = emptyBoard();
  for (const [type, color, sq] of pieces) {
    const { file, rank } = parseSquare(sq);
    board[rank][file] = { type, color };
  }
  return {
    board,
    turn,
    moveNumber: 1,
    halfmoveClock: 0,
    history: [positionKey(board, turn)],
    result: { over: false },
  };
}

/** Sorted destination squares ('a2', ...) for the piece on `from`. */
export function dests(state: EngineState, from: string): string[] {
  return getLegalMoves(state, from)
    .map(formatSquare)
    .sort();
}
