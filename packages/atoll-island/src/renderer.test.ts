/**
 * The universal renderer's host functions — exercised directly against
 * jsdom's document (the renderer binds ambient `document`; in tests that
 * is real DOM). Covers the prop-shape branches compiled JSX can't reach
 * (h() hand-authoring, prop:/attr: prefixes, style objects, prop-backed
 * setters) and the insert() instance-scoping wrapper.
 */
import { describe, it, expect } from 'vitest';
import { signal } from '@solid-mvc/core';
import {
  createElement,
  createTextNode,
  setProp,
  insert,
  insertNode,
  render,
  h,
  registerInstanceDoc,
} from './renderer';

describe('universal renderer host', () => {
  it('createElement maps SVG-only tags to the SVG namespace', () => {
    expect((createElement('svg') as Element).namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect((createElement('circle') as Element).namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect((createElement('div') as Element).namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    // Ambiguous tags stay HTML — no context to disambiguate.
    expect((createElement('a') as Element).namespaceURI).toBe('http://www.w3.org/1999/xhtml');
  });

  it('setProp handles object styles, classes, prop-backed and attr values', () => {
    const el = createElement('div') as HTMLElement;
    setProp(el, 'style', { color: 'red', paddingLeft: '4px' });
    expect(el.style.color).toBe('red');
    expect(el.style.paddingLeft).toBe('4px');

    setProp(el, 'class', 'a b');
    expect(el.className).toBe('a b');
    setProp(el, 'className', 'c');
    expect(el.className).toBe('c');
    setProp(el, 'class', null);
    expect(el.className).toBe('');

    setProp(el, 'textContent', 'hi');
    expect(el.textContent).toBe('hi');
    setProp(el, 'innerHTML', '<b>x</b>');
    expect(el.innerHTML).toBe('<b>x</b>');

    setProp(el, 'value', 'v1');
    expect((el as HTMLInputElement).value).toBe('v1');
    setProp(el, 'disabled', true);
    expect((el as HTMLButtonElement).disabled).toBe(true);

    setProp(el, 'data-x', '1');
    expect(el.getAttribute('data-x')).toBe('1');
    setProp(el, 'data-x', null);
    expect(el.hasAttribute('data-x')).toBe(false);
    setProp(el, 'data-y', true);
    expect(el.getAttribute('data-y')).toBe('');
  });

  it('setProp wires on* listeners and prop:/attr: prefixes', () => {
    const el = createElement('button') as HTMLElement;
    let clicks = 0;
    setProp(el, 'onClick', () => clicks++);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicks).toBe(1);

    setProp(el, 'prop:textContent', 'prop');
    expect(el.textContent).toBe('prop');
    setProp(el, 'attr:title', 't');
    expect(el.getAttribute('title')).toBe('t');
  });

  it('removeNode/replaceText flow through insert() reconciliation', () => {
    const parent = createElement('div');
    const which = signal<'a' | 'b'>('a');
    const dispose = render(
      () => (which.value === 'a' ? createTextNode('A') : createTextNode('B')),
      parent,
    );
    expect(parent.textContent).toBe('A');
    which.value = 'b';
    expect(parent.textContent).toBe('B');
    dispose();
  });

  it('insert() wraps accessor evaluation in the instance scope when registered', () => {
    const parent = createElement('div') as HTMLElement;
    registerInstanceDoc(parent.ownerDocument ?? document, 'inst-1');
    insert(parent, () => createTextNode('scoped'));
    expect(parent.textContent).toBe('scoped');
  });
});

describe('h() hand-authoring helper', () => {
  it('builds element trees: tag + props + mixed children', () => {
    const el = h('p', { class: 'lead', 'data-n': 3 }, 'hello', h('b', null, 'bold'), 7, null, false);
    expect(el.tagName).toBe('P');
    expect(el.className).toBe('lead');
    expect(el.getAttribute('data-n')).toBe('3');
    expect(el.textContent).toBe('hellobold7');
    expect(el.childNodes.length).toBe(3); // null/boolean skipped
  });

  it('flattens nested child arrays', () => {
    const el = h('ul', null, [h('li', null, 'one'), h('li', null, 'two')]);
    expect(el.children.length).toBe(2);
    expect(el.textContent).toBe('onetwo');
  });

  it('routes function tags through createComponent', () => {
    const Greet = (p: { name: string }) => h('span', null, `hi ${p.name}`);
    const el = h(Greet, { name: 'x' });
    expect(el.tagName).toBe('SPAN');
    expect(el.textContent).toBe('hi x');
  });

  it('passes multiple children as an array prop to function tags', () => {
    const Wrap = (p: { children?: unknown }) => {
      const kids = Array.isArray(p.children) ? p.children : [p.children];
      return h('div', null, `n=${kids.length}`);
    };
    const el = h(Wrap, null, 'a', 'b');
    expect(el.textContent).toBe('n=2');
  });
});
