import { For, Show } from 'solid-js';
import { Component, View, inject } from '@solid-mvc/core';
import { formatDistanceToNow } from 'date-fns';
import TrendingUp from 'lucide-solid/icons/trending-up';
import TrendingDown from 'lucide-solid/icons/trending-down';
import DollarSign from 'lucide-solid/icons/dollar-sign';
import UsersIcon from 'lucide-solid/icons/users';
import ShoppingCart from 'lucide-solid/icons/shopping-cart';
import Activity from 'lucide-solid/icons/activity';
import { islandComponent } from '@solid-mvc/atoll-island';
import { tickerContract } from '../islands/ticker.contract';
import { chartContract } from '../islands/chart.contract';
import { subWorkerClient } from '../lib/sub-workers';
import { DashboardController } from './dashboard.controller';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { Skeleton } from '@/ui/misc';
import { Avatar } from '@/ui/misc';

const ICONS = [DollarSign, UsersIcon, ShoppingCart, Activity];

// Two threads nested under this page's own worker: each contract's worker
// factory spawns a sub-worker from inside the dashboard worker, and their
// ops tunnel up through this island's stream to the main thread.
const Ticker = islandComponent(tickerContract);
const Chart = islandComponent(chartContract);

@Component({ controllers: [DashboardController] })
export class DashboardView extends View<{ dark?: boolean }> {
  private c = inject(DashboardController);

  render() {
    const c = this.c;
    return (
      <div class="space-y-6">
        {/* Stat cards */}
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Show
            when={!c.metrics.value.isLoading}
            fallback={<For each={[0, 1, 2, 3]}>{() => <Skeleton class="h-28" />}</For>}
          >
            <For each={c.metrics.value.data ?? []}>
              {(m, i) => {
                const Icon = ICONS[i()];
                const v = c.metricView(m);
                return (
                  <Card>
                    <CardHeader class="flex flex-row items-center justify-between pb-2">
                      <CardDescription class="text-sm font-medium">{m.label}</CardDescription>
                      <Icon size={16} class="text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div class="text-2xl font-bold">{v.value}</div>
                      <Badge variant={v.up ? 'success' : 'destructive'} class="mt-1">
                        {v.up ? <TrendingUp size={12} class="mr-1" /> : <TrendingDown size={12} class="mr-1" />}
                        {v.delta}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              }}
            </For>
          </Show>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Revenue chart */}
          <Card class="xl:col-span-2">
            <CardHeader>
              <CardTitle>Revenue</CardTitle>
              <CardDescription>Trailing 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <Show
                when={!c.revenue.value.isLoading}
                fallback={<Skeleton class="h-64 w-full" />}
              >
                {/* The chart sub-island's mount div is the h-64 box — the
                    real element's measured size forwards down as the sub-
                    worker's pushed container size, so echarts' SVG init is
                    honest. The query result and theme ride props: 12 numbers
                    and a boolean. `dark` arrived here as a mount prop from
                    the shell (theme lives main-thread). */}
                <Chart
                  client={subWorkerClient(chartContract)}
                  dark={this.props.dark}
                  data={c.revenue.value.data}
                  className="h-64 w-full"
                />
              </Show>
            </CardContent>
          </Card>

          {/* Activity feed */}
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Latest events across the workspace</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <Show
                when={!c.activity.value.isLoading}
                fallback={<For each={[0, 1, 2, 3, 4]}>{() => <Skeleton class="h-8" />}</For>}
              >
                <For each={c.activity.value.data ?? []}>
                  {(a) => (
                    <div class="flex items-start gap-3">
                      <Avatar name={a.actor} class="h-7 w-7" />
                      <div class="text-sm min-w-0">
                        <span class="font-medium">{a.actor}</span>{' '}
                        <span class="text-muted-foreground">{a.action}</span>
                        <div class="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(a.at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </CardContent>
          </Card>
        </div>

        {/* Worker island — a render loop living on another thread */}
        <Card>
          <CardHeader>
            <CardTitle>Worker island</CardTitle>
            <CardDescription>
              Rendered by a Web Worker via the islands package — ticking entirely off the main thread.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Ticker client={subWorkerClient(tickerContract)} onEvent={(n, p) => c.onIslandEvent(n, p)} />
            <Show when={c.lastPing.value}>
              <div class="mt-3 text-xs text-muted-foreground">
                worker → here: <code>{c.lastPing.value}</code>
              </div>
            </Show>
          </CardContent>
        </Card>
      </div>
    );
  }
}
