import { createGame, isCheckmate } from '../src/game';

describe('checkmate', () => {
  it('detects a double-rook back-rank mate', () => {
    // Black Ke9 bare; Red Ra9 (rank check) + Rf8 (covers e8/f9/d9... f9/e8/d8); Red Kd0.
    const s = createGame('R3k4/5R3/9/9/9/9/9/9/9/3K5 b - - 0 1');
    expect(s.result).toEqual({ over: true, winner: 'RED', reason: 'CHECKMATE' });
    expect(isCheckmate(s)).toBe(true);
  });

  it('initial position is not over', () => {
    const s = createGame();
    expect(s.result.over).toBe(false);
    expect(isCheckmate(s)).toBe(false);
  });
});
