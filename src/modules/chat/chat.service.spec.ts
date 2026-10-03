import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatChannel, SpectatorTeam, UserRole } from '../../common/enums';
import { MatchesService } from '../matches/matches.service';
import { ModerationService } from '../moderation/moderation.service';
import { ChatService } from './chat.service';
import { ChatMessage } from './entities/chat-message.entity';

describe('ChatService send rules', () => {
  let service: ChatService;
  const saved: ChatMessage[] = [];

  const messagesRepo = {
    save: jest.fn((m: ChatMessage) => {
      const row = { ...m, id: `msg-${saved.length + 1}`, createdAt: new Date() };
      saved.push(row);
      return Promise.resolve(row);
    }),
    create: jest.fn((m: Partial<ChatMessage>) => m),
    find: jest.fn(() => Promise.resolve(saved)),
    findOneBy: jest.fn(() => Promise.resolve(saved[0] ?? null)),
  };
  const matchesService = {
    findOne: jest.fn(() => Promise.resolve({ id: 'match-1' })),
    findPlayers: jest.fn(() =>
      Promise.resolve([
        { userId: 'red-user', color: 'RED' },
        { userId: 'black-user', color: 'BLACK' },
      ]),
    ),
    findSpectators: jest.fn(() =>
      Promise.resolve([{ userId: 'fan-red', team: SpectatorTeam.RED }]),
    ),
  };
  const moderationService = { isBanned: jest.fn(() => Promise.resolve(false)), isMuted: jest.fn(() => Promise.resolve(false)) };

  beforeEach(async () => {
    saved.length = 0;
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(ChatMessage), useValue: messagesRepo },
        { provide: MatchesService, useValue: matchesService },
        { provide: ModerationService, useValue: moderationService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get<ChatService>(ChatService);
  });

  const base = { matchId: 'match-1', channel: ChatChannel.MATCH_CHAT, content: 'hello' };

  it('sends MATCH_CHAT for any logged-in user', async () => {
    const msg = await service.sendMessage('random-user', UserRole.PLAYER, { ...base });
    expect(msg.content).toBe('hello');
  });

  it('restricts RED_CHAT to red side', async () => {
    await expect(
      service.sendMessage('black-user', UserRole.PLAYER, { ...base, channel: ChatChannel.RED_CHAT, content: 'x1' }),
    ).rejects.toThrow('TEAM_ONLY');
    await expect(
      service.sendMessage('fan-red', UserRole.SPECTATOR, { ...base, channel: ChatChannel.RED_CHAT, content: 'x2' }),
    ).resolves.toBeDefined();
    await expect(
      service.sendMessage('red-user', UserRole.PLAYER, { ...base, channel: ChatChannel.BLACK_CHAT, content: 'x3' }),
    ).rejects.toThrow('TEAM_ONLY');
  });

  it('restricts COMMENTARY channel to moderators+', async () => {
    await expect(
      service.sendMessage('red-user', UserRole.PLAYER, { ...base, channel: ChatChannel.COMMENTARY, content: 'c1' }),
    ).rejects.toThrow('MODERATOR_ONLY');
    await expect(
      service.sendMessage('mod', UserRole.MODERATOR, { ...base, channel: ChatChannel.COMMENTARY, content: 'c2' }),
    ).resolves.toBeDefined();
  });

  it('rate-limits after 5 messages / 10s', async () => {
    for (let i = 0; i < 5; i++) {
      await service.sendMessage('spammer', UserRole.PLAYER, { ...base, content: `m${i}` });
    }
    await expect(
      service.sendMessage('spammer', UserRole.PLAYER, { ...base, content: 'm5' }),
    ).rejects.toThrow('RATE_LIMITED');
  });

  it('rejects immediate duplicates', async () => {
    await service.sendMessage('echo', UserRole.PLAYER, { ...base, content: 'same' });
    await expect(
      service.sendMessage('echo', UserRole.PLAYER, { ...base, content: 'same' }),
    ).rejects.toThrow('DUPLICATE');
  });

  it('blocks muted and banned users', async () => {
    (moderationService.isMuted as jest.Mock).mockResolvedValueOnce(true);
    await expect(
      service.sendMessage('muted-user', UserRole.PLAYER, { ...base, content: 'mm' }),
    ).rejects.toThrow('MUTED');
    (moderationService.isBanned as jest.Mock).mockResolvedValueOnce(true);
    await expect(
      service.sendMessage('banned-user', UserRole.PLAYER, { ...base, content: 'bb' }),
    ).rejects.toThrow('BANNED');
  });

  it('lets owners delete, blocks strangers', async () => {
    const msg = await service.sendMessage('owner', UserRole.PLAYER, { ...base, content: 'bye' });
    await expect(service.softDelete(msg.id, 'stranger', UserRole.PLAYER)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.softDelete(msg.id, 'owner', UserRole.PLAYER)).resolves.toBeDefined();
  });
});
