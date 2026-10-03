import { cloneBoard, crossedRiver, inBoard, inPalace } from './board';
import { Board, Color, PieceMove, Square } from './types';

const ORTHO: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

const DIAG: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Horse: orthogonal "leg" square + the two outward destinations for each leg. */
const HORSE_LEGS: { leg: [number, number]; dests: [number, number][] }[] = [
  { leg: [0, 1], dests: [[-1, 2], [1, 2]] },
  { leg: [0, -1], dests: [[-1, -2], [1, -2]] },
  { leg: [1, 0], dests: [[2, -1], [2, 1]] },
  { leg: [-1, 0], dests: [[-2, -1], [-2, 1]] },
];

function pushIfFreeOrCapture(
  board: Board,
  me: Color,
  file: number,
  rank: number,
  out: Square[],
): boolean {
  if (!inBoard(file, rank)) return true; // stop sliding
  const target = board[rank][file];
  if (!target) {
    out.push({ file, rank });
    return false; // keep sliding
  }
  if (target.color !== me) out.push({ file, rank });
  return true; // blocked
}

function kingMoves(board: Board, sq: Square, me: Color): Square[] {
  const out: Square[] = [];
  for (const [df, dr] of ORTHO) {
    const f = sq.file + df;
    const r = sq.rank + dr;
    if (!inBoard(f, r) || !inPalace(me, f, r)) continue;
    const target = board[r][f];
    if (!target || target.color !== me) out.push({ file: f, rank: r });
  }
  // Flying General: capture the enemy king on the same file with a clear path.
  const dir = me === 'RED' ? 1 : -1;
  let r = sq.rank + dir;
  while (r >= 0 && r <= 9) {
    const target = board[r][sq.file];
    if (target) {
      if (target.color !== me && target.type === 'K') {
        out.push({ file: sq.file, rank: r });
      }
      break;
    }
    r += dir;
  }
  return out;
}

function advisorMoves(board: Board, sq: Square, me: Color): Square[] {
  const out: Square[] = [];
  for (const [df, dr] of DIAG) {
    const f = sq.file + df;
    const r = sq.rank + dr;
    if (!inBoard(f, r) || !inPalace(me, f, r)) continue;
    const target = board[r][f];
    if (!target || target.color !== me) out.push({ file: f, rank: r });
  }
  return out;
}

function elephantMoves(board: Board, sq: Square, me: Color): Square[] {
  const out: Square[] = [];
  for (const [df, dr] of DIAG) {
    const f = sq.file + df * 2;
    const r = sq.rank + dr * 2;
    if (!inBoard(f, r)) continue;
    // Cannot cross the river.
    if (me === 'RED' && r > 4) continue;
    if (me === 'BLACK' && r < 5) continue;
    // Elephant eye must be empty.
    if (board[sq.rank + dr][sq.file + df]) continue;
    const target = board[r][f];
    if (!target || target.color !== me) out.push({ file: f, rank: r });
  }
  return out;
}

function horseMoves(board: Board, sq: Square, me: Color): Square[] {
  const out: Square[] = [];
  for (const { leg, dests } of HORSE_LEGS) {
    // Horse leg block.
    if (board[sq.rank + leg[1]]?.[sq.file + leg[0]]) continue;
    for (const [df, dr] of dests) {
      const f = sq.file + df;
      const r = sq.rank + dr;
      if (!inBoard(f, r)) continue;
      const target = board[r][f];
      if (!target || target.color !== me) out.push({ file: f, rank: r });
    }
  }
  return out;
}

function rookMoves(board: Board, sq: Square, me: Color): Square[] {
  const out: Square[] = [];
  for (const [df, dr] of ORTHO) {
    let f = sq.file + df;
    let r = sq.rank + dr;
    while (inBoard(f, r)) {
      if (pushIfFreeOrCapture(board, me, f, r, out)) break;
      f += df;
      r += dr;
    }
  }
  return out;
}

function cannonMoves(board: Board, sq: Square, me: Color): Square[] {
  const out: Square[] = [];
  for (const [df, dr] of ORTHO) {
    // Non-capturing slides stop before the first piece.
    let f = sq.file + df;
    let r = sq.rank + dr;
    while (inBoard(f, r) && !board[r][f]) {
      out.push({ file: f, rank: r });
      f += df;
      r += dr;
    }
    // Captures jump exactly one screen; first piece beyond must be enemy.
    if (!inBoard(f, r)) continue;
    f += df;
    r += dr;
    while (inBoard(f, r)) {
      const target = board[r][f];
      if (target) {
        if (target.color !== me) out.push({ file: f, rank: r });
        break;
      }
      f += df;
      r += dr;
    }
  }
  return out;
}

function pawnMoves(board: Board, sq: Square, me: Color): Square[] {
  const out: Square[] = [];
  const dir = me === 'RED' ? 1 : -1;
  const steps: [number, number][] = [[0, dir]];
  if (crossedRiver(me, sq.rank)) steps.push([1, 0], [-1, 0]);
  for (const [df, dr] of steps) {
    const f = sq.file + df;
    const r = sq.rank + dr;
    if (!inBoard(f, r)) continue;
    const target = board[r][f];
    if (!target || target.color !== me) out.push({ file: f, rank: r });
  }
  return out;
}

/** Pseudo-legal destinations for the piece on `sq` (may leave own king in check). */
export function pseudoMoves(board: Board, sq: Square): Square[] {
  const piece = inBoard(sq.file, sq.rank) ? board[sq.rank][sq.file] : null;
  if (!piece) return [];
  const me = piece.color;
  switch (piece.type) {
    case 'K':
      return kingMoves(board, sq, me);
    case 'A':
      return advisorMoves(board, sq, me);
    case 'E':
      return elephantMoves(board, sq, me);
    case 'H':
      return horseMoves(board, sq, me);
    case 'R':
      return rookMoves(board, sq, me);
    case 'C':
      return cannonMoves(board, sq, me);
    case 'P':
      return pawnMoves(board, sq, me);
  }
}

/** All pseudo-legal moves for a color. */
export function pseudoMovesFor(board: Board, color: Color): PieceMove[] {
  const out: PieceMove[] = [];
  for (let rank = 0; rank < 10; rank++) {
    for (let file = 0; file < 9; file++) {
      if (board[rank][file]?.color !== color) continue;
      const from = { file, rank };
      for (const to of pseudoMoves(board, from)) out.push({ from, to });
    }
  }
  return out;
}

export function simulateMove(board: Board, move: PieceMove): Board {
  const next = cloneBoard(board);
  next[move.to.rank][move.to.file] = next[move.from.rank][move.from.file];
  next[move.from.rank][move.from.file] = null;
  return next;
}
