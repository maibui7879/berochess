import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchStatus } from '../../common/enums';
import { GameEvent } from '../events/entities/game-event.entity';
import { Move } from '../game/entities/move.entity';
import { Match } from '../matches/entities/match.entity';
import { User } from '../users/entities/user.entity';

export interface SystemStats {
  users: number;
  matches: Record<string, number>;
  moves: number;
  events: number;
  at: string;
}

/** Đọc số liệu tổng quan hệ thống cho admin. */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(Move) private readonly moves: Repository<Move>,
    @InjectRepository(GameEvent) private readonly events: Repository<GameEvent>,
  ) {}

  async stats(): Promise<SystemStats> {
    const [users, moves, events] = await Promise.all([
      this.users.count(),
      this.moves.count(),
      this.events.count(),
    ]);
    const byStatus = await this.matches
      .createQueryBuilder('m')
      .select('m.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.status')
      .getRawMany<{ status: string; count: string }>();
    const matches: Record<string, number> = {};
    for (const s of Object.values(MatchStatus)) matches[s] = 0;
    for (const row of byStatus) matches[row.status] = Number(row.count);
    return { users, matches, moves, events, at: new Date().toISOString() };
  }
}
