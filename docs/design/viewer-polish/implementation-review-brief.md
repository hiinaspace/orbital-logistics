# Two-view implementation review

Read-only engineering review requested under the user's Astra review authorization for the viewer architecture. Verify code before critique. Reviewer must not edit, launch services or delegate. Bound to the current change, ~15k tokens maximum; provide concrete correctness issues first.

Goal: reviewed plan.md steps1–2, not landing page yet. Solo hobby project. User approved deeper architecture changes as well as visible polish. Shared clock/worker, independent camera/frame/selection/layers; locked tracking target independent of inspection; docked shared inspector/timeline; curated11-entry lazy catalog.

Verified: `npm run typecheck` and production build pass. Main entry decreased from ~990kB to ~220kB decoded; workers now external ~237/339kB. Field resources have explicit cleanup. One simple inclined-transfer browser probe renders without exceptions. All11 loading / dual-view smoke and numerical regression are currently running; not yet passing claims. Existing browser tests still address old UI and retired entries and will be replaced/adapted; no claim of existing browser-suite pass.

Files to inspect: src/viewer/{session,viewport,workspace,controls,catalog,loaders,shared}.ts, src/view/{potential-layer,relief}.ts; git show HEAD:src/main.ts for accepted prior semantics. docs/design/viewer-polish/{plan,disposition}.md for review decisions.

Important invariants: TrafficViewStore.view(cursor) is cursor-dependent. Preserve100ms refresh plus actual-coverage invalidations and publication coherence. Half-open event timestamps/canonical physics remain in unchanged engines. One bounded outstanding request, generation/sequence rejection, held reply semantics, fault visibility, reverse/Live. No physics changes intended. Historical per-vertex epoch transform remains in renderer. Foreground aggregate backing budget8.3MP, at most2field instances16MiB each; relief backing existing1024max.

Review focus: session extraction semantic parity vs original (especially first ingest, held reply, pending seek, publication ready order), pane isolation/lifetimes/selection tracking, genuine resource leaks/stale callbacks, resize/split and keyboard ownership, timeline unified seeking. Spot substantive loading/bundle regressions. Look for accidental omissions from generated extraction. Do not re-review numerical solvers, real-world flight realism or propose framework/schema rewrites.

Open judgement: ownership interfaces adequate? Could a second view affect physics scheduling besides wall-clock performance? Any mutable presentation transition accidentally left in drawing? Session currently uses document.hidden as a playback gate, not in dynamics. Public catalog retires superseded entries but preserves shared fixture/compiler dependencies. Solar profile asset is still demand loaded. There is one expected build warning: freight district fixture is statically imported by its validator; assess practical scope, not generic purity.
