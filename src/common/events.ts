/** Tên domain events dùng chung (EventEmitter2). */
export const COMMENTARY_CREATED = 'commentary.created';
export const MATCH_CREATED = 'match.created';
export const MATCH_STARTED = 'match.started';
export const MOVE_PLAYED = 'move.played';
export const GAME_CHECK = 'game.check';
export const GAME_ENDED = 'game.ended';
export const SPECTATOR_JOINED = 'spectator.joined';
export const SPECTATOR_LEFT = 'spectator.left';
export const SPECTATOR_TEAM_CHANGED = 'spectator.team-changed';
export const REACTION_SENT = 'reaction.sent';
export const CHAT_SENT = 'chat.sent';

export interface CommentaryCreatedPayload {
  matchId: string;
  commentary: {
    id: string;
    userId: string;
    content: string;
    createdAt: Date;
  };
}

export interface MatchLifecyclePayload {
  matchId: string;
  userId?: string;
  mode?: string;
  winner?: string;
  endReason?: string;
}

export interface MovePlayedPayload {
  matchId: string;
  userId: string;
  moveNumber: number;
  from: string;
  to: string;
  fen: string;
  turn: string;
  check: boolean;
}

export interface SpectatorPayload {
  matchId: string;
  userId: string;
  team?: string;
}

export interface ReactionSentPayload {
  matchId: string;
  userId: string;
  emoji: string;
}

export interface ChatSentPayload {
  matchId: string;
  userId: string;
  messageId: string;
  channel: string;
}
