// Builds the SolidMVC asset family from the Solid mark
// (solid-logo.svg — the official CC0 mark from simple-icons): the
// orbit swirl + nucleus, held inside an Angular-style SHIELD instead of
// the cube hexagon.
//
//   node build-logo.mjs  → all SVGs; rasterize PNGs via headless Edge:
//     msedge --headless --screenshot=out.png --window-size=N,N file.svg
//     (add --default-background-color=00000000 for transparency)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// ── source art extraction ──────────────────────────────────────────────
// The Solid mark (solid-logo.svg — the official CC0 mark from
// simple-icons) is a single path: two subpaths forming the stacked
// swoosh. No shell geometry to strip — the whole mark rides inside our
// Angular-style shield.
const SRC = readFileSync(join(here, 'solid-logo.svg'), 'utf8')
  .match(/d="([^"]+)"/)[1];
const SWIRL = SRC.trim();

// Angular-style shield in the same 24×24 space the cube occupied:
// rounded peak and lower side corners (Q curves); pointed shoulder
// corners and a sharp bottom vertex. Vertically flattened about the
// shoulder line (y≈5.3, factor 0.85): spans 2.15→18.05.
const SHIELD =
  'M 10.28,2.84 Q 12,2.15 13.72,2.84 L 19.8,5.3 ' +
  'L 18.97,12.57 Q 18.78,14.26 17.11,15.19 L 12,18.05 ' +
  'L 6.89,15.19 Q 5.22,14.26 5.03,12.57 L 4.2,5.3 Z';

// The swoosh fills its 24×24 viewBox edge-to-edge; the shield narrows
// mid-height, so scale it to sit inside AND recenter it on the shield's
// visual center (12,10.1) rather than the square's (12,12).
const SWIRL_T = 'translate(6.6 4.75) scale(0.45)';

// ── mark on the 500×550 canvas (scale 15) ─────────────────────────────
// The shield's own center is y=10.1 in the 24-unit space, so translate
// y = 225 - 10.1*15 puts the mark's visual center at canvas 250,225.
function mark(shieldInk, orbitInk) {
  return `
  <g transform="translate(70 73.5) scale(15)">
    <path d="${SHIELD}" fill="${shieldInk}"/>
    <g transform="${SWIRL_T}"><path d="${SWIRL}" fill="${orbitInk}"/></g>
  </g>`;
}

// Knock-out mark: the orbit becomes a transparent hole via mask — the
// background shows through, so one file works on any surface.
function markKnockout(ink) {
  return `
  <defs><mask id="knockout"><path d="${SHIELD}" fill="#fff"/>
    <g transform="${SWIRL_T}"><path d="${SWIRL}" fill="#000"/></g></mask></defs>
  <g transform="translate(70 73.5) scale(15)">
    <path d="${SHIELD}" fill="${ink}" mask="url(#knockout)"/>
  </g>`;
}

const TEXT = (ink) => `
  <text x="250" y="445" font-family="system-ui, -apple-system, sans-serif"
        font-weight="800" font-size="38" fill="${ink}" text-anchor="middle"
        letter-spacing="1">Solid<tspan fill="#2c4f7c">MVC</tspan></text>
  <text x="250" y="480" font-family="system-ui, -apple-system, sans-serif"
        font-weight="600" font-size="14" fill="${ink}" text-anchor="middle"
        letter-spacing="3">ANGULAR-STYLE MVC ON SOLID</text>`;

// ── variants ────────────────────────────────────────────────────────────
const NAVY = '#2c4f7c';
const ORBIT = '#ffffff';

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>\n`;

const themed = (bg0, bg1, ink, viewBox = '0 0 500 550') =>
  svg(
    viewBox,
    `
  <defs><radialGradient id="bg" cx="50%" cy="45%" r="75%">
    <stop offset="0%" stop-color="${bg0}"/><stop offset="100%" stop-color="${bg1}"/>
  </radialGradient></defs>
  <rect width="500" height="550" fill="url(#bg)"/>${mark(NAVY, ORBIT)}${TEXT(ink)}`
  );

// full logo — ice-blue wash / deep navy panel, brand navy shield
writeFileSync(join(here, 'solidmvc-light.svg'), themed('#eaf3fb', '#d0e3f4', '#1c3a5c'));
writeFileSync(join(here, 'solidmvc-dark.svg'), themed('#1b3452', '#0d1f33', '#dcebf8'));

// transparent full logo — mark + wordmark, no panel (for themed pages)
writeFileSync(
  join(here, 'solidmvc-light-t.svg'),
  svg('0 0 500 550', mark(NAVY, ORBIT) + TEXT('#1c3a5c'))
);
writeFileSync(
  join(here, 'solidmvc-dark-t.svg'),
  svg('0 0 500 550', mark(NAVY, ORBIT) + TEXT('#dcebf8'))
);

// compact — artwork region only, square crop with even margins (shield
// bounds x133–367 / y84.75–365.25 on the canvas, center 250,225)
writeFileSync(join(here, 'solidmvc-compact-light.svg'), themed('#eaf3fb', '#d0e3f4', '#1c3a5c', '80 55 340 340'));
writeFileSync(join(here, 'solidmvc-compact-dark.svg'), themed('#1b3452', '#0d1f33', '#dcebf8', '80 55 340 340'));

// favicon — mark only, no text, tight 1:1 square bounding the shield.
// The orbit is transparent (knock-out) so a single file works on light
// and dark browser chrome alike. `-white` is for brand-colored bars
// (the orbit shows the bar's navy through).
writeFileSync(
  join(here, 'solidmvc-icon.svg'),
  svg('100 75 300 300', markKnockout(NAVY))
);
writeFileSync(
  join(here, 'solidmvc-icon-white.svg'),
  svg('100 75 300 300', markKnockout('#ffffff'))
);

// horizontal lockup — mark left, wordmark + tagline right. Transparent.
const horizontal = (ink) =>
  svg(
    '0 0 580 200',
    `
  <g transform="translate(${90 - 250 * 0.58} ${100 - 225 * 0.58}) scale(0.58)">
