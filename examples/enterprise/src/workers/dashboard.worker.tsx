/**
 * The dashboard thread — the WHOLE page renders here. Its chart and ticker
 * are sub-islands: `<Chart>`/`<Ticker>` mounted inside this view spawn real
 * nested workers (dashboard@1~chart@N, dashboard@1~ticker@N) whose ops
 * tunnel up through this worker's op stream.
 *
 * pageProviders() gives this worker its own QueryClient + FakeApi — the
 * dashboard owns its metrics/revenue/activity fetches worker-side, and the
 * BroadcastChannel bridge shares whitelisted keys with the shell.
 */
import {
  defineViewPolyWorker,
  viewIslandApp,
} from '@solid-mvc/atoll-island/worker';
import { pageProviders } from '@/workers/shared';
import { DashboardView } from '@/pages/dashboard.view';

export const worker = defineViewPolyWorker({
  apps: {
    dashboard: viewIslandApp(DashboardView, { providers: pageProviders() }),
  },
});
