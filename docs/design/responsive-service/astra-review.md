gpt-6-astra · xhigh, verified in [review.log](/home/s/code/orbital-logistics/docs/design/responsive-service/review.log:7).

**Adopt bounded playback buffering, but fix committed-state sampling and faulted history first.** The engine can retain its present physical contract. Sixteen units is a reasonable initial buffer size; its adequacy at 1× remains unverified.

1. **P1 — Advancing the cursor through the existing scene descriptor can display incorrect resources.**

   [AdaptiveViewStore.view()](/home/s/code/orbital-logistics/src/adaptive/view.ts:52) retains actual samples through the requested cursor, then appends predictions and synthesized attached coasts. Consequently, `t ≤ frontier` alone does **not** ensure that `sampleVessel(run, t)` reads committed history.

   I reproduced this with the current engine at frontier 64: a descriptor built at **54.49**, sampled at **54.51**, reports fuel **0.6558476925** and activity `service`. A fresh view at 54.51 correctly reports **0.9** and `waiting`. The intervening origin refuel was already committed.

   **Fix:** give playback an actual-state sampling path, backed by committed frames, admitted dense samples and exact event boundaries. Keep future-path construction separate. Every painted cursor must use this actual path; graph/timeline rebuilding can remain throttled. Preserve `knownAt ≤ cursor` filtering for visible plans and controls. If retaining the current combined descriptor temporarily, refresh before crossing resource events, admission epochs or descriptor validity boundaries—even when no worker reply arrives.

   This deserves the strongest acceptance test: with a fixed, already-buffered frontier, advance the display clock across refuel, departure, capture, transfer and release; compare every displayed state against a fresh committed query.

2. **P1 — A later fault currently breaks earlier scrubbing.**

   The halt branch sets the view end to the global frontier, overriding the shorter coverage available from chunks known at the historical cursor. [view.ts:39](/home/s/code/orbital-logistics/src/adaptive/view.ts:39)

   I reproduced a second-trip capture failure at **93**. After ingesting it, `view(0)`, `view(40)` and `view(55)` all throw **“Display target epoch outside validity”**; `view(77)` and `view(93)` succeed. Existing fault tests exercise the fault head, so they miss this.

   **Fix:** a halt may shorten validity, never extend it. Compute the forecast end as:

   ```text
   min(cursor + 40, last cursor-visible chunk end, halt epoch if present)
   ```

   Keep three separate facts: computation has stopped, playback may continue through committed history, and the cursor has reached the terminal epoch. A fault learned ahead must stop requests immediately while allowing playback to reach its exact event-left failure state. Preserve historical scrubbing afterward. Worker exceptions should likewise preserve playback through the last successfully acknowledged frontier, without claiming validity beyond it.

3. **P1 — Specify the playback clock independently of the refill target and Live destination.**

   Use `F = acknowledged frontier`, `C = playback cursor`, `B = 16`, and `E = max(oldest, F − B)`. **E is a join destination, not the continuous playback ceiling.** Clamping playback to `F − B` every frame would reproduce every solver freeze, merely delayed.

   | Situation | Required behavior |
   |---|---|
   | Playing live | Advance `C = min(F, C + dt × rate)`. Discard time lost to underflow; do not accumulate catch-up debt. |
   | Refilling | Request `min(F + 1, C + B)` only when it exceeds F; retain one outstanding request. |
   | Pause or hidden tab | Freeze C and displayed state; accept at most the pending reply; send no replacement. |
   | Scrub + Play | Replay against the held frontier until C reaches E, then resume refill. If C already exceeds E, resume without rewinding. |
   | Live | Join E from older history. Make it idempotent while already live, and avoid rewinding a cursor already beyond E. |
   | Terminal engine | Drain available history to F and stop there; no reserve needs preserving. |

   [Current request and Live handling](/home/s/code/orbital-logistics/src/main.ts:82) ties requests to `playing && liveMode`; priming therefore needs an explicit loading/refill path independent of those flags. Finish priming when the lead reaches B **or** computation terminates/errors. Otherwise an early halt can leave “Preparing scene…” indefinitely.

   Gate this change to adaptive service; preserve the other runtimes’ existing behavior.

4. **P2 — The optimization is defensible, provided its reuse boundary remains structural.**

   The [current patch](/home/s/code/orbital-logistics/src/adaptive/plan.ts:81) preserves canonical reconstruction and paid captures. Reusing unloaded controls through the arrival/transfer block is justified by the current invariants: ownership events occur on the canonical grid in the quiet half, after that block’s thrust; subsequent loaded controls are solved afresh.

   Preserve these checks explicitly:

   - Identical definition, original anchor and committed control prefix; contiguous reused coverage through `incomingEnd`.
   - No reused thrust overlapping or following an ownership change within that block.
   - Completed shared runners remain read-only; reconstructed ownership derives its own mass, fuel and subsequent anchors.
   - Runtime reconstruction retains safety, capture, funding and reserve validation.

   Moving whole-grid JSON equality into regression tests is reasonable. Runtime comparisons should include block anchors and event **before/after** states; those communicate the ownership invariant better than pointwise sorted JSON.

   The newly added [same-plan test](/home/s/code/orbital-logistics/tests/sim/responsive-service.test.ts:7) is a useful start. Extend the evidence to a late admitted plan and budget-exhaustion/retry cases before claiming unchanged scheduling throughout the run. Physical equivalence and unchanged candidate selection are distinct claims.

5. **P2 — Preserve bounded retention explicitly; buffering consumes part of the existing history window.**

   Engine retention is anchored at `F − 128`, not `C − 128`. [engine.ts:94](/home/s/code/orbital-logistics/src/adaptive/engine.ts:94) At a full 16-unit lead, that leaves **112 units behind the playback cursor**.

   My recommendation for this slice is to retain the existing 128-unit total window and document that accounting internally. Preserving 128 units *behind the cursor* would require larger storage budgets: merely changing retention to 144 already exceeds the current 2,200-frame limit at 16 frames per unit.

   Keep paused/history storage pinned only while requests are stopped, with the existing one-reply allowance. Release it after establishing a cursor inside the new retained interval. Test pausing at the oldest selectable epoch with a reply pending.

   Also account for the newly retained guide in planning storage: [planner.ts:32](/home/s/code/orbital-logistics/src/adaptive/planner.ts:32) keeps it alive while candidates run, but the candidate node check omits it and any previously retained best candidate. Bound the simultaneously reachable runners, counting shared instances once.

6. **P2 — Treat 16 as a provisional constant, not a measured guarantee.**

   The cited artifacts disagree: [baseline-timing.json](/home/s/code/orbital-logistics/docs/design/responsive-service/baseline-timing.json:2) records **19.39 seconds total**, **7.93 seconds initialization**, and holds of **8.59** and **2.74 seconds**. The CPU profile spans approximately **26.98 seconds**. Neither establishes optimized foreground-browser playback performance.

   Keep fixed B initially; adaptive buffering adds unnecessary policy here. Validate sustained 1× playback across several later planning windows, including clustered stalls, worker message overhead and main-thread ingestion. Record startup latency, buffer drawdown and underflow duration. At 16×, the same reserve lasts only one wall-clock second; honest underflow is expected.

**Verification:** both targeted simulation test files passed (`adaptive-runtime.test.ts` and `flexible-service.test.ts`). The two failures above were reproduced with read-only, in-memory probes. No files were edited, no agents were launched, and no literature research was performed. Browser smoothness, long-run optimization parity and independent numerical replay remain for main’s implementation validation. No additional human decision is required before implementing these fixes.
