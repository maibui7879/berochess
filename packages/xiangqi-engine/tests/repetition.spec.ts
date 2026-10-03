import { applyMove, createGame, validateMove } from '../src/game';
import { countRepetition, isThreefoldRepetition } from '../src/rules';

describe('repetition', () => {
  it('draws on threefold repetition (rooks shuffling a0/a1 and a9/a8)', () => {
    let s = createGame();
    const halfMoves: [string, string][] = [
      ['a0', 'a1'],
      ['a9', 'a8'],
      ['a1', 'a0'],
      ['a8', 'a9'],
      ['a0', 'a1'],
      ['a9', 'a8'],
      ['a1', 'a0'],
      ['a8', 'a9'],
    ];
    halfMoves.forEach(([from, to], i) => {
      expect(validateMove(s, from, to)).toEqual({
        ok: true,
        move: expect.objectContaining({}),
      });
      s = applyMove(s, from, to);
      if (i === 3) {
        expect(countRepetition(s)).toBe(2);
        expect(isThreefoldRepetition(s)).toBe(false);
        expect(s.result.over).toBe(false);
      }
    });
    expect(countRepetition(s)).toBe(3);
    expect(isThreefoldRepetition(s)).toBe(true);
    expect(s.result).toEqual({ over: true, winner: 'DRAW', reason: 'DRAW_REPETITION' });
  });

  it('rejects moving out of turn', () => {
    const s = createGame();
    expect(validateMove(s, 'a9', 'a8')).toEqual({ ok: false, reason: 'NOT_YOUR_PIECE' });
  });
});
