# Public entry

The root page is a linear project article: title/byline, a small cycler animation,
paired-frame and relief screenshots, exhibit links, and open simulation notes.
There are no feature cards, promotional navigation bars or FAQ accordions. The
single reading column is752px wide at desktop sizes; the animation is capped
at560px. Space Grotesk and the viewer's palette keep the two pages related without
copying the workspace's panel controls. The owner rewrote `index.html` on October14;
a proofreading pass corrected spelling/grammar and narrowed the Hohmann claim.
The header has a centered native Open Viewer link styled as a raised gold action.
The author credit appears once at the foot of the article. The article otherwise retains the owner's register.

The article is readable without JavaScript. Both viewer screenshots are lazy
static WebP images with reserved dimensions, alt text and full-resolution links.
They add62,110bytes combined and do not embed another running viewer. The captures
come from the current Cycler fleet at epoch20 in a1460×960 Chrome viewport, with
the sidebars collapsed and only the viewport area captured (1460×706):

- `public/images/paired-frames.webp`: Inertial + Rotating layout, both Top cameras.
- `public/images/gravity-relief.webp`: single rotating frame, relief gain1.8, grid
  and potential layers enabled, default oblique camera.

PNG captures were encoded as WebP at quality90 without compositing or altering
the rendered scene. The desktop/narrow page images below show their placement.

## Loading and lifetime

The implementation follows Vite's multi-page entry pattern. `/` and `/viewer/`
are separate documents and dependency graphs. The root page never imports the
viewer registry, numerical engines or worker bootstraps. A full navigation owns
each page's lifetime. Pagehide disposes the preview/workspace; a BFCache restore
reloads the relevant document rather than exposing disposed canvases or sessions.
Simulation persistence while reading the article is intentionally unnecessary.
No framework router, backend or third-party font/image host is required.

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

## Validation, 2026-10-14 editorial revision

- `npm run build` passes strict TypeScript and produces both HTML documents.
- All five production entry browser cases pass: unloaded viewer/fixtures/workers,
  animation pause/offscreen behavior, no-JS/reduced-motion at360px, lazy image
  loading, viewer navigation/back/forward, native camera radios and static hosting
  under `/collection/`.
- Before the owner rewrite, a1440px desktop article visit followed by scrolling
  both figures into view,
  fetched21,321decoded bytes of JavaScript,2,522bytes CSS,12,210bytes SVG,
  23,060bytes local font and62,110bytes WebP. Including HTML, the complete article
  is approximately131KB decoded. These are local resource measurements, not
  network field percentiles.
- The installed Firefox156 isolated-profile smoke passes the article animation
  and existing viewer controls, dropdown stability and field/relief checks.
- Desktop and360px browser screenshots were inspected; neither has horizontal
  overflow. No real-phone, deployed-domain, certificate or Cloudflare header
  result is claimed.
- After proofreading and the action-button change, the build and all five
  production entry cases passed again. Desktop1440px and narrow360px checks
  found no overflow; keyboard Enter on Open Viewer entered `/viewer/`. Screenshots
  below reflect the owner copy and button.
- The later [publication review](../../publication-review.md) adds the Unlicense
  and deployable third-party notices. Source visibility remains private pending a
  remote cache cleanup. October15 rewrote those historical raw log bodies and
  updated the private GitHub branch in place; the provider still retains original
  objects by SHA.
- The implementation paragraph links to `/build-log/`, a separate static transcript
  entry with105 owner exchanges and retrospective summaries.
- The previous scaffold's21-case workspace/entry validation remains historical;
  this revision changes only the article, its illustrations and entry assertions.

The read-only [Pages investigation](../../deployment/cloudflare-pages.md) records
publishing prerequisites. No production changes were authorized or performed.

![Desktop article](desktop.png)

![Narrow article](mobile.png)

## Viewer controls from the initial entry slice

Camera View/Track controls are native radio groups with per-pane names, styled as
exclusive button panels. Compact menus expose every option immediately; wide views
use those same controls inline. Native arrow keys stay within their own group.
Surface retains its deliberate framing behavior and tracking retains its own
locked target. The article revision does not change these controls.

![Exclusive camera panels](camera.png)

## October15 figure links and transcript styling

Each figure caption now links into its captured Cycler fleet presentation:
`#set=aster-selene-cycler-fleet-service&view=frames` and `&view=relief`.
These are two validated named entry presets, not a general physical-state importer.
Both seek the admitted initial history to epoch20 and pause; sidebars start closed.
Frames opens independent inertial/rotating Top views. Relief opens one rotating
oblique view with field/grid enabled and gain1.8. Changing the hash between these
views does not reload the physical session, and Play and other controls still work.
Unknown view tokens and view presets on other sets are ignored. Choosing another
set clears the entry preset. The presentation never changes the flight program.

The transcript differentiates owner messages with rounded, bordered backgrounds;
implementation summaries stay plain. All seven production entry/browser cases
pass, including both figure links, resume, same-set switching without a new
simulation revision and the existing no-JS/subdirectory checks. Desktop and narrow
screenshots were inspected; the centered header action fits without overflow.
