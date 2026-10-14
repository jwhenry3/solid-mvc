/**
 * The users worker — one page, one thread. BroadcastChannel still shares
 * this worker's query cache with the shell and sibling page workers.
 */
import { defineViewPolyWorker, viewIslandApp } from '@solid-mvc/atoll-island/worker';
import { pageProviders } from '@/workers/shared';
import { UsersView } from '@/pages/users.view';

export const worker = defineViewPolyWorker({
  apps: {
    users: viewIslandApp(UsersView, { providers: pageProviders() }),
  },
});
