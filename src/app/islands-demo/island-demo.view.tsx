import { For } from 'solid-js';
import { Component, View, signal } from '@solid-mvc/core';
import { Island, connectIslandWorker, islandComponent, type IslandClient } from '@solid-mvc/atoll-island';
import type { WorkerLike } from '@solid-mvc/atoll-island';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';

// Bundler-detectable worker entry — the literal `new URL(...import.meta.url)`
// is what Vite detects; never hoist or compute it.
const islandEntry = (): WorkerLike =>
  new Worker(new URL('./demo.worker.ts', import.meta.url), { type: 'module' }) as WorkerLike;

// A typed facade — props flow straight through as island props.
const Counter = islandComponent<{ start?: number; label?: string }>('counter');

// Standalone route view — mounts worker-rendered islands like Angular's
// <atoll-island> or React's <Island/> bindings.
@Component()
export class IslandDemoView extends View {
  private events = signal<string[]>([]);
  private spawnCount = signal(0);
  // One shared worker hosting several instances — spawned lazily on first
  // render, terminated on view destroy.
  private shared: IslandClient | undefined;

  private log(name: string, payload: unknown) {
    this.events.value = [...this.events.value, `${name}: ${JSON.stringify(payload)}`];
  }

  private getShared(): IslandClient {
    return (this.shared ??= connectIslandWorker({ worker: islandEntry }));
  }

  onDestroy() {
    this.shared?.terminate();
  }

  spawnAnother = () => {
    this.spawnCount.value++;
  };

  render() {
    return (
      <section class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Worker islands</CardTitle>
            <CardDescription>
              Each card below renders inside a Web Worker against a proxy DOM; commits
              stream back as ops and replay onto real DOM. Clicks round-trip as dispatch
              tasks.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Owns its worker — spawned for this mount, terminated on destroy. */}
              <Counter
                worker={islandEntry}
                props={{ start: 0, label: 'Own worker' }}
                onEvent={(n, p) => this.log(n, p)}
              />
              {/* Shared client — one worker, two instances (counter + clock). */}
              <Counter
                client={this.getShared()}
                props={{ start: 40, label: 'Shared worker' }}
                onEvent={(n, p) => this.log(n, p)}
              />
              <Island client={this.getShared()} app="clock" />
              <For each={Array.from({ length: this.spawnCount.value }, (_, i) => i)}>
                {(i) => (
                  <Counter
                    client={this.getShared()}
                    props={{ start: 100 * (i + 1), label: `Spawned #${i + 1}` }}
                    onEvent={(n, p) => this.log(n, p)}
                  />
                )}
              </For>
            </div>
            <Button variant="outline" onClick={this.spawnAnother}>
              Add island to shared worker
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>emit() events</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-1 font-mono text-xs text-muted-foreground">
              <For each={this.events.value}>{(e) => <li>{e}</li>}</For>
            </ul>
          </CardContent>
        </Card>
      </section>
    );
  }
}
