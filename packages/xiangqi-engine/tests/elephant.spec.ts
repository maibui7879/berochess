import { dests, setupBoard } from './helpers';
describe('elephant', () => {
  it('is blocked by the elephant eye', () => {
    const s = setupBoard([
      ['E', 'RED', 'c0'],
      ['P', 'RED', 'd1'],
    ]);
    expect(dests(s, 'c0')).toEqual(['a2']);
  });

  it('cannot cross the river', () => {
    const s = setupBoard([['E', 'RED', 'c4']]);
    const moves = dests(s, 'c4');
    expect(moves).toEqual(['a2', 'e2']);
    expect(moves).not.toContain('a6');
    expect(moves).not.toContain('e6');
  });

  it('black elephant stays on its own side', () => {
    const s = setupBoard([['E', 'BLACK', 'c5']], 'BLACK');
    expect(dests(s, 'c5')).toEqual(['a7', 'e7']);
  });
});
