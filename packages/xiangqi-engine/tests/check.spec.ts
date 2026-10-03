import { isInCheck } from '../src/rules';
import { validateMove } from '../src/game';
import { setupBoard } from './helpers';
import { dests } from './helpers';

describe('check', () => {
  it('detects a rook check', () => {
    const s = setupBoard([
      ['K', 'BLACK', 'e9'],
      ['R', 'RED', 'e5'],
    ]);
    expect(isInCheck(s.board, 'BLACK')).toBe(true);
    expect(isInCheck(s.board, 'RED')).toBe(false);
  });

  it('is blocked by an interposing piece', () => {
    const s = setupBoard([
      ['K', 'BLACK', 'e9'],
      ['R', 'RED', 'e5'],
      ['P', 'BLACK', 'e7'],
    ]);
    expect(isInCheck(s.board, 'BLACK')).toBe(false);
  });

  it('detects a cannon check only with a screen', () => {
    const withScreen = setupBoard([
      ['K', 'BLACK', 'e9'],
      ['C', 'RED', 'e5'],
      ['P', 'RED', 'e6'],
    ]);
    expect(isInCheck(withScreen.board, 'BLACK')).toBe(true);
    const noScreen = setupBoard([
      ['K', 'BLACK', 'e9'],
      ['C', 'RED', 'e5'],
    ]);
    expect(isInCheck(noScreen.board, 'BLACK')).toBe(false);
  });

  it('filters self-check: pinned rook stays on the file', () => {
    const s = setupBoard(
      [
        ['K', 'RED', 'e0'],
        ['R', 'RED', 'e5'],
        ['R', 'BLACK', 'e9'],
      ],
      'RED',
    );
    expect(dests(s, 'e5')).toEqual(['e1', 'e2', 'e3', 'e4', 'e6', 'e7', 'e8', 'e9']);
    expect(validateMove(s, 'e5', 'd5')).toEqual({ ok: false, reason: 'ILLEGAL_MOVE' });
  });
});
