import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MatchEndReason, MatchMode, MatchStatus, MatchWinner, Side, UserRole } from '../../common/enums';
import { CreateMatchDto } from './dto/create-match.dto';
import { JoinMatchDto } from './dto/join-match.dto';
import { SpectatorTeamDto } from './dto/spectator-team.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchPlayer } from './entities/match-player.entity';
import { MatchSpectator } from './entities/match-spectator.entity';
import { Match } from './entities/match.entity';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(MatchPlayer) private readonly players: Repository<MatchPlayer>,
    @InjectRepository(MatchSpectator)
    private readonly spectators: Repository<MatchSpectator>,
  ) {}

  /** Tạo match — người tạo ngồi ghế RED. */
  async create(creatorId: string, dto: CreateMatchDto): Promise<Match> {
    const match = await this.matches.save(
      this.matches.create({
        mode: dto.mode ?? MatchMode.CASUAL,
        status: MatchStatus.WAITING,
        redPlayerId: creatorId,
        blackPlayerId: null,
        ruleSet: dto.ruleSet ?? {},
      }),
    );
    await this.players.save(
      this.players.create({ matchId: match.id, userId: creatorId, color: Side.RED }),
    );
    return match;
  }

  findAll(query: PaginationQueryDto): Promise<Match[]> {
    return this.matches.find({
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Match> {
    const match = await this.matches.findOneBy({ id });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  /** Join ghế trống (ưu tiên màu yêu cầu). Đủ 2 người → READY. */
  async join(userId: string, matchId: string, dto: JoinMatchDto): Promise<MatchPlayer> {
    const match = await this.findOne(matchId);
    if (match.status === MatchStatus.FINISHED) {
      throw new ConflictException('Match already finished');
    }
    const existing = await this.players.findOneBy({ matchId, userId });
    if (existing) return existing;

    const taken = new Set(
      (await this.players.findBy({ matchId })).map((p) => p.color),
    );
    const color =
      dto.color && !taken.has(dto.color)
        ? dto.color
        : ([Side.RED, Side.BLACK] as const).find((c) => !taken.has(c));
    if (!color) throw new ConflictException('Match is full');

    const player = await this.players.save(
      this.players.create({ matchId, userId, color, joinedAt: new Date() }),
    );
    if (color === Side.RED) match.redPlayerId = userId;
    else match.blackPlayerId = userId;
    if (match.redPlayerId && match.blackPlayerId && match.status === MatchStatus.WAITING) {
      match.status = MatchStatus.READY;
    }
    await this.matches.save(match);
    return player;
  }

  async leave(userId: string, matchId: string): Promise<void> {
    const player = await this.players.findOneBy({ matchId, userId });
    if (!player) throw new NotFoundException('Not a player of this match');
    player.leftAt = new Date();
    await this.players.save(player);
    const match = await this.findOne(matchId);
    if (match.status === MatchStatus.READY) {
      match.status = MatchStatus.WAITING;
      await this.matches.save(match);
    }
  }

  /** Báo sẵn sàng. Cả 2 ready → PLAYING. */
  async setReady(userId: string, matchId: string): Promise<Match> {
    const player = await this.players.findOneBy({ matchId, userId });
    if (!player) throw new NotFoundException('Not a player of this match');
    player.isReady = true;
    await this.players.save(player);
    const match = await this.findOne(matchId);
    const all = await this.players.findBy({ matchId });
    if (all.length === 2 && all.every((p) => p.isReady) && match.status === MatchStatus.READY) {
      match.status = MatchStatus.PLAYING;
      match.startedAt = new Date();
      await this.matches.save(match);
    }
    return match;
  }

  /** Đầu hàng — đối thủ thắng, match FINISHED. */
  async resign(userId: string, matchId: string): Promise<Match> {
    const match = await this.findOne(matchId);
    if (match.status !== MatchStatus.PLAYING && match.status !== MatchStatus.READY) {
      throw new ConflictException('Match is not in progress');
    }
    if (userId !== match.redPlayerId && userId !== match.blackPlayerId) {
      throw new ForbiddenException('Only players can resign');
    }
    match.winner = userId === match.redPlayerId ? MatchWinner.BLACK : MatchWinner.RED;
    match.endReason = MatchEndReason.RESIGN;
    match.status = MatchStatus.FINISHED;
    match.endedAt = new Date();
    return this.matches.save(match);
  }

  async update(
    userId: string,
    role: UserRole,
    matchId: string,
    dto: UpdateMatchDto,
  ): Promise<Match> {
    const match = await this.findOne(matchId);
    const isParticipant = userId === match.redPlayerId || userId === match.blackPlayerId;
    if (!isParticipant && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only participants or admin can update match');
    }
    if (dto.status !== undefined && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can force status');
    }
    Object.assign(match, dto);
    return this.matches.save(match);
  }

  /** Xóa match — admin only (check ở controller). */
  async remove(matchId: string): Promise<void> {
    await this.findOne(matchId);
    await this.matches.delete(matchId);
  }

  findPlayers(matchId: string): Promise<MatchPlayer[]> {
    return this.players.findBy({ matchId });
  }

  findSpectators(matchId: string): Promise<MatchSpectator[]> {
    return this.spectators.findBy({ matchId });
  }

  async joinSpectators(
    userId: string,
    matchId: string,
    dto: SpectatorTeamDto,
  ): Promise<MatchSpectator> {
    await this.findOne(matchId);
    const existing = await this.spectators.findOneBy({ matchId, userId });
    if (existing) {
      existing.team = dto.team;
      return this.spectators.save(existing);
    }
    return this.spectators.save(
      this.spectators.create({ matchId, userId, team: dto.team }),
    );
  }

  async leaveSpectators(userId: string, matchId: string): Promise<void> {
    await this.spectators.delete({ matchId, userId });
  }
}
