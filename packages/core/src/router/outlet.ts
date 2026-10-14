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

type DomRouterModule = typeof import('./router-dom');

/**
 * Lazy handle to the DOM router mount. @solidjs/router's lifecycle module
 * touches `window.history` at eval, so it must never sit in a worker
 * bundle's static graph — the dynamic import only resolves when a root
 * outlet actually mounts, which worker islands never do.
 */
let domRouter: Promise<DomRouterModule> | null = null;
const loadDomRouter = () => (domRouter ??= import('./router-dom'));

export function RouterOutlet(): JSX.Element {
  const depth = useContext(OutletDepth);
  if (depth === 0) {
    // Root outlet: mount the router once the DOM-side module resolves —
    // the tree appears a microtask after the outlet does.
    const router = useService(Router);
    const [DomRouter, setDomRouter] = createSignal<DomRouterModule['DomRouter'] | null>(null);
    void loadDomRouter().then((m) => setDomRouter(() => m.DomRouter));
    return createMemo(() => {
      const Mount = DomRouter();
      return Mount ? createComponent(Mount, { router }) : null;
    }) as unknown as JSX.Element;
  }
  // Nested outlet: render the child element the router gave this route's
  // frame. Wrapped in a memo so the accessor stays a reactive expression
  // for the host renderer (same as the previous depth-indexed version).
  const child = useContext(OutletChildren);
  return createMemo(() => child?.() ?? null) as unknown as JSX.Element;
}
