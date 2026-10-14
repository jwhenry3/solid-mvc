import { Controller, inject, signal } from '@solid-mvc/core';
import type { OnDestroy } from '@solid-mvc/core';
import { QueryClient } from '@tanstack/query-core';
import { FakeApi } from '@/services/fake-api.service';
import { querySignal } from '@/lib/query';

/**
 * Controller layer for UsersView: owns the search box's debounced query
 * key, the query observer, and refresh. The view projects `users.value`
 * and delegates events — no timers, no query plumbing in render().
 */
@Controller()
export class UsersController implements OnDestroy {
  private api = inject(FakeApi);
  private qc = inject(QueryClient);

  /** Debounced search text — the query key. Typing doesn't spam the API. */
  search = signal('');
  private debounceTimer?: ReturnType<typeof setTimeout>;

  // Options GETTER: runs inside a scope-bound effect, so search signal
  // writes re-key the same observer — reactive keys, no manual re-arm.
  // Scope-bound via the controller's injector: the observer subscription
  // dies with the view that declared this controller.
  users = querySignal(this.qc, () => ({
    queryKey: ['users', this.search.value],
    queryFn: () => this.api.users(this.search.value),
  }));

  setSearch(raw: string): void {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => (this.search.value = raw), 250);
  }

  refresh(): void {
    void this.qc.invalidateQueries({ queryKey: ['users'] });
  }

  onDestroy(): void {
    clearTimeout(this.debounceTimer);
  }
}
