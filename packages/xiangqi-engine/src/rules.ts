import { Board, Color, EngineState, GameResult, PieceMove, RuleSet, Square, Winner, opposite } from './types';
import { pseudoMoves, pseudoMovesFor, simulateMove } from './moves';

export function findKing(board: Board, color: Color): Square | null {
  for (let rank = 0; rank < 10; rank++) {
    for (let file = 0; file < 9; file++) {
      const p = board[rank][file];
      if (p && p.type === 'K' && p.color === color) return { file, rank };
    }
  }
  return null;
}

/** Is `sq` attacked by any piece of `byColor`? (Includes flying-general capture.) */
export function isSquareAttacked(board: Board, sq: Square, byColor: Color): boolean {
  for (let rank = 0; rank < 10; rank++) {
    for (let file = 0; file < 9; file++) {
      if (board[rank][file]?.color !== byColor) continue;
      const targets = pseudoMoves(board, { file, rank });
      if (targets.some((t) => t.file === sq.file && t.rank === sq.rank)) return true;
    }
  }
  return false;
}

export function isInCheck(board: Board, color: Color): boolean {
  const king = findKing(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king, opposite(color));
}

function sameSquare(a: Square, b: Square): boolean {
  return a.file === b.file && a.rank === b.rank;
}

/** Legal destinations for one piece: pseudo moves minus self-check (incl. flying-general exposure). */
export function legalMovesFrom(board: Board, turn: Color, from: Square): Square[] {
  const piece = board[from.rank]?.[from.file];
  if (!piece || piece.color !== turn) return [];
  return pseudoMoves(board, from).filter((to) => {
    const next = simulateMove(board, { from, to });
    return !isInCheck(next, turn);
  });
}

/** Every legal move for the side to move. */
export function allLegalMoves(board: Board, turn: Color): PieceMove[] {
  const out: PieceMove[] = [];
  for (let rank = 0; rank < 10; rank++) {
    for (let file = 0; file < 9; file++) {
      if (board[rank][file]?.color !== turn) continue;
      const from = { file, rank };
      for (const to of legalMovesFrom(board, turn, from)) out.push({ from, to });
    }
  }
  return out;
}

export function isMoveLegal(board: Board, turn: Color, from: Square, to: Square): boolean {
  return legalMovesFrom(board, turn, from).some((t) => sameSquare(t, to));
}

/** Occurrences of the current position (board + side to move) in history. */
export function countRepetition(state: EngineState): number {
  const current = state.history[state.history.length - 1];
  return state.history.filter((h) => h === current).length;
}

export function isThreefoldRepetition(state: EngineState): boolean {
  return countRepetition(state) >= 3;
}

export function isNoCaptureDraw(state: EngineState, noCaptureLimit: number): boolean {
  return state.halfmoveClock >= noCaptureLimit * 2;
}

/** Terminal / draw adjudication for the current state. */
export function adjudicate(state: EngineState, rules: RuleSet): GameResult {
  const redKing = findKing(state.board, 'RED');
  const blackKing = findKing(state.board, 'BLACK');
  if (!redKing || !blackKing) {
    const winner: Winner = redKing ? 'RED' : 'BLACK';
    return { over: true, winner, reason: 'KING_CAPTURED' };
  }
  const moves = allLegalMoves(state.board, state.turn);
  if (moves.length === 0) {
    if (isInCheck(state.board, state.turn)) {
      return { over: true, winner: opposite(state.turn), reason: 'CHECKMATE' };
    }
    return { over: true, winner: 'DRAW', reason: 'STALEMATE' };
  }
  if (rules.threefoldRepetition === 'draw' && isThreefoldRepetition(state)) {
    return { over: true, winner: 'DRAW', reason: 'DRAW_REPETITION' };
  }
  if (isNoCaptureDraw(state, rules.noCaptureLimit)) {
    return { over: true, winner: 'DRAW', reason: 'DRAW_NO_CAPTURE' };
  }
  return { over: false };
}

export function isCheckmate(board: Board, turn: Color): boolean {
  return (
    isInCheck(board, turn) && allLegalMoves(board, turn).length === 0
  );
}

export function isStalemate(board: Board, turn: Color): boolean {
  return (
    !isInCheck(board, turn) && allLegalMoves(board, turn).length === 0
  );
}

export function isGameOver(state: EngineState, rules: RuleSet): GameResult {
  return state.result.over ? state.result : adjudicate(state, rules);
}

// Re-exported for tests that only need move enumeration.
export { pseudoMovesFor };
