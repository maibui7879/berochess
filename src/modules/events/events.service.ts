import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { GameEventType } from '../../common/enums';
import {
  CHAT_SENT,
  COMMENTARY_CREATED,
  ChatSentPayload,
  CommentaryCreatedPayload,
  GAME_CHECK,
  GAME_ENDED,
  MATCH_CREATED,
  MATCH_STARTED,
  MOVE_PLAYED,
  MatchLifecyclePayload,
  MovePlayedPayload,
  REACTION_SENT,
  ReactionSentPayload,
  SPECTATOR_JOINED,
  SPECTATOR_LEFT,
  SPECTATOR_TEAM_CHANGED,
  SpectatorPayload,
} from '../../common/events';
import { GameEvent } from './entities/game-event.entity';

/**
 * Ghi log bất biến mọi sự kiện match. Fire-and-forget: lỗi ghi log
 * không bao giờ làm hỏng flow chính.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(GameEvent) private readonly events: Repository<GameEvent>,
  ) {}

  async record(
    type: GameEventType,
    matchId: string,
    userId: string | null,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.events.save(
        this.events.create({ type, matchId, userId, payload }),
      );
    } catch (e) {
      this.logger.warn(`event log failed: ${(e as Error).message}`);
    }
  }

  findByMatch(
    matchId: string,
    query: PaginationQueryDto,
    type?: GameEventType,
  ): Promise<GameEvent[]> {
    return this.events.find({
      where: { matchId, ...(type ? { type } : {}) },
      take: Math.min(query.limit ?? 50, 200),
      skip: query.offset ?? 0,
      order: { createdAt: 'ASC' },
    });
  }

  @OnEvent(MATCH_CREATED)
  private onMatchCreated(p: MatchLifecyclePayload): Promise<void> {
    return this.record(GameEventType.MATCH_CREATED, p.matchId, p.userId ?? null, {
      mode: p.mode,
    });
  }

  @OnEvent(MATCH_STARTED)
  private onMatchStarted(p: MatchLifecyclePayload): Promise<void> {
    return this.record(GameEventType.MATCH_STARTED, p.matchId, p.userId ?? null, {});
  }

  @OnEvent(MOVE_PLAYED)
  private onMovePlayed(p: MovePlayedPayload): Promise<void> {
    return this.record(GameEventType.MOVE_PLAYED, p.matchId, p.userId, {
      moveNumber: p.moveNumber,
      from: p.from,
      to: p.to,
      fen: p.fen,
      turn: p.turn,
    });
  }

  @OnEvent(GAME_CHECK)
  private onGameCheck(p: MovePlayedPayload): Promise<void> {
    return this.record(GameEventType.GAME_CHECK, p.matchId, p.userId, {
      moveNumber: p.moveNumber,
      by: p.userId,
    });
  }

  @OnEvent(GAME_ENDED)
  private onGameEnded(p: MatchLifecyclePayload): Promise<void> {
    return this.record(GameEventType.GAME_ENDED, p.matchId, p.userId ?? null, {
      winner: p.winner,
      endReason: p.endReason,
    });
  }

  @OnEvent(SPECTATOR_JOINED)
  private onSpectatorJoined(p: SpectatorPayload): Promise<void> {
    return this.record(GameEventType.SPECTATOR_JOINED, p.matchId, p.userId, {
      team: p.team,
    });
  }

  @OnEvent(SPECTATOR_LEFT)
  private onSpectatorLeft(p: SpectatorPayload): Promise<void> {
    return this.record(GameEventType.SPECTATOR_LEFT, p.matchId, p.userId, {});
  }

  @OnEvent(SPECTATOR_TEAM_CHANGED)
  private onSpectatorTeamChanged(p: SpectatorPayload): Promise<void> {
    return this.record(GameEventType.SPECTATOR_TEAM_CHANGED, p.matchId, p.userId, {
      team: p.team,
    });
  }

  @OnEvent(REACTION_SENT)
  private onReactionSent(p: ReactionSentPayload): Promise<void> {
    return this.record(GameEventType.REACTION_SENT, p.matchId, p.userId, {
      emoji: p.emoji,
    });
  }

  @OnEvent(CHAT_SENT)
  private onChatSent(p: ChatSentPayload): Promise<void> {
    return this.record(GameEventType.CHAT_SENT, p.matchId, p.userId, {
      messageId: p.messageId,
      channel: p.channel,
    });
  }

  @OnEvent(COMMENTARY_CREATED)
  private onCommentaryCreated(p: CommentaryCreatedPayload): Promise<void> {
    return this.record(GameEventType.COMMENTARY_CREATED, p.matchId, p.commentary.userId, {
      commentaryId: p.commentary.id,
    });
  }
}
