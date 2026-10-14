import { For } from 'solid-js';
import { docsRootHref, routeDepth } from '../link';

/**
 * Sticky top bar: brand, site-level tabs, version switcher, and external
 * links. Pure markup (no client JS needed): the same HTML works in the dev
 * app and in the prerendered Pages artifact, where docs.js drives the
 * switcher. Hrefs resolve relative to the docs root so the artifact works
 * under any mount (/, /docs/, /<repo>/docs/, or a versioned snapshot one
 * segment deeper).
 */
// 'v0.1.0' on a release-snapshot build, 'latest' otherwise. Inside a
// version mount the docs root is one extra '../' down (docs/v0.1.0/<route>/).
const VERSION = import.meta.env.VITE_DOCS_VERSION || 'latest';
const versioned = VERSION !== 'latest';

// Computed per render: docsRootHref() depends on the route depth the
// prerender currently emits, so module-level constants would bake depth-0
// links into every page.
const hrefs = () =>
  import.meta.env.DEV
    ? { home: '/', docs: '/' }
    : {
        home: `${docsRootHref()}${versioned ? '../../' : '../'}`,
        docs: docsRootHref(),
      };

// Dev-mode handler for the version select (docs.js handles the prerendered
// site): same segment-swap math — climb to the docs root, then back down
// through the chosen version dir, preserving the current route.
function versionHref(v: string) {
  const up = '../'.repeat(routeDepth() + (versioned ? 1 : 0));
  const segs = location.pathname.split('/').filter(Boolean);
  const rel = routeDepth() ? `${segs.slice(-routeDepth()).join('/')}/` : '';
  return up + (v === 'latest' ? '' : `${v}/`) + rel;
}

export function SiteHeader() {
  const href = hrefs();
  return (
    <header class="site-header">
      <a class="site-brand" href={href.docs}>
        <img src={`${docsRootHref()}favicon.svg`} alt="" />
        <span class="site-brand-name">
          SOLID<span class="site-brand-js">MVC</span>
        </span>
      </a>
      <nav class="site-tabs" aria-label="Sites">
        <a href={href.home}>Home</a>
        <a href={href.docs} class="active">
          Documentation
        </a>
      </nav>
      {/* Versioned snapshots (docs/v<x.y.z>/): docs.js repopulates the
          options from the live versions.json and drives navigation; the
          baked options are the no-JS floor. */}
      <select
        class="version-switch"
        aria-label="Docs version"
        value={VERSION}
        // One baked option can't switch anything: docs.js reveals the
        // select once versions.json proves snapshots exist.
        hidden={!versioned}
        onChange={(e) => {
          location.href = versionHref((e.target as HTMLSelectElement).value);
        }}
      >
        <For each={versioned ? [VERSION, 'latest'] : ['latest']}>
          {(v) => <option value={v}>{v}</option>}
        </For>
      </select>
      <nav class="site-ext" aria-label="External">
        <a href="https://www.solidjs.com">Solid</a>
        <a href="https://angular.dev">Angular</a>
        <a href="https://github.com/jwhenry3/solid-mvc">GitHub</a>
        <a href="https://www.npmjs.com/org/solid-mvc">npm</a>
      </nav>
    </header>
  );
}
