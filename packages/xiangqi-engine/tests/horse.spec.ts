import { createGame } from '../src/game';
import { dests, setupBoard } from './helpers';

describe('horse', () => {
  it('moves in initial position (b0 -> a2, c2)', () => {
    const s = createGame();
    expect(dests(s, 'b0')).toEqual(['a2', 'c2']);
  });

  it('is fully blocked when all legs are occupied', () => {
    const s = setupBoard([
      ['H', 'RED', 'b0'],
      ['P', 'RED', 'b1'],
      ['R', 'RED', 'a0'],
      ['E', 'RED', 'c0'],
    ]);
    expect(dests(s, 'b0')).toEqual([]);
  });

  it('only loses the destinations behind the blocked leg', () => {
    const s = setupBoard([
      ['H', 'RED', 'c3'],
      ['P', 'BLACK', 'c4'],
    ]);
    expect(dests(s, 'c3')).toEqual(['a2', 'a4', 'b1', 'd1', 'e2', 'e4']);
  });
});
