import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

/** ValidationPipe dùng chung cho mọi gateway. */
export const WS_VALIDATION_PIPE = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

/** Middleware verify JWT tại handshake (socket không token -> connect_error). */
export function wsJwtMiddleware(jwt: JwtService) {
  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token =
        (socket.handshake.auth?.['token'] as string | undefined) ??
        socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Missing WS token'));
      const payload = await jwt.verifyAsync(token);
      socket.data.user = {
        userId: payload.sub,
        username: payload.username,
        role: payload.role,
      };
      next();
    } catch {
      next(new Error('Invalid WS token'));
    }
  };
}

export function withWsJwt(jwt: JwtService, server: Server): void {
  server.use(wsJwtMiddleware(jwt));
}
