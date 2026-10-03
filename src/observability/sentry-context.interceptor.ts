import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Observable } from 'rxjs';

/** Gắn user + matchId vào Sentry scope (no-op khi chưa cấu hình DSN). */
@Injectable()
export class SentryContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest();
      const user = req?.user;
      if (user?.userId) {
        Sentry.setUser({ id: user.userId, username: user.username });
      }
      const matchId = req?.params?.matchId ?? req?.params?.id;
      if (typeof matchId === 'string') Sentry.setTag('matchId', matchId);
    }
    return next.handle();
  }
}
