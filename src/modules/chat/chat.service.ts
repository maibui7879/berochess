import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ChatChannel, UserRole } from '../../common/enums';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatMessage } from './entities/chat-message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage) private readonly messages: Repository<ChatMessage>,
  ) {}

  findByMatch(
    matchId: string,
    query: PaginationQueryDto,
    channel?: ChatChannel,
  ): Promise<ChatMessage[]> {
    return this.messages.find({
      where: { matchId, ...(channel ? { channel } : {}) },
      take: Math.min(query.limit ?? 20, 100),
      skip: query.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
  }

  create(userId: string, dto: CreateMessageDto): Promise<ChatMessage> {
    return this.messages.save(
      this.messages.create({
        matchId: dto.matchId,
        userId,
        channel: dto.channel,
        content: dto.content.trim(),
      }),
    );
  }

  /** Xóa mềm — chủ tin nhắn hoặc MODERATOR+. */
  async softDelete(id: string, userId: string, role: UserRole): Promise<void> {
    const msg = await this.messages.findOneBy({ id });
    if (!msg) throw new NotFoundException('Message not found');
    const isOwner = msg.userId === userId;
    const isMod = role === UserRole.MODERATOR || role === UserRole.ADMIN;
    if (!isOwner && !isMod) throw new ForbiddenException('Cannot delete this message');
    msg.deletedAt = new Date();
    await this.messages.save(msg);
  }
}
