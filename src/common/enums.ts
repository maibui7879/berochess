export enum UserStatus {
  ACTIVE = 'ACTIVE',
  BANNED = 'BANNED',
  INACTIVE = 'INACTIVE',
}

export enum UserRole {
  PLAYER = 'PLAYER',
  SPECTATOR = 'SPECTATOR',
  COMMENTATOR = 'COMMENTATOR',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

export enum MatchMode {
  RANKED = 'RANKED',
  CROWD_MATCH = 'CROWD_MATCH',
  CASUAL = 'CASUAL',
}

export enum MatchStatus {
  WAITING = 'WAITING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED',
}

export enum MatchWinner {
  RED = 'RED',
  BLACK = 'BLACK',
  DRAW = 'DRAW',
}

export enum MatchEndReason {
  CHECKMATE = 'CHECKMATE',
  RESIGN = 'RESIGN',
  TIMEOUT = 'TIMEOUT',
  DRAW = 'DRAW',
  DISCONNECT = 'DISCONNECT',
  FORFEIT = 'FORFEIT',
}

export enum Side {
  RED = 'RED',
  BLACK = 'BLACK',
}

export enum SpectatorTeam {
  NONE = 'NONE',
  RED = 'RED',
  BLACK = 'BLACK',
}

export enum ChatChannel {
  MATCH_CHAT = 'MATCH_CHAT',
  RED_CHAT = 'RED_CHAT',
  BLACK_CHAT = 'BLACK_CHAT',
  COMMENTARY = 'COMMENTARY',
}

export enum RatingType {
  COMPETITIVE = 'COMPETITIVE',
  CROWD = 'CROWD',
  PREDICTION = 'PREDICTION',
}

export enum ReportTarget {
  PLAYER = 'PLAYER',
  SPECTATOR = 'SPECTATOR',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  VOICE = 'VOICE',
  MATCH = 'MATCH',
}

export enum ReportStatus {
  OPEN = 'OPEN',
  REVIEWING = 'REVIEWING',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export enum ModerationActionType {
  MUTE = 'MUTE',
  KICK = 'KICK',
  BAN = 'BAN',
  DELETE_MESSAGE = 'DELETE_MESSAGE',
  SPECTATOR_CONTROL = 'SPECTATOR_CONTROL',
  VOICE_CONTROL = 'VOICE_CONTROL',
}
