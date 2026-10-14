import type { Route } from '@solid-mvc/core';
import { WorkerPage } from '@/pages/worker-page';

/**
 * Every page renders inside its own dedicated worker via WorkerPage +
 * PageWorkerHost: the route table only names the island app and the host
 * maps that to the page's worker entry. The dashboard worker nests two
 * more threads inside itself — chart and ticker sub-islands.
 */
const page = (app: string) => () => <WorkerPage app={app} />;

export const routes: Route[] = [
  { path: '/', component: page('dashboard') },
  { path: '/users', component: page('users') },
  { path: '/settings', component: page('settings') },
  { path: '/components', component: page('components') },
  { path: '*', component: page('dashboard') },
];
