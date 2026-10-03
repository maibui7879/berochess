import { boardToFenPart, parseFen, parseSquare } from '../src/board';
import { applyMove, createGame, isStalemate, validateMove } from '../src/game';

describe('edge cases', () => {
  it('forbids exposing the flying general', () => {
    const s = createGame('4k4/9/9/9/4R4/9/9/9/9/4K4 w - - 0 1');
    // Red rook e5 shields the kings; stepping off the e-file is illegal.
    expect(validateMove(s, 'e5', 'd5')).toEqual({ ok: false, reason: 'ILLEGAL_MOVE' });
    expect(validateMove(s, 'e5', 'e6').ok).toBe(true);
  });

  it('round-trips FEN board + turn (n/b aliases canonicalize to H/E)', () => {
    const fen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
    const { board, turn } = parseFen(fen);
    expect(`${boardToFenPart(board)} ${turn === 'RED' ? 'w' : 'b'}`).toBe(
      'rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR w',
    );
  });

  it('parses squares like the API example (b0 -> c2)', () => {
    expect(parseSquare('b0')).toEqual({ file: 1, rank: 0 });
    expect(parseSquare('c2')).toEqual({ file: 2, rank: 2 });
    expect(() => parseSquare('z9')).toThrow();
  });

  it('detects stalemate (king boxed by rook + pawn, not in check)', () => {
    // Black Ke9; Red Rf8 covers e8/f9, red pawn d8 covers d9.
    const s = createGame('4k4/3P1R3/9/9/9/9/9/9/9/3K5 b - - 0 1');
    expect(s.result).toEqual({ over: true, winner: 'DRAW', reason: 'STALEMATE' });
    expect(isStalemate(s)).toBe(true);
  });

  it('applies quiet moves and tracks the halfmove clock', () => {
    const s = createGame('3k5/9/9/9/9/9/9/9/9/4K4 w - - 0 1');
    const s1 = applyMove(s, 'e0', 'e1');
    expect(s1.halfmoveClock).toBe(1);
    expect(s1.turn).toBe('BLACK');
    expect(s1.moveNumber).toBe(1);
    const s2 = applyMove(s1, 'd9', 'd8');
    expect(s2.moveNumber).toBe(2);
  });

  it('draws after the no-capture limit of quiet moves', () => {
    let s = createGame('3k5/9/9/9/9/9/9/9/9/4K4 w - - 0 1');
    const seq: [string, string][] = [
      ['e0', 'e1'],
      ['d9', 'd8'],
      ['e1', 'e0'],
      ['d8', 'd9'],
      ['e0', 'e1'],
      ['d9', 'd8'],
    ];
    for (const [from, to] of seq) s = applyMove(s, from, to, { threefoldRepetition: 'off', noCaptureLimit: 3 });
    expect(s.halfmoveClock).toBe(6);
    expect(s.result).toEqual({ over: true, winner: 'DRAW', reason: 'DRAW_NO_CAPTURE' });
  });
});
