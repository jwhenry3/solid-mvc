// Static prerender for the consumer docs — no runtime framework, no hydration.
//
//   npm run build   =  tsc --noEmit
//                      vite build            (dist/ template + css)
//                      vite build --ssr      (dist-ssg/ node bundle of the app)
//                      node prerender.mjs    (this file — one HTML per route)
//
// Emits dist/<route>/index.html for every route in App.tsx's table, with the
// page body server-rendered, per-route <title>/meta/canonical/OG tags, and
// docs.js for the small interactive bits (sidebar scroll, legacy #/ links).
// Also writes 404.html, sitemap.xml + robots.txt.
//
// 'overview' is emitted at dist/index.html (the docs root) rather than
// overview/index.html — docHref() special-cases it the same way, so there is
// exactly one URL for that page.
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const ssgDir = join(root, 'dist-ssg');

// Canonical base — override with DOCS_BASE_URL for the deployed site.
const BASE = (process.env.DOCS_BASE_URL ?? 'http://localhost:4190/docs/').replace(/\/?$/, '/');

// Release snapshots (docs/v<x.y.z>/ mounts) set VITE_DOCS_VERSION to the
// version dir name — e.g. 'v0.1.0' — stamping it into <meta
// solid-mvc:version> so docs.js can resolve paths across the extra
// segment, plus a noindex so the immutable copy never outranks the live
// docs. Latest builds emit 'latest'.
const DOCS_VERSION = process.env.VITE_DOCS_VERSION || 'latest';

const ssgEntry = readdirSync(ssgDir).find((f) => /\.(m?js)$/.test(f));
if (!ssgEntry) {
  console.error('prerender: dist-ssg bundle missing — run `vite build --ssr src/ssg.tsx` first');
  process.exit(1);
}
const ssg = await import(pathToFileURL(join(ssgDir, ssgEntry)).href);

const template = readFileSync(join(dist, 'index.html'), 'utf8');
// The overview route OVERWRITES dist/index.html — rerunning this script
// without a fresh `vite build` would read the emitted page as the template
// (markers gone, root div filled) and stamp the overview body into every
// route. Fail loudly instead of corrupting the site.
if (!template.includes('<!--ssg:head-->') || !template.includes('<div id="root"></div>')) {
  console.error('prerender: dist/index.html is an emitted page, not the vite template — run `vite build` first');
  process.exit(1);
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function headBlock(route) {
  const url = route.id === 'overview' ? BASE : `${BASE}${route.id}/`;
  return [
    `<meta name="solid-mvc:route" content="${route.id}" />`,
    `<meta name="solid-mvc:version" content="${esc(DOCS_VERSION)}" />`,
    ...(DOCS_VERSION === 'latest' ? [] : ['<meta name="robots" content="noindex" />']),
    `<link rel="canonical" href="${esc(url)}" />`,
    '<meta property="og:type" content="article" />',
    '<meta property="og:site_name" content="SolidMVC" />',
    `<meta property="og:title" content="${esc(route.title)}" />`,
    `<meta property="og:description" content="${esc(route.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(BASE)}social.png" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="SolidMVC — shield logo and wordmark" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(route.title)}" />`,
    `<meta name="twitter:description" content="${esc(route.description)}" />`,
    `<meta name="twitter:image" content="${esc(BASE)}social.png" />`,
  ].join('\n    ');
}

function buildPage(route) {
  const depth = route.id === 'overview' ? 0 : route.id.split('/').length;
  const up = '../'.repeat(depth);
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(route.title)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${esc(route.description)}" />`
    )
    .replace('<!--ssg:head-->', headBlock(route))
    // Solid never runs in the built site — drop the SPA entry + preloads.
    .replace(/<script type="module"[^>]*><\/script>\s*/g, '')
    .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
    // vite emits ./assets/… against base './' — correct at root, broken one
    // or more levels deep. Rewrite before content injection so literal
    // `./`-looking text inside rendered code samples is never touched.
    .replace(/(href|src)="\.\//g, `$1="${up}`)
    .replace('<!--ssg:script-->', `<script defer src="${up}docs.js"></script>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root">${ssg.renderRoute(route.id)}</div>`
    );
}

