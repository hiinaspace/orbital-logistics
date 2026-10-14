# Public entry scaffold

The introduction, features, exhibit choices and FAQ are static editorial HTML in
`index.html`; this is draft copy for the owner to rewrite before publication.
The visual language continues Space Grotesk, Plex Mono and the viewer's restrained
panel trim. The page is independently readable without JavaScript. No site-builder
runtime, framework router, backend or third-party font/image host is required.

The implementation follows Vite's multi-page entry pattern. `/` and `/viewer/`
are separate documents and dependency graphs. The root page never imports the
viewer registry, numerical engines or worker bootstraps. A full navigation owns
each page's lifetime. Pagehide disposes the hero/workspace; a BFCache restore
reloads the relevant document rather than exposing disposed canvases or sessions.
Simulation persistence while reading the landing page is intentionally unnecessary.

`npm run prepare:landing` creates `src/landing/preview.json` and
`public/orbital-preview.svg` from the admitted recurring cycler profile. The
existing canonical preparation checks its independent oracle before481 position
samples per carrier are rounded for disposable display. The two-carrier clip is
16,555bytes of JSON, with a verified rotating-frame loop seam. It is a repeating
illustration, not continuous resource execution. The source artifact and numerical
code are build-time inputs only; the browser module contains just frozen points
and a minimal Canvas drawing loop.

The optional enhancement renders at most20fps, caps DPR/backing width, pauses when
out of view or in a background document, offers Play/Pause and honors reduced
motion. Reduced-motion arrivals retain the SVG without downloading the animation
module until Play. The poster reserves its aspect ratio so enhancement cannot
change layout height. Resizing does not restart simulation because there is none.

Camera View/Track controls are native radio groups with per-pane names, styled as
exclusive button panels. Compact menus expose every option immediately; wide views
use those same controls inline. Native arrow keys stay within their own group.
Surface retains its deliberate framing behavior and tracking retains its own
locked target.

Verification includes production browser navigation, no-JS/reduced-motion narrow
screens, no viewer/fixture/worker requests on arrival, preview pause/offscreen
behavior, native keyboard radio behavior, pane independence and full viewer
regressions. Narrow-screen desktop emulation is not a real-device performance
claim. The read-only [Pages investigation](../../deployment/cloudflare-pages.md)
records publishing prerequisites; no production changes were authorized.

![Draft desktop layout](desktop.png)

![Draft narrow layout](mobile.png)

## Validation, 2026-10-14

- `npm run build` passes strict TypeScript and produces both HTML documents.
- All21 distinct production browser cases passed: the20-case workspace/entry run,
  followed by the new static-subdirectory case; all five entry cases also passed
  together after its test-server path correction.
- The installed Firefox156 isolated-profile smoke passes the landing enhancement,
  viewer radio choices, paused native frame dropdown and existing field/control checks.
- A1440px desktop landing visit fetched21,321decoded bytes of JavaScript (entry,
  shared preload helper and preview), with no viewer, worker or full exhibit data.
  Its other loaded resources were6,710bytes CSS,12,210bytes SVG and37,768bytes of
  local fonts, plus the HTML document. The total is about90KB decoded. These are
  local build/resource measurements, not network field percentiles.
- Reduced-motion arrivals do not request the preview module until Play. The
  no-JavaScript360px page remains readable, expands native FAQ entries and retains
  working viewer links. Both tested narrow widths fit without horizontal overflow.
- Plain static hosting under `/collection/` loads the landing, its optional preview,
  the viewer's lazy fixture/worker assets, and the relative Home link. No SPA
  rewrite or backend route was involved.
- Screenshot evidence is desktop browser rendering and narrow viewport emulation;
  no real-phone, deployed-domain, certificate or Cloudflare header result is claimed.

![Exclusive camera panels](camera.png)
