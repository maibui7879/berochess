import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

/** Dùng cho Gateway (Phase 6+). Xác thực JWT từ handshake, gắn user vào client.data. */
@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const fromAuth = client.handshake.auth?.['token'] as string | undefined;
    const fromHeader = client.handshake.headers.authorization?.replace('Bearer ', '');
    const token = fromAuth ?? fromHeader;
    if (!token) throw new UnauthorizedException('Missing WS token');
    try {
      const payload = await this.jwt.verifyAsync(token);
      client.data.user = {
        userId: payload.sub,
        username: payload.username,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid WS token');
    }
  }
}
