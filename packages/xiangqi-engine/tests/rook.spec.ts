import { dests, setupBoard } from './helpers';

describe('rook', () => {
  it('slides orthogonally on an open board (17 destinations from e4)', () => {
    const s = setupBoard([['R', 'RED', 'e4']]);
    expect(dests(s, 'e4')).toHaveLength(17);
  });

  it('stops at own pieces and captures the first enemy', () => {
    const s = setupBoard([
      ['R', 'RED', 'e4'],
      ['P', 'RED', 'e6'],
      ['P', 'BLACK', 'e2'],
    ]);
    const moves = dests(s, 'e4');
    expect(moves).toContain('e5');
    expect(moves).toContain('e3');
    expect(moves).toContain('e2'); // capture
    expect(moves).not.toContain('e6'); // own piece
    expect(moves).not.toContain('e7'); // behind own piece
    expect(moves).not.toContain('e1'); // behind capture
    expect(moves).toHaveLength(11);
  });
});