// The only client script — version switcher, sidebar scroll persistence,
// legacy #/ redirects, and revealing the active nav link. Plain DOM, no
// framework.
const DOCS_JS = `(function () {
  var meta = document.querySelector('meta[name="solid-mvc:route"]');
  var route = meta ? meta.content : 'overview';
  var depth = route === 'overview' ? 0 : route.split('/').filter(Boolean).length;
  var verMeta = document.querySelector('meta[name="solid-mvc:version"]');
  // The mount dir is ground truth — the version segment sits right before
  // the route segments (docs/v<x.y.z>/<route>/), so it works under any
  // Pages base prefix.
  var pathSeg = location.pathname.split('/').filter(Boolean);
  var verSeg = pathSeg[pathSeg.length - 1 - depth];
  var ver = /^v\\d+\\.\\d+\\.\\d+$/.test(verSeg || '')
    ? verSeg
    : verMeta ? verMeta.content : 'latest';
  // Versioned snapshots sit one segment deeper (docs/v0.1.0/<route>/), so
  // climbing out to the docs root takes an extra '../' on those pages.
  var root = '../'.repeat(depth + (ver === 'latest' ? 0 : 1));
  var routePath = depth ? location.pathname.split('/').filter(Boolean).slice(-depth).join('/') + '/' : '';
  if (location.hash.indexOf('#/') === 0) {
    var id = location.hash.slice(2);
    location.replace('../'.repeat(depth) + (id === 'overview' ? '' : id + '/'));
    return;
  }
  // Version switcher — route-preserving segment swap between the latest
  // docs (docs/<route>/) and snapshots (docs/<ver>/<route>/). The option
  // list is refreshed from versions.json at the live docs root, so
  // snapshots built before a release still learn about it.
  var verSel = document.querySelector('select.version-switch');
  if (verSel) {
    fetch(root + 'versions.json').then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (manifest) {
      if (!manifest || !manifest.versions) return;
      var list = ['latest'].concat(manifest.versions);
      verSel.innerHTML = '';
      list.forEach(function (v) {
        var o = document.createElement('option');
        o.value = o.textContent = v;
        verSel.appendChild(o);
      });
      verSel.value = ver;
      verSel.hidden = list.length < 2;
    }).catch(function () {});
    verSel.addEventListener('change', function () {
      var v = verSel.value;
      location.href = root + (v === 'latest' ? '' : v + '/') + routePath;
    });
  }
  var sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.scrollTop = +(sessionStorage.getItem('docs:sidebar-scroll') || 0);
    sidebar.addEventListener('scroll', function () {
      sessionStorage.setItem('docs:sidebar-scroll', sidebar.scrollTop);
    });
    var activeLink = sidebar.querySelector('.nav-link.active');
    if (activeLink) {
      var sb = sidebar.getBoundingClientRect();
      var ar = activeLink.getBoundingClientRect();
      if (ar.top < sb.top || ar.bottom > sb.bottom) {
        sidebar.scrollTop += ar.top - sb.top - sb.height / 3;
      }
    }
  }
})();
`;

let count = 0;
for (const route of ssg.ROUTES) {
  const dir = route.id === 'overview' ? dist : join(dist, route.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), buildPage(route));
  count++;
}

writeFileSync(join(dist, 'docs.js'), DOCS_JS);
writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
writeFileSync(
  join(dist, 'sitemap.xml'),
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${BASE}</loc></url>`,
    ...ssg.ROUTES.filter((r) => r.id !== 'overview').map(
      (r) => `  <url><loc>${BASE}${r.id}/</loc></url>`
    ),
    '</urlset>',
    '',
  ].join('\n')
);

// The emitted pages no longer reference the SPA entry chunk — remove it and
// its modulepreload siblings from dist so the artifact carries no dead JS.
for (const f of readdirSync(join(dist, 'assets'))) {
  if (/^index-.+\.js$/.test(f)) unlinkSync(join(dist, 'assets', f));
}

console.log(`prerender: ${count} routes → dist/`);
