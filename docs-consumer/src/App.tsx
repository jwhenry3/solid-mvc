import type { JSX } from 'solid-js';
import { For, onMount } from 'solid-js';
import { SiteHeader } from './components/SiteHeader';
import { docHref, setRouteDepth } from './link';
import { metaFor } from './routeMeta';
import { Overview } from './pages/Overview';
import { Quickstart } from './pages/Quickstart';
import { Cli } from './pages/Cli';
import { Di } from './pages/Di';
import { Modules } from './pages/Modules';
import { Views } from './pages/Views';
import { Controllers } from './pages/Controllers';
import { Signals } from './pages/Signals';
import { Metadata } from './pages/Metadata';
import { Context } from './pages/Context';
import { RouterPage } from './pages/RouterPage';
import { Islands } from './pages/Islands';
import { IslandApps } from './pages/IslandApps';
import { IslandShell } from './pages/IslandShell';
import { IslandProtocol } from './pages/IslandProtocol';
import { GuideIntegrations } from './pages/GuideIntegrations';
import { GuideQuery } from './pages/GuideQuery';
import { GuideForms } from './pages/GuideForms';
import { GuideStyling } from './pages/GuideStyling';
import { DemoApp } from './pages/DemoApp';
import { DemoEnterprise } from './pages/DemoEnterprise';
import { Hosting } from './pages/Hosting';

interface Route {
  id: string;
  label: string;
  page: () => JSX.Element;
}

const SECTIONS: { label: string; routes: Route[] }[] = [
  {
    label: 'Getting started',
    routes: [
      { id: 'overview', label: 'Overview', page: () => <Overview /> },
      { id: 'quickstart', label: 'Quickstart', page: () => <Quickstart /> },
      { id: 'cli', label: 'CLI', page: () => <Cli /> },
    ],
  },
  {
    label: 'Core concepts',
    routes: [
      { id: 'di', label: 'Dependency injection', page: () => <Di /> },
      { id: 'modules', label: 'Modules', page: () => <Modules /> },
      { id: 'views', label: 'Views & lifecycle', page: () => <Views /> },
      { id: 'controllers', label: 'Controllers', page: () => <Controllers /> },
      { id: 'signals', label: 'Signals & effects', page: () => <Signals /> },
      { id: 'metadata', label: 'Component metadata', page: () => <Metadata /> },
      { id: 'context', label: 'Context & hooks', page: () => <Context /> },
      { id: 'router', label: 'Router', page: () => <RouterPage /> },
    ],
  },
  {
    label: 'Islands',
    routes: [
      { id: 'islands', label: 'Overview', page: () => <Islands /> },
      { id: 'island-apps', label: 'Island apps', page: () => <IslandApps /> },
      { id: 'island-shell', label: 'Shell & mounting', page: () => <IslandShell /> },
      { id: 'island-protocol', label: 'How it works', page: () => <IslandProtocol /> },
    ],
  },
  {
    label: 'Guides',
    routes: [
      { id: 'guide-integrations', label: 'Integrating libraries', page: () => <GuideIntegrations /> },
      { id: 'guide-query', label: 'Data fetching', page: () => <GuideQuery /> },
      { id: 'guide-forms', label: 'Forms & validation', page: () => <GuideForms /> },
      { id: 'guide-styling', label: 'Styling & UI kits', page: () => <GuideStyling /> },
    ],
  },
  {
    label: 'Live demos',
    routes: [
      { id: 'demo-app', label: 'Framework demo', page: () => <DemoApp /> },
      { id: 'demo-enterprise', label: 'Enterprise example', page: () => <DemoEnterprise /> },
    ],
  },
  {
    label: 'Deployment',
    routes: [{ id: 'hosting', label: 'Hosting & Pages', page: () => <Hosting /> }],
  },
];

export const allRoutes = SECTIONS.flatMap((s) => s.routes);
export { SECTIONS };

const routeIds = new Set(allRoutes.map((r) => r.id));

/**
 * Resolve the active route from `location.pathname`. Routes are emitted as
 * `<id>/index.html`, so the route id is the trailing path segment under
 * whatever mount point the site lives at (`/` in dev, `/docs/` in the Pages
 * artifact): match the longest trailing suffix that is a known id.
 */
function routeFromPathname(pathname: string): string | null {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return 'overview';
  for (let take = Math.min(2, segs.length); take > 0; take--) {
    const candidate = segs.slice(-take).join('/');
    if (routeIds.has(candidate)) return candidate;
  }
  return null;
}

export function App({ route }: { route?: string }) {
  const active =
    allRoutes.find((r) => r.id === route) ??
    allRoutes.find((r) => r.id === (routeFromPathname(window.location.pathname) ?? ''));
  const notFound = !active;
  const shown = active ?? allRoutes.find((r) => r.id === 'overview')!;

  // Links and iframe srcs resolve relative to the page's own depth under the
  // docs root: publish it for the whole render. 'overview' lives AT the root
  // (dist/index.html), so depth 0.
  setRouteDepth(shown.id === 'overview' ? 0 : 1);

  onMount(() => {
    document.title = notFound
      ? 'SolidMVC docs, page not found'
      : metaFor(shown.id, shown.label).title;
    // Keep the active link in view: mirrors the same reveal in docs.js for
    // the prerendered site (which runs no Solid runtime).
    const sidebar = document.querySelector('.sidebar');
    const activeLink = sidebar?.querySelector<HTMLElement>('.nav-link.active');
    if (sidebar && activeLink) {
      const sb = sidebar.getBoundingClientRect();
      const ar = activeLink.getBoundingClientRect();
      if (ar.top < sb.top || ar.bottom > sb.bottom) {
        sidebar.scrollTop += ar.top - sb.top - sb.height / 3;
      }
    }
  });

  return (
    <div class="shell">
      <SiteHeader />
      <div class="shell-body">
        <aside class="sidebar">
          <For each={SECTIONS}>
            {(section) => (
              <nav class="nav-section">
                <h3>{section.label}</h3>
                <For each={section.routes}>
                  {(r) => (
                    <a
                      href={docHref(r.id)}
                      class={r.id === active?.id ? 'nav-link active' : 'nav-link'}
                    >
                      {r.label}
                    </a>
                  )}
                </For>
              </nav>
            )}
          </For>
        </aside>
        <main class="content">
          {notFound ? (
            <article>
              <h1>Page not found</h1>
              <p>
                <code>{window.location.pathname}</code> doesn't match a docs
                page.
              </p>
              <p>
                <a href={docHref('overview')}>Back to the docs overview</a>
              </p>
            </article>
          ) : (
            shown.page()
          )}
          <footer class="site-footer">
            <span>SolidMVC — MIT licensed</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
