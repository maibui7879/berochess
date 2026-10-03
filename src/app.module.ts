import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { ObservabilityModule } from './observability/observability.module';
import { RedisModule } from './redis/redis.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { CommentaryModule } from './modules/commentary/commentary.module';
import { CrowdModule } from './modules/crowd/crowd.module';
import { GameModule } from './modules/game/game.module';
import { MatchesModule } from './modules/matches/matches.module';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { UsersModule } from './modules/users/users.module';

function buildTypeOrmConfig(cs: ConfigService) {
  // Ưu tiên POOL_URL (IPv4 pooler) > DATABASE_URL (direct IPv6)
  const url = cs.get<string>('DATABASE_POOL_URL') || cs.get<string>('DATABASE_URL')!;
  const ssl = cs.get<string>('DATABASE_SSL') === 'true';
  const isPooler = url.includes(':6543') || url.includes('pgbouncer=true');
  return {
    type: 'postgres' as const,
    url,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    autoLoadEntities: true,
    synchronize: true,
    logging: cs.get<string>('NODE_ENV') !== 'production' ? ['warn', 'error'] as never : (false as never),
    extra: isPooler ? { max: 10, idleTimeoutMillis: 30000 } : { max: 10 },
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: envValidationSchema,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
      },
    }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: buildTypeOrmConfig }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 200 }]),
    RedisModule,
    ObservabilityModule,
    HealthModule,
    UsersModule,
    AuthModule,
    MatchesModule,
    GameModule,
    RatingsModule,
    ChatModule,
    CrowdModule,
    CommentaryModule,
    ModerationModule,
    MatchmakingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
