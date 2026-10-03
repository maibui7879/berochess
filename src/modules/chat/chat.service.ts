import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ChatChannel, SpectatorTeam, UserRole } from '../../common/enums';
import { CHAT_SENT } from '../../common/events';
import { MatchesService } from '../matches/matches.service';
import { ModerationService } from '../moderation/moderation.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatMessage } from './entities/chat-message.entity';

const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 5;

@Injectable()
export class ChatService {
  /** userId -> timestamps gửi (ms). In-memory cho single instance (Redis ở Phase scale). */
  private readonly buckets = new Map<string, number[]>();
  private readonly lastContent = new Map<string, { content: string; at: number }>();

  constructor(
    @InjectRepository(ChatMessage) private readonly messages: Repository<ChatMessage>,
    private readonly matches: MatchesService,
    private readonly moderation: ModerationService,
    private readonly domainEvents: EventEmitter2,
  ) {}

  findByMatch(
    matchId: string,
    query: PaginationQueryDto,
    channel?: ChatChannel,
  ): Promise<ChatMessage[]> {
    return this.messages.find({
      where: { matchId, deletedAt: IsNull(), ...(channel ? { channel } : {}) },
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }

  /** Gửi tin nhắn: check kênh + mute/ban + rate limit rồi mới persist. Dùng chung REST + WS. */
  async sendMessage(userId: string, role: UserRole, dto: CreateMessageDto): Promise<ChatMessage> {
    const match = await this.matches.findOne(dto.matchId);
    void match;
    const players = await this.matches.findPlayers(dto.matchId);
    const spectators = await this.matches.findSpectators(dto.matchId);
    this.assertChannelAccess(userId, role, dto.channel, players, spectators);
    if (await this.moderation.isBanned(userId)) {
      throw new ForbiddenException('BANNED');
    }
    if (await this.moderation.isMuted(userId, dto.matchId)) {
      throw new ForbiddenException('MUTED');
    }
    this.assertRateLimit(userId, dto.content);
    const saved = await this.messages.save(
      this.messages.create({
        matchId: dto.matchId,
        userId,
        channel: dto.channel,
        content: dto.content.trim(),
      }),
    );
    this.domainEvents.emit(CHAT_SENT, {
      matchId: saved.matchId,
      userId,
      messageId: saved.id,
      channel: saved.channel,
    });
    return saved;
  }

  private assertChannelAccess(
    userId: string,
    role: UserRole,
    channel: ChatChannel,
    players: Array<{ userId: string; color: string }>,
    spectators: Array<{ userId: string; team: SpectatorTeam }>,
  ): void {
    if (channel === ChatChannel.COMMENTARY) {
      if (role !== UserRole.MODERATOR && role !== UserRole.ADMIN) {
        throw new ForbiddenException('MODERATOR_ONLY');
      }
      return;
    }
    if (channel === ChatChannel.MATCH_CHAT) return; // mở cho mọi user đã login
    const mine = players.find((p) => p.userId === userId);
    const myTeam = spectators.find((s) => s.userId === userId)?.team;
    const want: SpectatorTeam = channel === ChatChannel.RED_CHAT ? SpectatorTeam.RED : SpectatorTeam.BLACK;
    const isPlayer = mine?.color === want;
    if (!isPlayer && myTeam !== want) throw new ForbiddenException('TEAM_ONLY');
  }

  private assertRateLimit(userId: string, content: string): void {
    const now = Date.now();
    const prev = (this.buckets.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    const last = this.lastContent.get(userId);
    if (last && last.content === content.trim() && now - last.at < RATE_WINDOW_MS) {
      throw new ForbiddenException('DUPLICATE');
    }
    if (prev.length >= RATE_MAX) throw new ForbiddenException('RATE_LIMITED');
    prev.push(now);
    this.buckets.set(userId, prev);
    if (this.buckets.size > 10_000) {
      const first = this.buckets.keys().next();
      if (!first.done) this.buckets.delete(first.value);
    }
    this.lastContent.set(userId, { content: content.trim(), at: now });
  }

  /** Xóa mềm — chủ tin nhắn hoặc MODERATOR+. Trả message để broadcast. */
  async softDelete(id: string, userId: string, role: UserRole): Promise<ChatMessage> {
    const msg = await this.messages.findOneBy({ id });
    if (!msg) throw new NotFoundException('Message not found');
    const isOwner = msg.userId === userId;
    const isMod = role === UserRole.MODERATOR || role === UserRole.ADMIN;
    if (!isOwner && !isMod) throw new ForbiddenException('Cannot delete this message');
    msg.deletedAt = new Date();
    return this.messages.save(msg);
  }
}
