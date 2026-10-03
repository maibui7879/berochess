/** Core types for the Xiangqi engine. Pure data — no framework dependencies. */

export type Color = 'RED' | 'BLACK';

export type PieceType = 'K' | 'A' | 'E' | 'H' | 'R' | 'C' | 'P';

export interface Piece {
  type: PieceType;
  color: Color;
}

/** Board indexed [rank][file]. Rank 0..9 (0 = Red home), file 0..8 (0 = file 'a'). */
export type Board = (Piece | null)[][];

export interface Square {
  file: number;
  rank: number;
}

export interface PieceMove {
  from: Square;
  to: Square;
}

export type GameResultReason =
  | 'CHECKMATE'
  | 'STALEMATE'
  | 'KING_CAPTURED'
  | 'RESIGN'
  | 'DRAW_REPETITION'
  | 'DRAW_NO_CAPTURE'
  | 'DRAW_AGREEMENT';

export type Winner = Color | 'DRAW';

export interface GameResult {
  over: boolean;
  winner?: Winner;
  reason?: GameResultReason;
}

export interface EngineState {
  board: Board;
  turn: Color;
  /** Fullmove number, starts at 1 (increments after Black moves). */
  moveNumber: number;
  /** Half-moves since last pawn move or capture. */
  halfmoveClock: number;
  /** Position keys (board + side to move), oldest first. Used for repetition. */
  history: string[];
  result: GameResult;
}

/** Competition rules, configurable per match (RuleSet). */
export interface RuleSet {
  threefoldRepetition: 'draw' | 'off';
  /** Full moves without pawn move or capture before automatic draw. */
  noCaptureLimit: number;
}

export const DEFAULT_RULESET: RuleSet = {
  threefoldRepetition: 'draw',
  noCaptureLimit: 60,
};

export const opposite = (color: Color): Color => (color === 'RED' ? 'BLACK' : 'RED');
