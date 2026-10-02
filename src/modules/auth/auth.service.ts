import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
  ) {}

  countActiveSessions(userId: string): Promise<number> {
    return this.tokens.count({ where: { userId, revokedAt: IsNull() } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.update({ userId }, { revokedAt: new Date() });
  }
}
