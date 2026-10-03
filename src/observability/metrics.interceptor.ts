import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/** Đo mọi HTTP request (method/route/status/duration). Bỏ qua WS context. */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const method = req?.method ?? 'UNKNOWN';
    const route = req?.route?.path ?? 'unmatched';
    const start = performance.now();
    const done = (status: number): void => {
      const labels = { method, route, status: String(status) };
      this.metrics.httpRequests.inc(labels);
      this.metrics.httpDuration.observe(labels, (performance.now() - start) / 1000);
    };
    return next.handle().pipe(
      tap({
        next: () => done(req?.res?.statusCode ?? 200),
        error: (err: { status?: number }) => done(err?.status ?? 500),
      }),
    );
  }
}
