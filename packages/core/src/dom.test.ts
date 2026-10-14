import { describe, it, expect } from 'vitest';
import { appendChildren } from './dom';

describe('appendChildren', () => {
  it('appends strings, numbers, nodes, and function children; skips nullish', () => {
    const el = document.createElement('div');
    appendChildren(el, ['a', 1, null, false, () => 'fn', () => null, () => true]);
    expect(el.textContent).toBe('a1fn');
  });

  it('evaluates a function child that returns a node', () => {
    const el = document.createElement('div');
    const inner = document.createElement('b');
    appendChildren(el, () => inner);
    expect(el.firstChild).toBe(inner);
  });
});
