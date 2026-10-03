import { Board, Color, Piece, PieceType, Square } from './types';

export const FILES = 'abcdefghi';

export const START_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

export function inBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 9 && rank >= 0 && rank < 10;
}

export function inPalace(color: Color, file: number, rank: number): boolean {
  if (file < 3 || file > 5) return false;
  return color === 'RED' ? rank >= 0 && rank <= 2 : rank >= 7 && rank <= 9;
}

/** Has the piece crossed the river? */
export function crossedRiver(color: Color, rank: number): boolean {
  return color === 'RED' ? rank >= 5 : rank <= 4;
}

/** 'b0' -> { file: 1, rank: 0 } */
export function parseSquare(s: string): Square {
  if (!/^[a-i][0-9]$/.test(s)) throw new Error(`Invalid square: ${s}`);
  return { file: FILES.indexOf(s[0]), rank: Number(s[1]) };
}

/** { file: 1, rank: 0 } -> 'b0' */
export function formatSquare(sq: Square): string {
  return `${FILES[sq.file]}${sq.rank}`;
}

export function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array<Piece | null>(9).fill(null));
}

function charToPiece(ch: string): Piece | null {
  if (ch === '.' || ch === undefined) return null;
  const upper = ch.toUpperCase();
  // Standard aliases: N = horse (knight), B = elephant (bishop).
  const type = (upper === 'N' ? 'H' : upper === 'B' ? 'E' : upper) as PieceType;
  if (!'KAEHRCP'.includes(type)) throw new Error(`Invalid piece char: ${ch}`);
  return { type, color: ch === ch.toUpperCase() ? 'RED' : 'BLACK' };
}

function pieceToChar(p: Piece | null): string {
  if (!p) return '.';
  return p.color === 'RED' ? p.type : p.type.toLowerCase();
}

/**
 * Parse a Xiangqi FEN. Board rows run rank 9 -> rank 0.
 * Example: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'
 */
export function parseFen(fen: string): { board: Board; turn: Color } {
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0].split('/');
  if (rows.length !== 10) throw new Error(`FEN must have 10 rows: ${fen}`);
  const board = emptyBoard();
  rows.forEach((row, i) => {
    const rank = 9 - i;
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += Number(ch);
      } else {
        if (file >= 9) throw new Error(`FEN row overflow: ${row}`);
        board[rank][file] = charToPiece(ch);
        file += 1;
      }
    }
    if (file !== 9) throw new Error(`FEN row must cover 9 files: ${row}`);
  });
  const turn: Color = parts[1] === 'b' ? 'BLACK' : 'RED';
  return { board, turn };
}

export function boardToFenPart(board: Board): string {
  const rows: string[] = [];
  for (let rank = 9; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 9; file++) {
      const p = board[rank][file];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) {
          row += String(empty);
          empty = 0;
        }
        row += pieceToChar(p);
      }
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  return rows.join('/');
}

/** Board + side-to-move key for repetition detection (clocks excluded). */
export function positionKey(board: Board, turn: Color): string {
  return `${boardToFenPart(board)} ${turn === 'RED' ? 'w' : 'b'}`;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}
