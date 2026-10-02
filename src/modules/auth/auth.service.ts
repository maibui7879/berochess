import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RatingsService } from '../ratings/ratings.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './entities/refresh-token.entity';

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: User['status'];
  role: User['role'];
  createdAt: Date;
  updatedAt: Date;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function parseDurationMs(input: string, fallbackMs: number): number {
  const m = /^(\d+)(s|m|h|d)$/.exec(input.trim());
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return n * unit;
}

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly ratings: RatingsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto) {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Email already registered');
    }
    if (await this.users.findByUsername(dto.username)) {
      throw new ConflictException('Username already taken');
    }
    const user = await this.users.create({
      username: dto.username,
      email: dto.email,
      password: dto.password,
      displayName: dto.displayName,
    });
    await this.ratings.ensureDefaults(user.id);
    return this.issueTokenPair(toSafeUser(user));
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokenPair(toSafeUser(user));
  }

  async refresh(refreshToken: string) {
    let row: (RefreshToken & { user: User }) | null = null;
    try {
      await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      row = (await this.tokens.findOne({
        where: { tokenHash: sha256(refreshToken), revokedAt: IsNull() },
        relations: { user: true },
      })) as (RefreshToken & { user: User }) | null;
    } catch {
      row = null;
    }
    if (!row || !row.user || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    row.revokedAt = new Date();
    await this.tokens.save(row);
    return this.issueTokenPair(toSafeUser(row.user));
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.tokens.update({ tokenHash: sha256(refreshToken) }, { revokedAt: new Date() });
    return { success: true };
  }

  private async issueTokenPair(user: SafeUser) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExp =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: randomUUID() },
      {
        secret: refreshSecret,
        expiresIn: refreshExp as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );
    await this.tokens.save(
      this.tokens.create({
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + parseDurationMs(refreshExp, 7 * 86_400_000)),
      }),
    );
    return { accessToken, refreshToken, user };
  }
}
