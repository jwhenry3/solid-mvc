/**
 * Worker entry — bundler-detectable (spawned with the literal
 * `new URL(..., import.meta.url)` form in ticker.contract). Hosts the
 * island apps below; everything here runs inside the worker against the
 * proxy DOM, View classes and all.
 */
import { Component, View, signal } from '@solid-mvc/core';
import { defineViewPolyWorker, viewIsland, viewIslandApp } from '@solid-mvc/atoll-island/worker';
import { emit } from '@solid-mvc/atoll-island/worker';
import { tickerContract } from '../islands/ticker.contract';

@Component()
export class TickerIsland extends View {
  private uptime = signal(0);
  private requests = signal(12_408);
  private timer: ReturnType<typeof setInterval> | undefined;

  onInit() {
    // Out-of-task signal writes: each tick re-renders in the worker and
    // pushes an op batch — the shell never coordinates it.
    this.timer = setInterval(() => {
      this.uptime.value++;
      this.requests.value += Math.floor(Math.random() * 12);
    }, 1000);
  }
  onDestroy() {
    clearInterval(this.timer);
  }

  render() {
    return (
      <div style="display:flex;gap:1.5rem;align-items:baseline;font-variant-numeric:tabular-nums">
        <div>
          <div style="font-size:0.75rem;opacity:0.7">WORKER UPTIME</div>
          <div style="font-size:1.5rem;font-weight:600">{this.uptime.value}s</div>
        </div>
        <div>
          <div style="font-size:0.75rem;opacity:0.7">REQUESTS</div>
          <div style="font-size:1.5rem;font-weight:600">
            {this.requests.value.toLocaleString()}
          </div>
        </div>
        <button
          style="font-size:0.75rem;opacity:0.8;cursor:pointer"
          onClick={() => emit('worker-ping', { requests: this.requests.value })}
        >
          ping shell
        </button>
      </div>
    );
  }
}

export const tickerApp = viewIsland('ticker', TickerIsland);

// The contract rides the app: mount/updateProps props and declared emit
// payloads ('worker-ping') are validated against its schemas worker-side.
export const worker = defineViewPolyWorker({
  apps: { ticker: viewIslandApp(TickerIsland, { contract: tickerContract }) },
});
