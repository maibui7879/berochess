import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('exposes business counters in Prometheus text format', async () => {
    const metrics = new MetricsService();
    metrics.moves.inc({ color: 'RED' });
    metrics.matchesCreated.inc({ mode: 'RANKED' });
    metrics.matchesFinished.inc({ end_reason: 'RESIGN', winner: 'BLACK' });
    const text = await metrics.text();
    expect(text).toContain('xiangqi_moves_total{color="RED"} 1');
    expect(text).toContain('xiangqi_matches_created_total{mode="RANKED"} 1');
    expect(text).toContain('xiangqi_matches_finished_total{end_reason="RESIGN",winner="BLACK"} 1');
    expect(text).toContain('nodejs_heap_size_total_bytes');
    expect(metrics.contentType).toContain('text/plain');
  });
});
