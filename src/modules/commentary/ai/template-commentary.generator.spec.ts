import { START_FEN, applyMove, boardToFenPart, createGame } from 'xiangqi-engine';
import { TemplateCommentaryGenerator } from './template-commentary.generator';

function toFen(board: Parameters<typeof boardToFenPart>[0], turn: 'RED' | 'BLACK'): string {
  return `${boardToFenPart(board)} ${turn === 'RED' ? 'w' : 'b'} - - 0 1`;
}

/** Dựng input từ chuỗi nước đi trên bàn khai cuộc. */
function play(moves: Array<[string, string]>) {
  const states: Array<{ before: string; after: string; from: string; to: string; turn: 'RED' | 'BLACK'; n: number }> = [];
  let engine = createGame();
  let n = 0;
  for (const [from, to] of moves) {
    const before = toFen(engine.board, engine.turn);
    const mover = engine.turn;
    engine = applyMove(engine, from, to);
    n++;
    states.push({ before, after: toFen(engine.board, engine.turn), from, to, turn: mover, n });
  }
  return states;
}

describe('template commentary generator', () => {
  const gen = new TemplateCommentaryGenerator();

  it('opens with development moves', () => {
    const [m1] = play([['b0', 'c2']]);
    const text = gen.generate({
      matchId: 'm',
      moveNumber: 1,
      color: 'RED',
      from: m1.from,
      to: m1.to,
      beforeFen: m1.before,
      afterFen: m1.after,
      captured: null,
      check: false,
      result: { over: false },
    });
    expect(text).toContain('Khai cuộc');
    expect(text).toContain('Mã');
  });

  it('stays silent on quiet mid-game moves', () => {
    const seq = play([
      ['b0', 'c2'],
      ['b9', 'c7'],
      ['h0', 'g2'],
    ]);
    const m3 = seq[2];
    const text = gen.generate({
      matchId: 'm',
      moveNumber: 3,
      color: 'RED',
      from: m3.from,
      to: m3.to,
      beforeFen: m3.before,
      afterFen: m3.after,
      captured: null,
      check: false,
      result: { over: false },
    });
    expect(text).toBeNull();
  });

  it('narrates captures with material lead', () => {
    const seq = play([
      ['e3', 'e4'],
      ['e6', 'e5'],
      ['e4', 'e5'],
    ]);
    const cap = seq[2];
    const text = gen.generate({
      matchId: 'm',
      moveNumber: 3,
      color: 'RED',
      from: cap.from,
      to: cap.to,
      beforeFen: cap.before,
      afterFen: cap.after,
      captured: 'P',
      check: false,
      result: { over: false },
    });
    expect(text).toContain('ăn Chốt');
    expect(text).toContain('Đỏ');
  });

  it('announces checkmate', () => {
    const text = gen.generate({
      matchId: 'm',
      moveNumber: 20,
      color: 'RED',
      from: 'a9',
      to: 'e9',
      beforeFen: START_FEN,
      afterFen: START_FEN,
      captured: null,
      check: true,
      result: { over: true, winner: 'RED', reason: 'CHECKMATE' },
    });
    expect(text).toContain('Chiếu hết');
    expect(text).toContain('Đỏ');
  });

  it('summarizes every 5 moves', () => {
    const text = gen.generate({
      matchId: 'm',
      moveNumber: 5,
      color: 'BLACK',
      from: 'b9',
      to: 'c7',
      beforeFen: START_FEN,
      afterFen: START_FEN,
      captured: null,
      check: false,
      result: { over: false },
    });
    expect(text).toContain('cân bằng');
  });
});
