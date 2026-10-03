import { START_FEN, applyMove, createGame, getLegalMoves, validateMove } from 'xiangqi-engine';

/** Proves the backend resolves the file-linked xiangqi-engine package. */
describe('xiangqi-engine integration', () => {
  it('exposes the standard initial position', () => {
    const game = createGame();
    expect(game.turn).toBe('RED');
    expect(game.moveNumber).toBe(1);
    expect(game.result.over).toBe(false);
    expect(START_FEN).toContain('rnbakabnr');
  });

  it('validates and applies an opening horse move (b0 -> c2)', () => {
    const game = createGame();
    expect(validateMove(game, 'b0', 'c2').ok).toBe(true);
    const next = applyMove(game, 'b0', 'c2');
    expect(next.turn).toBe('BLACK');
    expect(getLegalMoves(next, 'c2')).toHaveLength(0); // black to move: not its piece
  });

  it('rejects illegal moves', () => {
    const game = createGame();
    expect(validateMove(game, 'e0', 'e5')).toEqual({ ok: false, reason: 'ILLEGAL_MOVE' });
  });
});
