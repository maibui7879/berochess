/** Tên domain events dùng chung (EventEmitter2). */
export const COMMENTARY_CREATED = 'commentary.created';

export interface CommentaryCreatedPayload {
  matchId: string;
  commentary: {
    id: string;
    userId: string;
    content: string;
    createdAt: Date;
  };
}
