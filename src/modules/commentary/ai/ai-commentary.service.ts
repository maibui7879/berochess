import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { UserRole, UserStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import {
  COMMENTARY_GENERATOR,
  AiCommentaryInput,
  CommentaryGenerator,
} from './commentary-generator.interface';
import { CommentaryService } from '../commentary.service';
import { Commentary } from '../entities/commentary.entity';

const BOT_USERNAME = 'ai-binh-luan';

/**
 * Bình luận viên AI: sinh nhận định từ engine sau mỗi nước đi.
 * Fire-and-forget — không bao giờ chặn flow đánh cờ.
 */
@Injectable()
export class AiCommentaryService {
  private readonly logger = new Logger(AiCommentaryService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly commentary: CommentaryService,
    @Optional()
    @Inject(COMMENTARY_GENERATOR)
    private readonly generator?: CommentaryGenerator,
  ) {}

  /** Bot hệ thống (tự tạo lần đầu). */
  async ensureBot(): Promise<User> {
    const existing = await this.users.findOneBy({ username: BOT_USERNAME });
    if (existing) return existing;
    try {
      // Bot không bao giờ đăng nhập (password ngẫu nhiên) nên role chỉ để đủ schema.
      // Kênh COMMENTARY của người do MODERATOR/ADMIN đảm nhiệm.
      return await this.users.save(
        this.users.create({
          username: BOT_USERNAME,
          email: 'ai-binh-luan@system.local',
          passwordHash: await argon2.hash(randomUUID()),
          displayName: 'AI Bình Luận',
          avatarUrl: null,
          status: UserStatus.ACTIVE,
          role: UserRole.PLAYER,
        }),
      );
    } catch {
      const retry = await this.users.findOneBy({ username: BOT_USERNAME });
      if (!retry) throw new Error('Cannot create AI commentator');
      return retry;
    }
  }

  /** Sinh + đăng bình luận nếu nước đi đáng nói. Trả null khi bỏ qua. */
  async maybeComment(input: AiCommentaryInput): Promise<Commentary | null> {
    if (!this.generator) return null;
    try {
      const content = this.generator.generate(input);
      if (!content) return null;
      const bot = await this.ensureBot();
      return await this.commentary.create(bot.id, {
        matchId: input.matchId,
        content,
        metadata: { author: 'ai', generator: 'template', moveNumber: input.moveNumber },
      });
    } catch (e) {
      this.logger.warn(`AI commentary failed: ${(e as Error).message}`);
      return null;
    }
  }
}
