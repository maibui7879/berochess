import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Redis client dùng chung (queue matchmaking, presence, rate limit tương lai). */
@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      inject: [ConfigService],
      useFactory: (cs: ConfigService): Redis => {
        const logger = new Logger('RedisModule');
        const client = new Redis(cs.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        });
        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (e: Error) => logger.warn(`Redis error: ${e.message}`));
        return client;
      },
    },
  ],
  exports: ['REDIS'],
})
export class RedisModule {}
