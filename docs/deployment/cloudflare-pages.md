# Cloudflare Pages deployment

Read-only inspection, 2026-10-14. Nothing has been created or deployed and no DNS,
authentication or account settings were changed.

## Recommendation

Use a direct-upload Pages project named `orbital-logistics`, with
`orbital.hiina.space` as its custom domain. This matches the existing `nyaastats`
project: its source is null, no Cloudflare build command/output is configured,
production is `main`, and the active custom domain has a proxied CNAME to
`nyaastats.pages.dev`. Its latest production deployment succeeded October11.

The authenticated `cf`1.0.0-beta.17 project/domain/DNS reads succeeded. The account
currently has two Pages projects, including `nyaastats`; neither has the Orbital
custom domain. No exact DNS record exists for `orbital.hiina.space`. Recheck all of
these before eventual publishing. Account IDs and credentials are not stored here.

Wrangler is a separate prerequisite: cached Wrangler4.87.0 `whoami` failed token
refresh with HTTP400 and reported not logged in. No login or credential change
was attempted. Do not assume working `cf` credentials authenticate Wrangler; before
upload, restore/provide its authentication and verify access to the intended Pages
account. The commands below are a proposed procedure, **not an executed deployment**.

## Build and routes

```sh
npm ci
npm run build
```

Vite builds two independent HTML entry points:

- `dist/index.html` → `/`: semantic HTML, poster and optional small drawing clip.
- `dist/viewer/index.html` → `/viewer/`: full desktop workspace.
- `/viewer/#set=aster-selene-system`: intentional direct exhibit entry.

`appType: 'mpa'` uses ordinary directory entries; `base: './'` makes generated
assets relative to their HTML/module. No framework router, Pages Functions, SSR or
SPA catch-all rewrite is required. A real `404.html` prevents Pages' implicit SPA
fallback. `_headers` lets HTML revalidate and hashed assets cache immutably.
Unknown root `#set` links are not a compatibility requirement.

The largest current asset is the existing13.31MB solar profile, below Pages'25MiB
per-file limit. It is not part of a landing visit. No asset-storage service is
needed at this size. The preview is checked into source; use `npm run
prepare:landing` after changing its source cycler geometry, not on each site build.

## Eventual publishing procedure

These mutate remote state and were deliberately not executed in this investigation.
Review the draft page copy and confirm direct upload versus Git integration before
creating the project; Cloudflare documents that an existing direct-upload project
cannot simply be switched to Git integration.

```sh
npx cf pages create --name orbital-logistics --production-branch main
npx wrangler pages deploy dist --project-name orbital-logistics --branch main
npx cf pages domains create orbital-logistics --name orbital.hiina.space
```

Register the custom domain with Pages before adding its CNAME. Inspect the exact DNS
record again; the domain operation/dashboard may create it. Only if it remains absent:

```sh
npx cf dns records list --zone hiina.space --name-exact orbital.hiina.space
npx cf dns records create --zone hiina.space --body '{"type":"CNAME","name":"orbital.hiina.space","content":"orbital-logistics.pages.dev","proxied":true,"ttl":1}'
```

Verify the returned domain/certificate state, HTTPS at `/` and `/viewer/`, direct
exhibit refreshes, asset responses and caching. Observe an ordinary landing visit's
network requests to verify no viewer/fixture/worker requests. Then exercise entry,
Home and browser Back/Forward. No deployed-domain or certificate claim is made yet.

## Sources

- [Vite multi-page builds and relative base](https://vite.dev/guide/build.html#multi-page-app)
- [Cloudflare Pages serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Custom headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Pages asset limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare CLI](https://developers.cloudflare.com/cf/)