${mark(NAVY, ORBIT)}
  </g>
  <text x="200" y="115" font-family="system-ui, -apple-system, sans-serif"
        font-weight="800" font-size="58" fill="${ink}" letter-spacing="1">Solid<tspan fill="${NAVY}">MVC</tspan></text>
  <text x="203" y="152" font-family="system-ui, -apple-system, sans-serif"
        font-weight="600" font-size="17" fill="${ink}" letter-spacing="2.6">ANGULAR-STYLE MVC ON SOLID</text>`
  );
writeFileSync(join(here, 'solidmvc-horizontal-light.svg'), horizontal('#1c3a5c'));
writeFileSync(join(here, 'solidmvc-horizontal-dark.svg'), horizontal('#dcebf8'));

// brand lockup — mark + wordmark sized so the text fills the icon's height.
const brand = (ink) =>
  svg(
    '0 8 780 240',
    `
  <g transform="translate(${100 - 250 * 0.62} ${128 - 225 * 0.62}) scale(0.62)">
${mark(NAVY, ORBIT)}
  </g>
  <text x="212" y="172" font-family="system-ui, -apple-system, sans-serif"
        font-weight="800" font-size="96" fill="${ink}" letter-spacing="1">Solid<tspan fill="${NAVY}">MVC</tspan></text>
  <text x="216" y="225" font-family="system-ui, -apple-system, sans-serif"
        font-weight="600" font-size="30" fill="${ink}" letter-spacing="2.4">ANGULAR-STYLE MVC ON SOLID</text>`
  );
writeFileSync(join(here, 'solidmvc-brand-light.svg'), brand('#1c3a5c'));
writeFileSync(join(here, 'solidmvc-brand-dark.svg'), brand('#dcebf8'));

// social card — 1200×630 og:image. Dark panel + brand lockup centered;
// rasterize with --window-size=1200,630 (the opaque dark panel reads on
// light and dark chat/social themes alike).
writeFileSync(
  join(here, 'solidmvc-social.svg'),
  svg(
    '0 0 1200 630',
    `
  <defs><radialGradient id="bg" cx="50%" cy="45%" r="75%">
    <stop offset="0%" stop-color="#1b3452"/><stop offset="100%" stop-color="#0d1f33"/>
  </radialGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g transform="translate(100.8 151.2) scale(1.28)">
    <g transform="translate(${100 - 250 * 0.62} ${128 - 225 * 0.62}) scale(0.62)">
${mark(NAVY, ORBIT)}
    </g>
    <text x="212" y="172" font-family="system-ui, -apple-system, sans-serif"
          font-weight="800" font-size="96" fill="#dcebf8" letter-spacing="1">Solid<tspan fill="${NAVY}">MVC</tspan></text>
    <text x="216" y="225" font-family="system-ui, -apple-system, sans-serif"
          font-weight="600" font-size="30" fill="#dcebf8" letter-spacing="2.4">ANGULAR-STYLE MVC ON SOLID</text>
  </g>`,
  ),
);

// monochrome mark — single-color glyph for badges/inline use; the orbit
// is a knock-out so it works over any background.
writeFileSync(join(here, 'solidmvc-mark.svg'), svg('100 75 300 300', markKnockout('currentColor')));

console.log('wrote solidmvc-{light,dark}.svg, solidmvc-{light,dark}-t.svg, solidmvc-compact-{light,dark}.svg, solidmvc-icon{,-white}.svg, solidmvc-horizontal-{light,dark}.svg, solidmvc-brand-{light,dark}.svg, solidmvc-mark.svg, solidmvc-social.svg');
