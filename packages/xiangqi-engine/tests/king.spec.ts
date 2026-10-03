import { applyMove, createGame, getLegalMoves } from '../src/game';
import { formatSquare } from '../src/board';
import { dests, setupBoard } from './helpers';

describe('king', () => {
  it('stays inside the palace (initial e0 -> e1 only)', () => {
    const s = createGame();
    expect(dests(s, 'e0')).toEqual(['e1']);
  });

  it('moves one step orthogonally within the palace', () => {
    const s = setupBoard([['K', 'RED', 'e1']]);
    expect(dests(s, 'e1')).toEqual(['d1', 'e0', 'e2', 'f1']);
  });

  it('captures the enemy king with the flying general', () => {
    const s = setupBoard(
      [
        ['K', 'RED', 'e0'],
        ['K', 'BLACK', 'e9'],
      ],
      'RED',
    );
    // e1 is illegal: stepping forward keeps the kings facing each other.
    expect(dests(s, 'e0')).toEqual(['d0', 'e9', 'f0']);
    const after = applyMove(s, 'e0', 'e9');
    expect(after.result).toEqual({ over: true, winner: 'RED', reason: 'KING_CAPTURED' });
  });

  it('cannot leave the palace', () => {
    const s = setupBoard([['K', 'RED', 'e0']]);
    const all = getLegalMoves(s, 'e0').map(formatSquare);
    expect(all).not.toContain('e3');
    expect(all.every((sq) => sq[0] >= 'd' && sq[0] <= 'f')).toBe(true);
  });
});
