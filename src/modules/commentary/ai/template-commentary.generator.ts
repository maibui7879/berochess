import { crossedRiver, parseFen } from 'xiangqi-engine';
import {
  AiCommentaryInput,
  CommentaryGenerator,
} from './commentary-generator.interface';

const PIECE_NAMES: Record<string, string> = {
  K: 'Tướng',
  A: 'Sĩ',
  E: 'Tượng',
  H: 'Mã',
  R: 'Xe',
  C: 'Pháo',
};

const SIDE_NAMES: Record<string, string> = { RED: 'Đỏ', BLACK: 'Đen' };

const VALUES: Record<string, number> = {
  R: 600,
  H: 270,
  C: 300,
  E: 120,
  A: 120,
  P: 60,
};

function pieceAt(fen: string, square: string): { type: string; color: 'RED' | 'BLACK' } | null {
  const { board } = parseFen(fen);
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square.slice(1));
  return (board[rank]?.[file] as { type: string; color: 'RED' | 'BLACK' } | null) ?? null;
}

function pieceName(type: string, color: string): string {
  if (type === 'P') return color === 'RED' ? 'Tốt' : 'Chốt';
  return PIECE_NAMES[type] ?? type;
}

/** Tổng chất (điểm) từng bên từ FEN. Tốt qua sông +60. */
function material(fen: string): { red: number; black: number } {
  const { board } = parseFen(fen);
  let red = 0;
  let black = 0;
  for (let rank = 0; rank < 10; rank++) {
    for (let file = 0; file < 9; file++) {
      const p = board[rank][file];
      if (!p) continue;
      let v = VALUES[p.type] ?? 0;
      if (p.type === 'P' && crossedRiver(p.color, rank)) v += 60;
      if (p.color === 'RED') red += v;
      else black += v;
    }
  }
  return { red, black };
}

/** Điểm chênh (đỏ - đen) tính theo "điểm" (100 = 1 tốt). */
function leadText(leadPawns: number): string | null {
  const abs = Math.abs(leadPawns);
  if (abs < 1) return null;
  const leader = leadPawns > 0 ? 'Đỏ' : 'Đen';
  return `${leader} hơn ${abs} điểm chất.`;
}

/**
 * Bình luận mẫu suy từ engine: ăn quân, chiếu, hết cờ, khai cuộc, tổng kết.
 * Nước lặng không đáng chú ý -> null (tránh spam).
 */
export class TemplateCommentaryGenerator implements CommentaryGenerator {
  generate(input: AiCommentaryInput): string | null {
    const side = SIDE_NAMES[input.color] ?? input.color;

    if (input.result.over) return this.endText(input);

    if (input.captured) {
      const mover = pieceAt(input.beforeFen, input.from);
      const moverName = pieceName(mover?.type ?? '?', input.color);
      const victimName = pieceName(input.captured, input.color === 'RED' ? 'BLACK' : 'RED');
      const after = material(input.afterFen);
      const leadNow = Math.round((after.red - after.black) / 100);
      const leadPart = leadText(leadNow);
      const checkPart = input.check ? ', chiếu Tướng!' : '.';
      return (
        `${side} dùng ${moverName} ${input.from}–${input.to} ăn ${victimName}${checkPart}` +
        (leadPart ? ` ${leadPart}` : '')
      );
    }

    if (input.check) {
      const mover = pieceAt(input.beforeFen, input.from);
      const moverName = pieceName(mover?.type ?? '?', input.color);
      return `${side} đi ${moverName} ${input.from}–${input.to}, chiếu Tướng!`;
    }

    if (input.moveNumber <= 2) {
      const mover = pieceAt(input.beforeFen, input.from);
      const moverName = pieceName(mover?.type ?? '?', input.color);
      return `Khai cuộc: ${side} triển khai ${moverName} ${input.from}–${input.to}.`;
    }

    if (input.moveNumber % 5 === 0) {
      const after = material(input.afterFen);
      const leadPawns = Math.round((after.red - after.black) / 100);
      if (leadPawns === 0) return `Thế cờ cân bằng sau ${input.moveNumber} nước.`;
      const lead = leadText(leadPawns);
      return lead ? `${lead} (sau ${input.moveNumber} nước).` : null;
    }

    return null;
  }

  private endText(input: AiCommentaryInput): string | null {
    const winner =
      input.result.winner === 'RED' ? 'Đỏ' : input.result.winner === 'BLACK' ? 'Đen' : null;
    switch (input.result.reason) {
      case 'CHECKMATE':
        return winner ? `Chiếu hết! ${winner} thắng ván đấu.` : 'Chiếu hết! Ván đấu kết thúc.';
      case 'KING_CAPTURED':
        return winner ? `Tướng bị bắt. ${winner} thắng!` : 'Tướng bị bắt!';
      case 'STALEMATE':
        return 'Hết nước đi hợp lệ. Ván hòa!';
      case 'DRAW_REPETITION':
        return 'Lặp lại thế cờ ba lần. Ván hòa!';
      case 'DRAW_NO_CAPTURE':
        return 'Lâu không ăn quân. Ván hòa!';
      default:
        return 'Ván đấu kết thúc.';
    }
  }
}
