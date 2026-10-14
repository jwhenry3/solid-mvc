/**
 * The shell-side host for worker-rendered pages: routes point here and
 * this mounts the page's island app on the shared worker client.
 *
 * Boundary rules the props encode:
 * - theme is main-thread state (document/localStorage/matchMedia) — it
 *   crosses as props + a callbackProp setter.
 * - Signal reads inside the props object stay reactive: <Island> diffs
 *   props in an effect, so theme changes push updateProps over the wire.
 * - Island props go over the wire as structured-cloneable values only.
 */
import type { Component } from 'solid-js';
import { useService } from '@solid-mvc/core';
import { Island, callbackProp } from '@solid-mvc/atoll-island';
import { PageWorkerHost } from '@/services/page-worker.service';
import { ThemeService, type Theme } from '@/services/theme.service';

export const WorkerPage: Component<{ app: string }> = (p) => {
  const host = useService(PageWorkerHost);
  const theme = useService(ThemeService);
  const client = host.clientFor(p.app);

  return (
    <Island
      client={client}
      app={p.app}
      props={{
        // Reads happen inside Island's props-diffing effect — reactive.
        ...(p.app === 'dashboard'
          ? { dark: theme.resolved.value === 'dark' }
          : {}),
        ...(p.app === 'settings'
          ? {
              theme: theme.theme.value,
              onThemeChange: callbackProp((t: Theme) => (theme.theme.value = t)),
            }
          : {}),
      }}
    />
  );
};
