import type { Route } from '@solid-mvc/core';
import { TodoModule } from './todos/todo.module';
import { CounterModule } from './counter/counter.module';
import { HelloView } from './hello/hello.view';
import { TodoView } from './todos/todo.view';
import { IslandDemoView } from './islands-demo/island-demo.view';
import {
  SettingsShellView,
  GeneralSettingsView,
  SecuritySettingsView,
} from './settings/settings.view';

export const routes: Route[] = [
  { path: '/', module: TodoModule },
  { path: '/todos', module: TodoModule },
  // Declared by TodoModule but mounted without it — demonstrates module
  // ownership enforcement caught by the view's error boundary.
  { path: '/raw-todos', component: TodoView },
  { path: '/counter', module: CounterModule },
  { path: '/hello/:name', component: HelloView },
  { path: '/island', component: IslandDemoView },
  // Nested routes: the parent renders a shell whose <RouterOutlet/> mounts
  // the matched child — the URL resolves as a chain outermost → innermost.
  {
    path: '/settings',
    component: SettingsShellView,
    children: [
      { path: 'general', component: GeneralSettingsView },
      { path: 'security', component: SecuritySettingsView },
    ],
  },
  { path: '*', component: () => <p>Not found.</p> },
];
