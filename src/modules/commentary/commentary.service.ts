import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { COMMENTARY_CREATED, CommentaryCreatedPayload } from '../../common/events';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UserRole } from '../../common/enums';
import { CreateCommentaryDto } from './dto/create-commentary.dto';
import { Commentary } from './entities/commentary.entity';

@Injectable()
export class CommentaryService {
  constructor(
    @InjectRepository(Commentary)
    private readonly commentaries: Repository<Commentary>,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateCommentaryDto): Promise<Commentary> {
    const saved = await this.commentaries.save(
      this.commentaries.create({
        matchId: dto.matchId,
        userId,
        content: dto.content,
        metadata: dto.metadata ?? null,
      }),
    );
    const payload: CommentaryCreatedPayload = {
      matchId: saved.matchId,
      commentary: {
        id: saved.id,
        userId: saved.userId,
        content: saved.content,
        createdAt: saved.createdAt,
      },
    };
    this.events.emit(COMMENTARY_CREATED, payload);
    return saved;
  }

  findByMatch(matchId: string, query: PaginationQueryDto): Promise<Commentary[]> {
    return this.commentaries.find({
      where: { matchId },
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: string): Promise<Commentary | null> {
    return this.commentaries.findOneBy({ id });
  }

  /** Xóa — tác giả hoặc MODERATOR+. */
  async remove(id: string, userId: string, role: UserRole): Promise<void> {
    const item = await this.findOne(id);
    if (!item) throw new NotFoundException('Commentary not found');
    const isOwner = item.userId === userId;
    const isMod = role === UserRole.MODERATOR || role === UserRole.ADMIN;
    if (!isOwner && !isMod) throw new ForbiddenException('Cannot delete this commentary');
    await this.commentaries.delete(id);
  }
}
