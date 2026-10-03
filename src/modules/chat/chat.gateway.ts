import { HttpException, UseGuards, UsePipes } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { Public } from '../../common/decorators/public.decorator';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard';
import { WS_VALIDATION_PIPE, withWsJwt } from '../../common/ws/ws-utils';
import { UserRole } from '../../common/enums';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';

type AuthedSocket = Socket & {
  data: { user?: { userId: string; username: string; role: UserRole }; matches?: Set<string> };
};

const roomOf = (matchId: string) => `match:${matchId}`;

/** Realtime chat (chung namespace /game, chung room match:{id} với GameGateway). */
@Public()
@UseGuards(WsAuthGuard)
@WebSocketGateway({ namespace: '/game', cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server): void {
    withWsJwt(this.jwt, server);
  }

  @UsePipes(WS_VALIDATION_PIPE)
  @SubscribeMessage('chat:send')
  async handleSend(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() dto: CreateMessageDto,
  ) {
    const user = client.data.user;
    if (!user) return { ok: false, reason: 'UNAUTHENTICATED' };
    try {
      const message = await this.chat.sendMessage(user.userId, user.role, dto);
      this.server.to(roomOf(dto.matchId)).emit('chat:message', { message });
      return { ok: true, message };
    } catch (e) {
      if (e instanceof HttpException) return { ok: false, reason: e.message };
      return { ok: false, reason: 'SEND_FAILED' };
    }
  }

  @UsePipes(WS_VALIDATION_PIPE)
  @SubscribeMessage('chat:delete')
  async handleDelete(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() dto: DeleteMessageDto,
  ) {
    const user = client.data.user;
    if (!user) return { ok: false, reason: 'UNAUTHENTICATED' };
    try {
      const message = await this.chat.softDelete(dto.id, user.userId, user.role);
      this.server
        .to(roomOf(message.matchId))
        .emit('chat:deleted', { id: message.id, matchId: message.matchId });
      return { ok: true };
    } catch (e) {
      if (e instanceof HttpException) return { ok: false, reason: e.message };
      return { ok: false, reason: 'DELETE_FAILED' };
    }
  }
}
