import { START_FEN, cloneBoard, parseFen, parseSquare, positionKey } from './board';
import { adjudicate, findKing, isInCheck, legalMovesFrom } from './rules';
import {
  Board,
  Color,
  DEFAULT_RULESET,
  EngineState,
  GameResult,
  PieceMove,
  RuleSet,
  Square,
  opposite,
} from './types';

export type MoveInput = string | Square;

function toSquare(input: MoveInput): Square {
  return typeof input === 'string' ? parseSquare(input) : input;
}

/** Fresh game from the standard initial position (Red to move). */
export function createGame(fen: string = START_FEN): EngineState {
  const { board, turn } = parseFen(fen);
  const state: EngineState = {
    board,
    turn,
    moveNumber: 1,
    halfmoveClock: 0,
    history: [positionKey(board, turn)],
    result: { over: false },
  };
  state.result = adjudicate(state, DEFAULT_RULESET);
  return state;
}

/** Legal destinations for the piece on `from` ('b0' or {file,rank}). */
export function getLegalMoves(state: EngineState, from: MoveInput): Square[] {
  if (state.result.over) return [];
  return legalMovesFrom(state.board, state.turn, toSquare(from));
}

export type IllegalReason =
  | 'GAME_OVER'
  | 'EMPTY_SQUARE'
  | 'NOT_YOUR_PIECE'
  | 'ILLEGAL_MOVE';

export function validateMove(
  state: EngineState,
  fromInput: MoveInput,
  toInput: MoveInput,
): { ok: true; move: PieceMove } | { ok: false; reason: IllegalReason } {
  if (state.result.over) return { ok: false, reason: 'GAME_OVER' };
  const from = toSquare(fromInput);
  const to = toSquare(toInput);
  const piece = state.board[from.rank]?.[from.file];
  if (!piece) return { ok: false, reason: 'EMPTY_SQUARE' };
  if (piece.color !== state.turn) return { ok: false, reason: 'NOT_YOUR_PIECE' };
  const legal = legalMovesFrom(state.board, state.turn, from);
  if (!legal.some((t) => t.file === to.file && t.rank === to.rank)) {
    return { ok: false, reason: 'ILLEGAL_MOVE' };
  }
  return { ok: true, move: { from, to } };
}

/**
 * Apply a validated move and return the new state (immutable).
 * Throws on illegal moves — call `validateMove` first for a soft check.
 */
export function applyMove(
  state: EngineState,
  fromInput: MoveInput,
  toInput: MoveInput,
  rules: RuleSet = DEFAULT_RULESET,
): EngineState {
  const checked = validateMove(state, fromInput, toInput);
  if (!checked.ok) throw new Error(`Illegal move: ${checked.reason}`);
  const { move } = checked;

  const board: Board = cloneBoard(state.board);
  const moving = board[move.from.rank][move.from.file];
  const captured = board[move.to.rank][move.to.file];
  board[move.to.rank][move.to.file] = moving;
  board[move.from.rank][move.from.file] = null;

  const turn: Color = opposite(state.turn);
  const next: EngineState = {
    board,
    turn,
    moveNumber: state.turn === 'BLACK' ? state.moveNumber + 1 : state.moveNumber,
    halfmoveClock: moving?.type === 'P' || captured ? 0 : state.halfmoveClock + 1,
    history: [...state.history, positionKey(board, turn)],
    result: { over: false },
  };
  next.result = adjudicate(next, rules);
  return next;
}

export function isCheck(state: EngineState): boolean {
  const king = findKing(state.board, state.turn);
  if (!king) return false;
  return isInCheck(state.board, state.turn);
}

export function isCheckmate(state: EngineState): boolean {
  return state.result.over && state.result.reason === 'CHECKMATE';
}

export function isStalemate(state: EngineState): boolean {
  return state.result.over && state.result.reason === 'STALEMATE';
}

export function isGameOver(state: EngineState, rules: RuleSet = DEFAULT_RULESET): GameResult {
  return state.result.over ? state.result : adjudicate(state, rules);
}
