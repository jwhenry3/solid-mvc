// Signal primitives over Solid's reactive core. The public surface keeps
// the .value accessor shape — reads track through Solid's observer graph,
// so a signal written in a controller re-evaluates exactly the JSX
// expressions that read it (never the whole view).
import {
  batch,
  createMemo,
  createRenderEffect,
  createRoot,
  createSignal,
  untrack,
} from 'solid-js';
import { getCurrentInjector } from './injector';

export { batch };
export { untrack as untracked };

export interface ReadonlySignal<T> {
  readonly value: T;
  /** Read without subscribing the surrounding computation. */
  peek(): T;
}

export interface Signal<T> extends ReadonlySignal<T> {
  value: T;
}

export function signal<T>(initial: T): Signal<T>;
export function signal<T = undefined>(): Signal<T | undefined>;
export function signal<T>(initial?: T): Signal<T | undefined> {
  // equals:false — a write always notifies, matching the previous
  // semantics where signal assignment unconditionally re-rendered.
  const [get, set] = createSignal<T | undefined>(initial, { equals: false });
  return {
    get value(): T | undefined {
      return get();
    },
    set value(v: T | undefined) {
      set(() => v);
    },
    peek: (): T | undefined => untrack(get),
  };
}

export function computed<T>(fn: () => T): ReadonlySignal<T> {
  const m = createMemo(fn);
  return {
    get value(): T {
      return m();
    },
    peek: (): T => untrack(m),
  };
}

// Scope-bound effect: created during a class's construction (field
// initializers or constructor body), it registers on that scope's injector
// and is disposed automatically when the scope is deactivated — Angular's
// DestroyRef semantics. Outside an injection context it's the raw primitive:
// call the returned disposer yourself. Runs synchronously at creation —
// declare effects *below* the signals they read.
export function effect(fn: () => void): () => void {
  // createRenderEffect (not createEffect) for the immediate first run —
  // deferred effects would silently skip the documented construction-time
  // pass. The nested root exists only to hand back a disposer when no
  // injection context owns one.
  let dispose: () => void = () => {};
  createRoot((d) => {
    dispose = d;
    createRenderEffect(fn);
  });
  getCurrentInjector()?.registerCleanup(dispose);
  return dispose;
}
