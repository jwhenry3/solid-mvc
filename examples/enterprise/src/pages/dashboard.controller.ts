import { Controller, inject, signal } from '@solid-mvc/core';
import { QueryClient } from '@tanstack/query-core';
import { FakeApi, type Metric } from '@/services/fake-api.service';
import { querySignal } from '@/lib/query';

/**
 * Controller layer for DashboardView: owns the data queries and
 * presentation-ready metric formatting. render() reads signals and
 * delegates — nothing in the view knows about TanStack or the FakeApi.
 */
@Controller()
export class DashboardController {
  private api = inject(FakeApi);
  private qc = inject(QueryClient);

  // Signal-backed queries — each observer lives on this controller's
  // scope (the declaring view's injector) and dies with it.
  metrics = querySignal(this.qc, {
    queryKey: ['metrics'],
    queryFn: () => this.api.metrics(),
  });
  revenue = querySignal(this.qc, {
    queryKey: ['revenue'],
    queryFn: () => this.api.revenueSeries(),
  });
  activity = querySignal(this.qc, {
    queryKey: ['activity'],
    queryFn: () => this.api.activity(),
  });

  /** Last event payload from the ticker island — its emit() travels one
   *  hop: the ticker sub-worker's onEvent lands here, inside the dashboard
   *  worker. */
  lastPing = signal('');

  onIslandEvent(name: string, payload: unknown): void {
    this.lastPing.value = `${name} ${JSON.stringify(payload)}`;
  }

  /** Presentation-ready metric — the currency/delta rules live here, not in JSX. */
  metricView(m: Metric): { value: string; up: boolean; delta: string } {
    return {
      value:
        m.label === 'Revenue'
          ? `$${m.value.toLocaleString()}`
          : m.value.toLocaleString(),
      up: m.delta >= 0,
      delta: `${Math.abs(m.delta)}%`,
    };
  }
}
