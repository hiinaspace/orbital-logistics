# Cloudflare Pages deployment

## Live soft deployment — 2026-10-15

- Site: <https://orbital.hiina.space/>
- Viewer: <https://orbital.hiina.space/viewer/>
- Build history: <https://orbital.hiina.space/build-log/>
- Pages project: `orbital-logistics`, direct upload, production branch `main`.
- Deployment: `d4a42016`, from source commit `2552e7914e70b919d79dc2ad359e3d353def180f`.
- Immutable deployment URL: <https://d4a42016.orbital-logistics.pages.dev/>
- DNS: proxied CNAME `orbital.hiina.space` → `orbital-logistics.pages.dev`, automatic TTL.
- Source repository visibility remains private for owner review. Pages has no Git
  integration and does not publish repository files; only `dist` was uploaded.

The existing `cf` credentials had Pages and DNS permissions. Wrangler's separate
stored login was expired; the working `cf` OAuth token was passed only through the
upload subprocess environment, without printing it or saving a second credential.
No login, unrelated DNS record, other Pages project or account setting was changed.
The custom domain was registered with Pages before its exact DNS record was added.

## Updating the site

```sh
npm ci
npm run build
PLAYWRIGHT_PREVIEW=1 npm run test:browser -- tests/browser/landing.spec.ts
npx wrangler@4.151.0 pages deploy dist --project-name orbital-logistics --branch main
```

The last command needs a working Wrangler login or `CLOUDFLARE_API_TOKEN` supplied
securely from the existing Cloudflare credentials. Do not commit tokens or copy
authentication output into source. The production branch label is independent of
the local source branch; no Git integration or automatic deploy on push is configured.
Future uploads to this project retain the custom domain; DNS creation is one-time.

`npm run prepare:landing` regenerates the checked-in preview only when its source
cycler geometry changes; it is not needed on every build.

## Build and routes

Vite builds three independent HTML entry points:

- `dist/index.html` → `/`: article, poster and optional small drawing clip.
- `dist/viewer/index.html` → `/viewer/`: full desktop workspace.
- `dist/build-log/index.html` → `/build-log/`: static transcript; Markdown at `/build-log.md`.

`appType: 'mpa'` uses ordinary directory entries; `base: './'` makes generated
assets relative to their HTML/module. No framework router, Pages Functions, SSR or
SPA catch-all rewrite is required. A real `404.html` prevents Pages' implicit SPA
fallback. `_headers` lets HTML revalidate and hashed assets cache immutably.
The largest asset is the13.31MB solar profile, below Pages'25MiB per-file limit;
it is not downloaded on an ordinary landing visit.

## Verification

The production build and all seven local production browser tests passed before
upload. These cover the lightweight landing, reduced motion/no-JavaScript/narrow
layout, navigation, camera controls, paired/relief figure links, transcript and
plain-static-server routing.

Custom-domain HTTPS was verified against the IPs returned by both Cloudflare and
Google public DNS, with normal certificate verification. Landing, viewer, HTML
transcript, Markdown transcript and notices returned200 and matched local `dist`
bytes. Unknown paths returned404; HTML used `no-cache`, hashed JavaScript used
one-year immutable caching, and security headers were present.

The live browser checks passed for landing playback, reduced motion/no-JS, narrow
layout, viewer navigation, camera panels and paired/relief figure links. Browser
requests were temporarily directed to the current public-DNS edge because this
machine's resolver still cached the previous wildcard record. The transcript's
separate Node API request initially followed that stale record and failed TLS;
the Markdown response was independently byte-checked through the correct edge.
No certificate-validation bypass was used. Temporary test routing/configuration
was kept outside tracked source and removed afterward.

## Sources

- [Vite multi-page builds](https://vite.dev/guide/build.html#multi-page-app)
- [Pages serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Custom headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
