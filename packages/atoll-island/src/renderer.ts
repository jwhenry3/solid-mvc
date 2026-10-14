/**
 * The Solid universal renderer for worker islands — `solid-js/universal`'s
 * createRenderer bound to the ambient document. Inside an instance task,
 * `document` resolves through the instance dispatcher to that island's
 * proxy document, so every node mutation serializes to an op.
 *
 * This module is also the JSX runtime module for `generate: 'universal'`
 * worker files (`moduleName: '@solid-mvc/atoll-island/worker'`) — compiled
 * output calls insert/setProp/spread/createComponent/... from here.
 * createComponent routes View classes through the framework's host
 * machinery, same as the DOM runtime in @solid-mvc/core/web.
 */
import { createRenderer } from 'solid-js/universal';
import { createComponent as solidCreateComponent, createRoot } from 'solid-js';
import type { JSX } from 'solid-js';
import { viewComponent } from '@solid-mvc/core';
import { enterInstance, exitInstance } from '@solid-mvc/atoll/worker';

type AnyNode = any;

/** Proxy document → owning instance key — set by the adapter at mount so
 *  out-of-task evaluation (async signal writes flushing effects with no
 *  runInInstance wrapper) resolves the right document deterministically. */
const docInstance = new WeakMap<object, string>();

export function registerInstanceDoc(doc: object, instance: string): void {
  docInstance.set(doc, instance);
}

function docOf(node: AnyNode): object | undefined {
  return node?.ownerDocument ?? (node?.nodeType === 9 ? node : undefined);
}

/** DOM property names with real setters on ProxyElement / HTMLElement —
 *  assignment emits the prop op; everything else falls back to
 *  setAttribute (the attr op). */
function setPropValue(el: AnyNode, name: string, value: unknown): void {
  if (name === 'style' && value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, string>)) {
      (el.style as Record<string, string>)[k] = v;
    }
    return;
  }
  if (name === 'class' || name === 'className') {
    el.className = value == null ? '' : String(value);
    return;
  }
  if (name === 'textContent' || name === 'innerHTML') {
    el[name] = value == null ? '' : String(value);
    return;
  }
  if (name === 'value' || name === 'checked' || name === 'selected' || name === 'disabled') {
    (el as Record<string, unknown>)[name] = value;
    return;
  }
  if (value == null || value === false) {
    el.removeAttribute?.(name);
    return;
  }
  el.setAttribute(name, value === true ? '' : String(value));
}

/** The universal transform calls createElement(tag) with no namespace
 *  context — so SVG elements need a tag-name rule, same heuristic
 *  solid-js/web's Dynamic uses (SVGElements.has(component) → createElementNS).
 *  This is the SVG-only subset: tags that ALSO exist in HTML (a, font,
 *  image, script, style, title) stay HTML — with no parent context they
 *  can't be disambiguated, and a wrongly-namespaced <a> breaks real HTML. */
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg', 'animate', 'animateMotion', 'animateTransform', 'circle', 'clipPath',
  'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix', 'feComponentTransfer',
  'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG',
  'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting',
  'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'foreignObject', 'g',
  'line', 'linearGradient', 'marker', 'mask', 'mpath', 'path', 'pattern',
  'polygon', 'polyline', 'radialGradient', 'rect', 'set', 'stop', 'switch',
  'symbol', 'text', 'textPath', 'tspan', 'use', 'view',
]);

const renderer = createRenderer({
  createElement: (tag: string) =>
    SVG_TAGS.has(tag)
      ? (globalThis.document as any).createElementNS(SVG_NS, tag)
      : (globalThis.document as any).createElement(tag),
  createTextNode: (value: string) => (globalThis.document as any).createTextNode(value),
  isTextNode: (node: AnyNode) => node?.nodeType === 3,
  replaceText: (node: AnyNode, value: string) => {
    node.textContent = value;
  },
  insertNode: (parent: AnyNode, node: AnyNode, anchor: AnyNode) => {
    parent.insertBefore(node, anchor ?? null);
  },
  removeNode: (parent: AnyNode, node: AnyNode) => {
    parent.removeChild(node);
  },
  setProperty: (node: AnyNode, name: string, value: unknown) => {
    // on* props carry real listener functions — attach with the lowercase
    // DOM type so the driver registers a working listener (universal JSX
    // needs no prop-name bridge: 'onClick' here means 'click' on the wire).
    if (name.length > 2 && name.startsWith('on') && typeof value === 'function') {
      node.addEventListener(name.slice(2).toLowerCase(), value as EventListener);
      return;
    }
    if (name.startsWith('prop:')) {
      (node as Record<string, unknown>)[name.slice(5)] = value;
      return;
    }
    if (name.startsWith('attr:')) {
      name = name.slice(5);
    }
    setPropValue(node, name, value);
  },
  getParentNode: (node: AnyNode) => node?.parentNode ?? null,
  getFirstChild: (node: AnyNode) => node?.firstChild ?? null,
  getNextSibling: (node: AnyNode) => node?.nextSibling ?? null,
});

const baseInsert = renderer.insert as (
  parent: AnyNode,
  accessor: unknown,
  marker?: AnyNode,
  initial?: unknown,
) => void;

/**
 * insert() — the one runtime helper whose evaluation can run OUT of task
 * (a signal written from a timer re-runs the insert expression). Wrap the
 * accessor so evaluation enters the parent node's instance — ambient
 * `document` inside (createTextNode/createElement, nested inserts) then
 * resolves the right proxy document deterministically instead of the
 * last-active heuristic. The Solid analog of the old vnode-stamp scope
 * machinery: scoped through the insertion boundary rather than vnode walks.
 */
export const insert: typeof baseInsert = (parent, accessor, marker, initial) => {
  if (typeof accessor === 'function') {
    const key = docInstance.get(docOf(parent) ?? {});
    if (key !== undefined) {
      const fn = accessor as () => unknown;
      accessor = () => {
        const prev = enterInstance(key);
        try {
          return fn();
        } finally {
          exitInstance(prev);
        }
      };
    }
  }
  return baseInsert(parent, accessor, marker, initial);
};

export const {
  insertNode,
  spread,
  setProp,
  effect,
  memo,
  mergeProps,
  use,
  createElement,
  createTextNode,
} = renderer;

/** createComponent with View-class interception — worker JSX `<FooView/>`
 *  mounts through the same injector-scoped host as the DOM runtime. */
export function createComponent(Comp: any, props: any): JSX.Element {
  return solidCreateComponent(viewComponent(Comp), props);
}

/** Mount `code` under `element` (the instance's proxy body) inside a Solid
 *  root — dispose() tears down every signal/effect the island created. */
export function render(code: () => unknown, element: AnyNode): () => void {
  let disposer: () => void = () => {};
  createRoot((dispose) => {
    disposer = dispose;
    insert(element, code);
  });
  return disposer;
}

/** Hand-authoring helper — h('p', { class: 'x' }, 'text', child). */
export function h(tag: any, props?: Record<string, unknown> | null, ...children: unknown[]): any {
  if (typeof tag === 'function') {
    const p: Record<string, unknown> = { ...(props ?? {}) };
    if (children.length === 1) p.children = children[0];
    else if (children.length > 1) p.children = children;
    return createComponent(tag, p);
  }
  const el = createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) setProp(el, k, v);
  for (const c of children) {
    const list = Array.isArray(c) ? c : [c];
    for (const child of list) {
      if (child == null || typeof child === 'boolean') continue;
      insertNode(
        el,
        typeof child === 'string' || typeof child === 'number'
          ? createTextNode(String(child))
          : child,
        null,
      );
    }
  }
  return el;
}
