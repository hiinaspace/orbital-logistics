**Recommendation: proceed with the bounded one-ship design and the negative-time support prelude.** The main contract to settle is how an admitted episode becomes committed fleet history.

**Verified:** I checked the planner, fleet engine, Runner, resource and view paths. Read-only probes of both rebased legs at window indices 0, 1, 64 and 10,000 reached their destinations at the production step. Maximum position/speed residual was below `1e-11`; return fuel remained approximately `.08`. The prelude produced exactly `dock(-h) → launch(0) → thrust-start(0)`.

**Unknown:** continuous surface integration, independent late-window convergence, close-view accuracy after rebasing/eviction, and browser memory/render costs. The historical test-suite results were not rerun.

Prioritized by leverage:

1. **Define one episode-to-fleet commit contract.** Keep the prelude private to the replayable Runner bundle; no schema extension is warranted for this slice. Today, admission selects the first `dock`, exports the entire ledger, and advances to `scenario.duration` assuming epoch zero. All three assumptions need explicit adaptation. [Planner](/home/s/code/orbital-logistics/src/traffic/planner.ts:44)

   The contract should require:

   - Fleet supplies the actual serviced loadout and owns attachment until successful `launch(0)`. No local transfers; no synthetic surface undock.
   - Public episode coverage starts at local zero. Exclude the support dock from scheduling, events, boundaries, forecasts and berth accounting.
   - Identify arrival by its designated operation ID, destination, kind and exact local epoch—not merely `dock`/`land`.
   - Arrival or fault commits cumulative episode fuel usage exactly once. Successful arrival acquires one berth and begins fleet service; a fault preserves the paid prefix and last-known state.
   - Preserve original local epochs and ordering alongside global timestamps. Compute the padded terminal epoch as `scenario.epoch + scenario.duration`.

2. **Separate predicted drawing data from committed coverage.** Reusing admitted samples is sound when prediction and execution share the same Runner, as production currently does. However, *truncating the prediction and inserting a fault endpoint is insufficient*: the existing fault adapter changes thrust before failure, so the actual prefix can already differ. Dense actual history must come from execution, or reuse prediction only while equivalence is guaranteed. Keep the original prediction available when scrubbing to a time before the fault became known. [Engine](/home/s/code/orbital-logistics/src/traffic/engine.ts:99), [fault fixture](/home/s/code/orbital-logistics/tests/sim/traffic.test.ts:55)

3. **Replace the tentative 32,768-sample budget.** With `.3` service durations and no shortages, the frozen windows yield a roughly `17.636`-unit round-trip cadence. A schedule calculation retains **16 episodes / 58,640 flight samples** across 128 history units, before exact-event additions.

   Retaining dense episode samples remains reasonable for one Swift. Start with **65,536 dense samples per worker/main cache**, explicitly account for the pending packet and held-history overlap, and retain the existing canonical-node ceiling. Measure bytes including transient copies, packet size, view construction and paint time before acceptance. Restrict rendering to the visible interval; current trail drawing scans all samples and draws individual segments. Do not raise the fleet-wide sampling rate. [Retention](/home/s/code/orbital-logistics/src/traffic/engine.ts:130), [drawing](/home/s/code/orbital-logistics/src/main.ts:304)

4. **Keep the domain narrow and finish precision evidence.** Adopt the explicit surface-domain discriminator, fixed hardware/loadouts/phases, finite external flows and one ship. Preserve exact operation, arc and cap-transition times; cap transitions are integration boundaries, not ledger events. Test distinct-event representability near the **last admissible window below one million**: index 10,000 reaches only about 88,188. Retain the proposed three-step/DOP853 and event-side display gates. Whiskers remain an independent UI change.

**Human decisions:** none block implementation. Prelude versus initial attachment, retention strategy and single-ship scope are engineering decisions within the accepted direction. Whisker appearance remains optional taste feedback.

No files edited; no delegation or web access.
