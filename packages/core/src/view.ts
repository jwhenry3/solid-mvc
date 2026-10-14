import { createComponent, ErrorBoundary, onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';
import { InjectorContext, useInjector } from './context';
import { Injector } from './injector';
import { registerModule } from './module';
import { ownerOf } from './decorators';
import type { ComponentMeta } from './decorators';

// --- Class-based views -----------------------------------------------------

// Solid's JSX.ElementAttributesProperty is empty by default. Declaring
// `props` tells TS to type a class-component's attributes from the
// instance's `props` member — so `<TodoView initial={...}/>` checks
// against TodoView's View<P> parameter instead of the whole instance.
declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface ElementAttributesProperty {
      props: {};
    }
  }
}

// A View subclass is never instantiated by Solid's component machinery.
// babel-preset-solid compiles <Foo/> to createComponent(Foo, props); the
// JSX runtime module (./web, or the worker renderer entry) routes that
// call through viewComponent(), which swaps a View subclass for a host
// function component. The host constructs the class ONCE per mount inside
// a child injector — so `inject()` in field initializers resolves against
// that view's scope (component providers -> module providers -> root).
//
// render() runs once per mount: signal reads inside the returned JSX
// evaluate lazily under Solid's tracking, so updates are fine-grained —
// the bound expressions re-run, not render().

export abstract class View<P = {}> {
  /** Getter-backed Solid props — reads inside render()'s JSX stay
   *  reactive across updateProps/prop changes. */
  readonly props: P;

  constructor(props: P) {
    this.props = props;
  }

  abstract render(): JSX.Element;
}

export function isViewClass(t: any): boolean {
  return typeof t === 'function' && t.prototype instanceof View;
}

// --- Error box --------------------------------------------------------------
// Imperative DOM so it works on both threads: in a worker island, ambient
// `document` resolves to the instance's proxy document.

function errorBox(viewName: string, err: unknown, reset: () => void): HTMLElement {
  const doc = globalThis.document;
  const box = doc.createElement('div');
  box.setAttribute(
    'style',
    'border:1px solid #e53935;background:#ffebee;padding:.75rem;border-radius:4px;' +
      'font-family:monospace;font-size:.85rem;',
  );
  const strong = doc.createElement('strong');
  strong.textContent = `${viewName} failed to mount`;
  const pre = doc.createElement('pre');
  pre.setAttribute('style', 'white-space:pre-wrap;margin:.5rem 0;');
  pre.textContent = String((err as { message?: unknown })?.message ?? err);
  const retry = doc.createElement('button');
  retry.textContent = 'Retry';
  retry.addEventListener('click', () => reset());
  box.append(strong, pre, retry);
  return box as HTMLElement;
}

// --- Host -------------------------------------------------------------------

const hostCache = new Map<any, (props: any) => JSX.Element>();

function hostFor(cls: any): (props: any) => JSX.Element {
  let host = hostCache.get(cls);
  if (host) return host;

  const meta = (cls.__component ?? {}) as ComponentMeta;

  const inner = function ViewHost(props: any): JSX.Element {
    const parent = useInjector();
    // Module ownership: a view declared in a module's components/bootstrap
    // may only mount where that module's injector is an ancestor — Angular's
    // declaration rule enforced at mount. Undeclared views mount freely.
    const owner = ownerOf(cls);
    if (owner) {
      let node: Injector | null = parent;
      while (node && !node.modules.has(owner)) node = node.parent;
      if (!node) {
        throw new Error(
          `${cls.name} is declared by ${owner.name ?? 'a module'} but mounted outside its injector scope. ` +
            `Mount it under a route/module that includes ${owner.name ?? 'that module'}.`,
        );
      }
    }
    const inj = new Injector(parent, `view ${cls.name}`);
    // Standalone scope: imported modules contribute providers (and mark
    // themselves visible for ownership checks); view-level providers and
    // declared controllers register on top, closest-scope-wins.
    const seen = new Set<any>();
    for (const imp of meta.imports ?? []) registerModule(imp, inj, seen);
    for (const p of meta.providers ?? []) inj.provide(p);
    for (const c of meta.controllers ?? []) inj.provide(c);
    const inst = inj.instantiate(cls, props) as View<any>;
    // Component setup IS the mount in Solid (bodies run once): activate
    // immediately, deactivate on cleanup — pairs correctly even on
    // same-tick mount+navigate.
    inj.activate();
    onCleanup(() => inj.deactivate());
    // The view's injector becomes the scope for everything it renders, so
    // child components resolve through it — the element-injector hierarchy.
    return createComponent(InjectorContext.Provider, {
      value: inj,
      get children() {
        return inst.render();
      },
    });
  };
  (inner as any).displayName = cls.name;

  host = function BoundedView(props: any): JSX.Element {
    return createComponent(ErrorBoundary, {
      fallback: (err: unknown, reset: () => void) => {
        console.error(`[framework] ${cls.name} failed:`, err);
        return errorBox(cls.name, err, reset);
      },
      get children() {
        return createComponent(inner, props);
      },
    });
  };
  (host as any).displayName = cls.name;
  hostCache.set(cls, host);
  return host;
}

/**
 * The createComponent interception point — our `options.vnode` analog.
 * The JSX transform calls createComponent(Comp, props); the runtime
 * modules consumers compile against (./web on the main thread, the worker
 * renderer entry in islands) resolve through this so `<TodoView/>` keeps
 * working for any View class, declared or not.
 */
export function viewComponent(Comp: any): any {
  return isViewClass(Comp) ? hostFor(Comp) : Comp;
}
