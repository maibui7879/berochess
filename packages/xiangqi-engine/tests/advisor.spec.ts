import { createGame } from '../src/game';
import { dests, setupBoard } from './helpers';

describe('advisor', () => {
  it('moves one step along palace diagonals (initial d0 -> e1 only)', () => {
    const s = createGame();
    // c1 is not a palace point, so d0 can only go to e1.
    expect(dests(s, 'd0')).toEqual(['e1']);
  });

  it('stays inside the palace', () => {
    // c1 can only go to d0/d2 — b0/b2 are outside palace files.
    const s = setupBoard([['A', 'RED', 'c1']]);
    expect(dests(s, 'c1')).toEqual(['d0', 'd2']);
  });
});
