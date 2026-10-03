import { dests, setupBoard } from './helpers';

describe('cannon', () => {
  it('captures over exactly one screen', () => {
    const s = setupBoard([
      ['C', 'RED', 'e4'],
      ['P', 'BLACK', 'e6'],
      ['R', 'BLACK', 'e8'],
    ]);
    const moves = dests(s, 'e4');
    expect(moves).toContain('e5'); // quiet slide
    expect(moves).toContain('e8'); // jump capture
    expect(moves).not.toContain('e6'); // screen square
    expect(moves).not.toContain('e7'); // empty beyond screen, not a capture
  });

  it('cannot capture without a screen', () => {
    const s = setupBoard([
      ['C', 'RED', 'e4'],
      ['R', 'BLACK', 'e8'],
    ]);
    const moves = dests(s, 'e4');
    expect(moves).toContain('e5');
    expect(moves).not.toContain('e8');
  });

  it('quiet slides stop before the screen', () => {
    const s = setupBoard([
      ['C', 'RED', 'e4'],
      ['P', 'RED', 'e6'],
    ]);
    const moves = dests(s, 'e4');
    expect(moves).toContain('e5');
    expect(moves).not.toContain('e6');
  });
});
