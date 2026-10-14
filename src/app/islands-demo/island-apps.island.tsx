/**
 * Island app components — WORKER SIDE ONLY. Imported by demo.worker.ts and
 * never by the shell: the shell reaches these by registry key ('counter',
 * 'clock'). Everything here runs inside the worker against the proxy DOM;
 * `@Component`, `View`, signals, inject() all work unchanged because the
 * framework's machinery is realm-agnostic.
 */
import { Component, View, signal } from '@solid-mvc/core';
import { emit } from '@solid-mvc/atoll-island/worker';

@Component()
export class CounterIsland extends View<{ start?: number; label?: string }> {
  count = signal(this.props.start ?? 0);

  render() {
    return (
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-2">
        <h3 class="text-sm font-semibold leading-none tracking-tight">
          {this.props.label ?? 'Worker counter'}
        </h3>
        <button
          class="w-full h-9 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium shadow hover:bg-primary/90 transition-colors cursor-pointer"
          onClick={() => {
            this.count.value++;
            if (this.count.value % 5 === 0) emit('milestone', { count: this.count.value });
          }}
        >
          count: {this.count.value}
        </button>
      </div>
    );
  }
}

@Component()
export class ClockIsland extends View {
  time = signal(new Date().toLocaleTimeString());
  private timer: ReturnType<typeof setInterval> | undefined;

  onInit() {
    // Out-of-task signal writes: each tick re-renders in the worker and the
    // op batch pushes to the driver on a microtask — no task call needed.
    this.timer = setInterval(() => (this.time.value = new Date().toLocaleTimeString()), 1000);
  }
  onDestroy() {
    clearInterval(this.timer);
  }

  render() {
    return (
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-2">
        <h3 class="text-sm font-semibold leading-none tracking-tight">Worker clock</h3>
        <p class="text-2xl font-mono tabular-nums">{this.time.value}</p>
        <p class="text-xs text-muted-foreground">
          This text re-renders entirely inside the worker.
        </p>
      </div>
    );
  }
}
