import { createComponent, createContext, createMemo, createSignal, useContext } from 'solid-js';
import type { JSX } from 'solid-js';
import { useService } from '../context';
import { Router } from './router';

/**
 * Which depth of the matched chain this outlet renders — the root outlet
 * is depth 0, an outlet inside a routed view is depth 1, and so on. The
 * depth-0 outlet mounts the @solidjs/router tree; deeper outlets render
 * the child element the router passed to their route's frame.
 */
export const OutletDepth = createContext(0);

/** The child route's rendered element, provided by the route's frame so a
 *  view can drop `<RouterOutlet/>` anywhere in its markup. */
export const OutletChildren = createContext<() => JSX.Element>();

/**
 * The outlet's `fallback` prop, provided around the depth's content so a
 * pending lazy target — a RouteFrame whose loadComponent is still in
 * flight, or a loadChildren tail holding back deeper matches — can render
 * it in place. The fallback lives on the outlet that owns the depth.
 */
export const OutletFallback = createContext<JSX.Element>(null);

type DomRouterModule = typeof import('./router-dom');

/**
 * Lazy handle to the DOM router mount. @solidjs/router's lifecycle module
 * touches `window.history` at eval, so it must never sit in a worker
 * bundle's static graph — the dynamic import only resolves when a root
 * outlet actually mounts, which worker islands never do.
 */
let domRouter: Promise<DomRouterModule> | null = null;
const loadDomRouter = () => (domRouter ??= import('./router-dom'));

export function RouterOutlet(props: { fallback?: JSX.Element }): JSX.Element {
  const depth = useContext(OutletDepth);
  if (depth === 0) {
    // Root outlet: mount the router once the DOM-side module resolves —
    // the tree appears a microtask after the outlet does. Route frames
    // inside it read OutletFallback for their pending lazy targets.
    const router = useService(Router);
    const [DomRouter, setDomRouter] = createSignal<DomRouterModule['DomRouter'] | null>(null);
    void loadDomRouter().then((m) => setDomRouter(() => m.DomRouter));
    return createComponent(OutletFallback.Provider, {
      value: props.fallback ?? null,
      get children() {
        return createMemo(() => {
          const Mount = DomRouter();
          return Mount ? createComponent(Mount, { router }) : null;
        }) as unknown as JSX.Element;
      },
    });
  }
  // Nested outlet: render the child element the router gave this route's
  // frame — a pending lazy child answers with our fallback instead.
  const child = useContext(OutletChildren);
  return createComponent(OutletFallback.Provider, {
    value: props.fallback ?? null,
    get children() {
      return createMemo(() => child?.() ?? null) as unknown as JSX.Element;
    },
  });
}
