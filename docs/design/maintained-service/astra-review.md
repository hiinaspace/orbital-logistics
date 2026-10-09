I recommend the **separate runtime, immutable forecast chain, and paired round-trip admission**. The design is viable, but trajectory identity, attached-failure behavior, and aggregate budgets need firmer contracts before implementation.

**Verification:** The checkout matches `natto`, `codex/model-set-viewer`, base `32ca545`. Source confirms complete finite provider admission, separate station fuel, prohibited relay exchange, half-open attachment restrictions, and the existing traffic engine’s analytic-port assumptions. [Provider admission](/home/s/code/orbital-logistics/src/sim/runner.ts:50), [attachment checks](/home/s/code/orbital-logistics/src/sim/schema.ts:343), [traffic restrictions](/home/s/code/orbital-logistics/src/traffic/planner.ts:16).

The stationkeeping test file passed. A read-only probe split the existing frozen station program into eight eight-unit Runners: sampled states, fuel, cumulative usage, and the complete ledger matched the original exactly. This verifies those particular chunk boundaries—not the proposed online controller or repeated transfers.

**Unverified:** Online solver latency, repeated-window feasibility, and long-run maintenance remain unknown. The 140 simulation/26 browser results and independent oracle measurements are retained evidence; I did not rerun those full checks.

1. **P1 — Specify owner-to-provider identity; this is the highest-leverage decision.**

   The proposed chunk chain is compatible with the current Runner, but copying terminal position, velocity, and fuel is sufficient only under explicit boundary restrictions. Runner grid phase depends on the scenario epoch, and an active burn carries an immutable mass-law anchor. Existing visitor providers also require one complete definition covering the entire episode. [Canonical stepping](/home/s/code/orbital-logistics/src/sim/runner.ts:281), [mass anchors](/home/s/code/orbital-logistics/src/sim/propulsion.ts:6), [provider validity](/home/s/code/orbital-logistics/src/sim/schema.ts:191).

   I would make the following the narrow contract:

   - Use absolute physical epochs throughout, including the perturbing body’s phase. Fix control epochs explicitly to `8k`; the proposed departure/capture/release offsets depend on that choice.
   - Permit chunk boundaries only on the common canonical grid, with no burn crossing them. Preserve exact terminal six-state and fuel; accumulate paid usage separately because each new Runner starts its own usage counter.
   - Make every admitted chunk permanently immutable within a generation. “Unchanged while targeted” introduces unnecessary revision cases; append-only forecasts are simpler here.
   - Identify a lease by its world/policy, anchor state and fuel, exact controls, interval, and ordered chunk identities. Keep `admittedAt`, physical control epoch, and actual frontier distinct. Initial lookahead checks use predicted states, even though their deterministic ancestry begins at committed state.
   - Compile the full paired visitor’s existing finite provider definitions from that chain. Require equivalence at joins, event boundaries, capture, and release, with matching canonical interval construction between them. Sparse sample agreement alone cannot establish identity.
   - Commit station fuel and events only from the authoritative owner as the frontier passes them. Private visitor providers are reproductions, never additional inventory owners.

   This avoids a general provider abstraction. The decisive next witness is a complete visitor episode spanning several owner chunks, including both captures, with owner/provider equality and partition invariance.

2. **P1 — Paired admission prevents planning deadlock, but does not fully define attached failures.**

   The statement that a return fault leaves a last-known ship while the station continues is safe **after successful undock**. It is insufficient if a failure leaves the visitor attached. Static overlap checks inspect the planned operations; they do not establish that release actually occurred. [Proposed failure rule](/home/s/code/orbital-logistics/docs/design/maintained-service/brief.md:83), [actual undock](/home/s/code/orbital-logistics/src/sim/runner.ts:212).

   Keep paired admission, with return planning chained from the actual post-capture state and remaining fuel. Define three outcomes explicitly: pre-capture faults remain unattached; post-undock faults isolate the visitor; an attached failure or owner/provider mismatch halts the shared runtime before unsupported maintenance.

   Do not silently remove the attachment or suppress a leased correction: the former loses mass, while the latter changes the promised target. A shared halt is the simplest exceptional behavior within this scope. Ordinary immutable execution should never reach it, but the requested fault witnesses should.

3. **P1 — Separate numerical work, retained physics, and display budgets.**

   The existing 128-batch worker limit counts fleet epochs, not solver integrations. Likewise, the current station authoring counter counts residual evaluations and performs an additional accepted propagation afterward. “64/96 propagations” needs an exact accounting definition. [Fleet work limit](/home/s/code/orbital-logistics/src/traffic/engine.ts:137), [authoring counter](/home/s/code/orbital-logistics/spikes/numerics/stationkeeping_search.py:159).

   Count Jacobian probes, line searches, refinement, and final admission explicitly. Use logistics-free trial propagation against already established target endpoints; otherwise constructing a visitor Runner for each trial repeatedly integrates both complete providers. Yield between bounded evaluations while preserving the same logical job. Wall-clock delay must not change whether a candidate succeeds.

   The proposed storage arithmetic also needs resolution. Retaining 64 historical plus 40 future canonical units for three trajectories costs roughly **79,872 grid intervals**. One 30-unit visitor plus its two private providers adds **23,040**, already exceeding 100,000 before event nodes and scratch work.

   Retain only current/future canonical chunks and active provider Runners; keep historical drawing data and resource anchors separately. Prefer preserving the existing **128-unit display history**. With 30-unit trips departing every 32 units, that history can intersect five trips, so four retained round trips is insufficient. Declare additional held-reply allowance and enforce byte limits independently of sample counts. [Existing playback contract](/home/s/code/orbital-logistics/docs/design/continuous-traffic/README.md:40).

4. **P2 — Define degraded maintenance and the changed control objective.**

   The old controller compares each trial endpoint with the circular reference at that trial’s own phase. The proposal fixes the target phase using an unforced coast. That is a reasonable way to select a phase, but it is a changed control law; the old maintenance results do not validate its fuel cost or envelope. [Existing objective](/home/s/code/orbital-logistics/spikes/numerics/stationkeeping_search.py:161).

   Keep safe coast as a solve-failure outcome, but distinguish maintenance-envelope loss from physical invalidity. If fallback coast cannot certify the requested interval, no lease may extend beyond its valid prefix. Future failure knowledge must not become an actual fault early.

   State whether envelope loss stops new visits. My recommendation is to stop new dispatch while allowing already admitted, physically valid trips to complete. This preserves useful failure behavior without expanding into recovery planning.

5. **Lower-risk fork — Keep the separate runtime and bounded feasibility experiment.**

   The current engine and view store assume analytic attachment trajectories in several places, so generalizing them would widen this change substantially. Reuse resource arithmetic, rendering structures, and playback semantics; give maintained service its own explicit domain and store. [Attached display extrapolation](/home/s/code/orbital-logistics/src/traffic/view.ts:50).

   The proposed 5–10-candidate/256-unit experiment is an appropriate stop condition. Require a complete paid pair first, then repeated visits, then the longer soak. Solver failure should produce evidence and stop expansion, as the brief already specifies.

No human decision blocks these engineering choices. Reactive disturbances, maintained-station resupply, or propulsion with attached mass would require another scope decision.

This review made no edits or launched agents. An untracked `src/maintained/` appeared during review; it was outside this architecture assessment.
