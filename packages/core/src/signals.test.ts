import { describe, it, expect, vi } from 'vitest';
import { signal, computed, batch, untracked, effect } from './signals';
import { Injector } from './injector';

describe('signals primitives', () => {
  it('signal/computed/batch/untracked behave as expected', () => {
    const a = signal(1);
    const b = signal(2);
    const sum = computed(() => a.value + b.value);
    batch(() => {
      a.value = 10;
      b.value = 20;
    });
    expect(sum.value).toBe(30);
    expect(untracked(() => a.value)).toBe(10);
  });

  it('peek reads without subscribing the surrounding computation', () => {
    const s = signal(0);
    const m = computed(() => s.value * 2);
    expect(s.peek()).toBe(0);
    expect(m.peek()).toBe(0);
    s.value = 3;
    expect(s.peek()).toBe(3);
    expect(m.peek()).toBe(6);
  });
});

describe('effect', () => {
  it('runs immediately and re-runs on tracked signal writes', () => {
    const s = signal(0);
    const seen: number[] = [];
    const dispose = effect(() => {
      seen.push(s.value);
    });
    s.value = 1;
    s.value = 2;
    dispose();
    s.value = 3;
    expect(seen).toEqual([0, 1, 2]);
  });

  it('created inside an injection context, dies with the scope', () => {
    const s = signal(0);
    const spy = vi.fn();
    class S {
      // property-assigned effect — created during construction
      e = effect(() => spy(s.value));
    }
    const inj = new Injector();
    inj.instantiate(S);
    s.value = 1;
    inj.deactivate();
    s.value = 2;
    expect(spy).toHaveBeenCalledTimes(2); // initial run + s=1 only
  });

  it('created outside a context is not auto-disposed', () => {
    const s = signal(0);
    const spy = vi.fn();
    effect(() => spy(s.value));
    const inj = new Injector();
    inj.deactivate();
    s.value = 1;
    expect(spy).toHaveBeenCalledTimes(2); // still alive — manual dispose required
  });
});
