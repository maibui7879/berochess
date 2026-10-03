/** Đầu vào phân tích cho AI bình luận (suy từ engine, không đoán mò). */
export interface AiCommentaryInput {
  matchId: string;
  moveNumber: number;
  /** Bên vừa đi: 'RED' | 'BLACK'. */
  color: 'RED' | 'BLACK';
  from: string;
  to: string;
  beforeFen: string;
  afterFen: string;
  captured: string | null;
  check: boolean;
  result: { over: boolean; winner?: string; reason?: string };
}

/** Bộ sinh bình luận — hiện tại template, sau này cắm LLM mà không sửa pipeline. */
export interface CommentaryGenerator {
  generate(input: AiCommentaryInput): string | null;
}

export const COMMENTARY_GENERATOR = 'COMMENTARY_GENERATOR';
