import { renderToString } from 'solid-js/web';
import { App, allRoutes } from './App';
import { metaFor } from './routeMeta';

/**
 * Build-time entry for `prerender.mjs`: bundled with `vite build --ssr`, so
 * TSX and vite defines behave exactly like the client build. The emitted
 * site is pure static HTML; Solid never loads in the browser.
 */

export interface SsgRoute {
  id: string;
  label: string;
  title: string;
  description: string;
}

export const ROUTES: SsgRoute[] = allRoutes.map((r) => ({
  id: r.id,
  label: r.label,
  ...metaFor(r.id, r.label),
}));

export function renderRoute(id: string): string {
  return renderToString(() => <App route={id} />);
}
