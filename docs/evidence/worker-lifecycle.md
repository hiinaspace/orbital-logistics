# Worker lifecycle follow-up — 2026-10-08

User observed “Simulation paused: worker failed” after lunar freight → continuous
service; reset recovered. The original failure's browser error details were not
captured, so its exact cause is unconfirmed.

Reproduced the same loading failure in production Chrome by opening continuous
service, switching to lunar freight, retiring old hashed worker URLs with404
responses, then returning to continuous. The old implementation failed readiness
and showed the generic worker failure. This models a tab kept open while Vite's
next build empties/replaces `dist/assets`; the previous delivery did rebuild after
staging the tab.

Both worker bundles now use Vite's documented
[`?worker&inline`](https://vite.dev/guide/features.html#web-workers) constructor.
The loaded viewer owns the code needed to recreate workers; later set changes
need no retired worker asset. This adds bundled code size (~100k uncompressed),
avoids persistent asset archives, and preserves generation/sequence/fault semantics.
Workers have stable diagnostic names, and runtime error messages are retained.
No runtime errors trigger automatic reload or world reset.

Four production browser cases pass: history/live/restart/cancellation, deliberate
delayed reply and hidden pause, the retired-asset regression, and12 repeated
continuous/lunar freight/powered transitions. The original case has not been
reproduced through scene state alone. These checks remain in `tests/browser/traffic.spec.ts`.
