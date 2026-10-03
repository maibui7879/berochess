import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/** Metrics Prometheus: counters business + default Node.js (RAM, event loop). */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequests: Counter<'method' | 'route' | 'status'>;
  readonly httpDuration: Histogram<'method' | 'route' | 'status'>;
  readonly moves: Counter<'color'>;
  readonly matchesCreated: Counter<'mode'>;
  readonly matchesFinished: Counter<'end_reason' | 'winner'>;
  readonly pairs: Counter<'mode'>;
  readonly wsConnections: Gauge<'gateway'>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });
    const prefix = 'xiangqi_';
    this.httpRequests = new Counter({
      name: `${prefix}http_requests_total`,
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    this.httpDuration = new Histogram({
      name: `${prefix}http_request_duration_seconds`,
      help: 'HTTP request duration',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
    this.moves = new Counter({
      name: `${prefix}moves_total`,
      help: 'Validated moves played',
      labelNames: ['color'],
      registers: [this.registry],
    });
    this.matchesCreated = new Counter({
      name: `${prefix}matches_created_total`,
      help: 'Matches created',
      labelNames: ['mode'],
      registers: [this.registry],
    });
    this.matchesFinished = new Counter({
      name: `${prefix}matches_finished_total`,
      help: 'Matches finished',
      labelNames: ['end_reason', 'winner'],
      registers: [this.registry],
    });
    this.pairs = new Counter({
      name: `${prefix}matchmaking_pairs_total`,
      help: 'Matchmaking pairs formed',
      labelNames: ['mode'],
      registers: [this.registry],
    });
    this.wsConnections = new Gauge({
      name: `${prefix}ws_connections`,
      help: 'Active WebSocket connections',
      labelNames: ['gateway'],
      registers: [this.registry],
    });
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  text(): Promise<string> {
    return this.registry.metrics();
  }
}
