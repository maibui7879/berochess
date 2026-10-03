import { createGame } from '../src/game';
import { dests, setupBoard } from './helpers';

describe('pawn', () => {
  it('moves straight forward before crossing the river', () => {
    const s = createGame();
    expect(dests(s, 'a3')).toEqual(['a4']);
  });

  it('gains sideways moves after crossing the river', () => {
    const s = setupBoard([['P', 'RED', 'a6']]);
    expect(dests(s, 'a6')).toEqual(['a7', 'b6']);
  });

  it('never moves backward', () => {
    const s = setupBoard([['P', 'RED', 'a6']]);
    expect(dests(s, 'a6')).not.toContain('a5');
  });

  it('black pawns march downward', () => {
    const s = setupBoard([['P', 'BLACK', 'a6']], 'BLACK');
    expect(dests(s, 'a6')).toEqual(['a5']);
    const crossed = setupBoard([['P', 'BLACK', 'e4']], 'BLACK');
    expect(dests(crossed, 'e4')).toEqual(['d4', 'e3', 'f4']);
  });
});
