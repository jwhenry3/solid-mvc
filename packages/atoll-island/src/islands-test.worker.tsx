/**
 * Worker-side island apps for islands.test.tsx. Universal-compiled (the
 * *.worker.* glob) so their JSX runs through the universal renderer
 * against the proxy document — in-process the realms share one heap, so
 * the test registers these classes by import and pokes the module-level
 * signals directly.
 */
import { Component, Injectable, View, inject, signal } from '@solid-mvc/core';
import { emit } from '@solid-mvc/atoll/worker';

@Component()
export class CounterIsland extends View<{ start?: number; label?: string }> {
  count = signal(this.props.start ?? 0);
  render() {
    return (
      <div class="card">
        <h3>{this.props.label ?? 'counter'}</h3>
        <button
          class="inc"
          onClick={() => {
            this.count.value++;
            if (this.count.value === 5) emit('five', { count: this.count.value });
          }}
        >
          count {this.count.value}
        </button>
      </div>
    );
  }
}

// Module-level signal: in-process sharing lets the test poke worker-side state.
export const tick = signal(0);

@Component()
export class TickerIsland extends View {
  render() {
    return <p class="tick">tick {tick.value}</p>;
  }
}

// Multi-word DOM events arrive prop-sliced as PascalCase ('MouseLeave') —
// the proxy boundary must map them to the real lowercase type
// ('mouseleave'), not just decapitalize ('mouseLeave' never dispatches).
export const leaves = signal(0);

@Component()
export class LeaveIsland extends View {
  render() {
    return (
      <div class="leavebox" onMouseLeave={() => leaves.value++}>
        hover me
      </div>
    );
  }
}

// shell.test.tsx's registry app — a lone button, no wrapper div.
@Component()
export class ShellCounter extends View<{ start?: number }> {
  count = signal(this.props.start ?? 0);
  render() {
    return (
      <button class="inc" onClick={() => this.count.value++}>
        count {this.count.value}
      </button>
    );
  }
}

// Universal createElement carries no parent context — the renderer maps
// SVG-only tags to createElementNS so icons/charts replay as real SVG.
@Component()
export class SvgIsland extends View {
  render() {
    return (
      <svg viewBox="0 0 24 24" class="icon">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    );
  }
}

@Injectable()
export class IslandGreeter {
  hi(n: string) {
    return `hello ${n}`;
  }
}

@Component({ providers: [IslandGreeter] })
export class GreetIsland extends View<{ name?: string }> {
  private g = inject(IslandGreeter);
  render() {
    return <p class="greet">{this.g.hi(this.props.name ?? '?')}</p>;
  }
}
