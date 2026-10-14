import { Controller, computed, inject } from '@solid-mvc/core';
import { QueryClient, skipToken } from '@tanstack/query-core';
import { querySignal } from '@/lib/query';
import type { Metric } from '@/services/fake-api.service';

/**
 * Shell controller: the shell never fetches anything itself — every page
 * lives in its own worker and queries there. This observer watches
 * ['metrics'] with queryFn: skipToken (never fetches), so the data it
 * surfaces arrives purely via BroadcastChannel cache sync from a page
 * worker's QueryClient — cross-thread state without a prop or a request.
 */
@Controller()
export class ShellController {
  private qc = inject(QueryClient);

  readonly metrics = querySignal<Metric[]>(this.qc, {
    queryKey: ['metrics'],
    queryFn: skipToken,
  });

  /** Revenue from the worker-fetched metrics query, header-chip ready. */
  readonly syncedRevenue = computed(() => {
    const m = this.metrics.value.data?.find((x) => x.label === 'Revenue');
    return m ? `$${m.value.toLocaleString()}` : null;
  });
}
