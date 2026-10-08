I recommend proceeding with a bounded two-port implementation, after tightening the contract between fleet events and finite flight episodes. The proposed scope is sound. The main architectural risk is allowing the Runner, fleet scheduler, resource ledger, and historical viewer to disagree about what has committed.

I performed this review directly, read-only, without delegation.

Verification established the following:

| Evidence | Finding |
|---|---|
| **[Verified: source]** | Runner privately owns a finite bundle, canonical nodes, event boundaries, and paid capture. Snapshot restoration checks deterministic replay. There is no append/prune API. [runner.ts](/home/s/code/orbital-logistics/src/sim/runner.ts:33) |
| **[Verified: source]** | Current fleet presentation overlays independently executed ships and checks aggregate stocks/berths afterward. Its resource reconstruction starts from initial stocks and the complete ledger. [model.ts](/home/s/code/orbital-logistics/src/model-set/model.ts:40) |
| **[Verified: execution]** | All 95 simulation tests passed when imported directly through the test harness; TypeScript checking passed. |
| **[Verified: in-memory experiment]** | Both Kestrel legs can start from rebased analytical port states, with rotated headings and their actual departure loadouts. At reference-window indices 0, 1, 64, and 10,000, capture position/velocity residuals stayed below \(6\times10^{-10}\). |
| **[Unverified in this review]** | Independent DOP853 and browser checks were inspected as retained evidence, not rerun. Continuous-fleet determinism, throughput, memory bounds, and browser behavior remain unimplemented and unmeasured. |

The checkout advanced externally from `fa9b935` to `58379c2` during review, adding thrust whiskers. I checked that transition: simulation code and `model-set/model.ts` were unchanged. The review directory remains untracked.

My priority order merges the overlapping decisions:

| Priority | Decision | Recommended disposition |
|---|---|---|
| 1 | Episode authority, shared transactions, failures | **Adapt:** define one deterministic fleet commit contract first. |
| 2 | History, frontier, cursor, worker ownership | **Adopt with constraints:** bounded history with independent playback and explicit publication boundaries. |
| 3 | Symmetry planner and numerical time | **Adopt:** narrow validated domain, integer window identity, bounded session time. |
| 4 | External supply/consumption | **Adopt:** simple explicit flows with accounting for actual accepted quantities. |
| 5 | Burn presentation | **Adopt:** keep vectors and projections in the view contract; the concurrent implementation already provides a direction transform. |

The highest-leverage contract is **a finite episode owns flight physics; TrafficEngine owns all shared state and commits**.

Use an episode from departure through capture. TrafficEngine owns attached motion, service, inventory, berth occupancy, retries, cumulative counters, and faults. Episode-local station inventories must never be merged back into fleet stocks. Prohibit transfer operations inside these episode programs; retain the Runner’s physical capture operation.

A small interface is sufficient:

```ts
interface Departure {
  shipId: string;
  voyage: number;
  from: string;
  to: string;
  epoch: number;
  cargo: number;
  fuel: number;
}

interface Episode {
  id: string;
  departure: Departure;
  captureLocalEpoch: number;
  arrivalEpoch: number;
  bundle: Bundle; // privately owned immutable copy
}

type Admission =
  | { kind: "admitted"; episode: Episode }
  | { kind: "waiting"; reason: string; nextWindow: number }
  | { kind: "unavailable"; reason: string };

interface TrafficEngine {
  advanceTo(target: number, workBudget: number): {
    frontier: number;
    yielded: boolean;
    delta: TrafficDelta;
  };
  readWindow(from: number, to: number): TrafficView;
}
```

The worker wraps this with run-generation and request-sequence identifiers. Neither view requests nor worker messages become simulation events.

Internally, distinguish attached, servicing, flying, and faulted states. Waiting is attached state with a reason and next eligible window. Keep at most **one admitted episode per ship**, pending departure or active; a second future episode is unnecessary for this slice.

There are three concrete compatibility issues to address:

- **Runner starts unattached.** Initialize the episode from the authoritative departure rail state, already serviced. TrafficEngine records departure and releases the berth; the episode starts free flight at local zero. Do not manufacture an initial capture/undock pair.
- **The flight duration is not a valid scenario duration.** Both extracted legs last `3.024522336946932`; using this directly fails the grid-alignment requirement. Pad the Bundle horizon to the next grid boundary, retain capture at its exact local event epoch, and commit the episode at capture. The padding is container validity, not additional flight. [schema.ts](/home/s/code/orbital-logistics/src/sim/schema.ts:123)
- **Episode success is successful target capture plus the admission checks.** It is not the legacy delivery-objective result, and capture need not return `status: "horizon"`. My successful probes returned `"running"` at capture.

A completely validated Runner may remain as the episode’s bounded numerical cache. Precomputed nodes and future ledger entries are predictions until TrafficEngine commits their epochs. Prediction must not import terminal fuel, occupancy, or events into current fleet state.

Fuel accounting needs an explicit seam: cumulative ship usage equals completed-episode usage plus current-episode usage. At completion, add that episode’s total once, including capture. Carry actual remaining fuel/cargo forward. Never sum both this total and the same arc/capture ledger entries.

For simultaneous events, specify and test a single order. I recommend:

1. Evaluate continuous station flows through epoch \(T\), and obtain due episode facts at their original local event epochs. Preserve Runner’s internal thrust-end, depletion, and capture ordering.
2. Complete previously started services in a stable configured ship order. Recheck stocks and capacities now; apply each transfer atomically.
3. Admit and release eligible departures, including ships whose service completed at \(T\). Recheck that the serviced loadout still matches the admitted episode.
4. Apply arrivals and flight faults; successful captures occupy their destination berth.
5. Start newly eligible services and schedule retries strictly in the future.
6. Publish the complete epoch batch, with its before/after history boundary.

Berth capacity at least fleet size makes this order sufficient without reservations. Positive service duration prevents arrival-to-service-completion cycles at one epoch. A work-budget yield may occur between committed batches; it must not expose half a shared transaction.

Store event identity using ship, voyage, and local event sequence. Store both absolute and original local epochs. Reconstructing a local capture time by subtracting large absolute timestamps can land on the wrong side of an exact event comparison.

For the planner, rotational reuse is a good bounded choice, with stronger domain validation than “circular ports.”

Require the specified fixed primary, common center, common plane/orientation, supported prograde rates, and exact propulsion/loadout regime. Existing schema validation establishes circular-port validity, but it does not by itself establish the shared planar symmetry your compiler assumes. [schema.ts](/home/s/code/orbital-logistics/src/sim/schema.ts:164)

The measured synodic period is:

\[
T_{\mathrm{syn}} = \frac{2\pi}{\omega_{\mathrm{Kiln}}-\omega_{\mathrm{Anchor}}}
                 \approx 10.709937112074023.
\]

Identify windows by an integer \(k\), computing each departure from the reference and \(kT_{\mathrm{syn}}\). Do not repeatedly add the period or allow a retry to rediscover its failed window. Define equality at service completion explicitly.

Local-zero rebasing changes the numerical grid alignment relative to the original full trip. Demand numerical agreement within the established budget, not bitwise equality. My probes support this change, but remain production-Runner checks rather than independent calibration.

At \(k=10^7\), roughly \(1.071\times10^8\) absolute time units, the return probe’s difference from the rotated reference reached about \(3\times10^{-8}\). This demonstrates that local epochs do not eliminate calendar/phase precision concerns. Establish a tested session ceiling, reduce phases consistently, require strictly representable event ordering, and stop before exhausting the numerical margin. Do not claim unlimited numerical time.

Separate retryable failures—missing stock or a missed window—from unsupported hardware/loadout or numerical-domain failures. Repeating an identical unsupported candidate every window adds noise without progress.

The external-flow proposal is appropriate and smaller than introducing a special unlimited supplier transaction at every service. Use one signed flow per station commodity initially:

\[
x(t)=\operatorname{clamp}(x_a+q(t-t_a),0,C).
\]

Account for **actual** imported/exported quantity, not nominal rate times elapsed time. A full tank rejects further imports; an empty depot cannot continue exporting cargo. Keep these totals anchored analytically between resource-changing events. Neither drawing queries nor arbitrary `advanceTo` endpoints should reanchor them.

Service completion checks current stock and applies ship/station deltas together. Planning failure after successful service leaves that serviced loadout intact; it does not undo completed work. Retrying an already matching loadout must not charge the same transfer again.

The conservation checks are:

- Station cargo + ship cargo + external exports − external imports = initial cargo.
- Station fuel + ship fuel + burned fuel − external fuel imports = initial fuel.

Faulted ships remain in these balances with their last valid resources. Choose supply rates and initial buffers against measured cycle demand and startup bursts; average sufficiency alone does not prevent early starvation.

For history, adopt bounded pages or segments, but treat retained history as a separate data product.

A live window should contain a left-edge state anchor, fixed-cadence drawing samples, exact event sides, station-flow segments, activity intervals, and bounded plan metadata. It must not contain fabricated scenario durations. Current frame code takes a complete `SetRun`; extract its world/origin lookup dependency rather than constructing synthetic Bundles to satisfy that signature. [frames.ts](/home/s/code/orbital-logistics/src/model-set/frames.ts:5)

The left-edge anchor is essential. Dropping old ledger entries while retaining the current `stockAt` reconstruction would lose transfers that still affect present inventory. Long waits and services also need an interval/anchor representation, even when their initiating event has expired.

At 128 units and cadence 1/16, the regular sample budget is about 2,049 per ship, plus bounded event data. Also bound retries, episode metadata, debug telemetry, worker-message queues, and UI caches. A time window alone does not bound zero-time retries or accumulated error strings.

Send appended/replaced pages and an eviction watermark, with full refresh only for initialization or recovery. One outstanding worker request keeps backpressure simple. Test memory across worker and main thread, including obsolete workers after restart; a plateau in Runner node counts alone is insufficient.

Historical viewing must use plans and resource states known at that historical epoch. A latest-plan field reused while scrubbing backward would reveal a future decision as though it already existed. Retain bounded plan-validity intervals or omit projections when their provenance is unavailable.

For time controls, adopt the proposed semantics with a bounded, acknowledged pause:

- **Pause:** freeze the cursor immediately and stop issuing advances. Accept one outstanding result; its reply acknowledges the held frontier.
- **Scrub:** inspect retained history with the frontier held.
- **Play behind frontier:** replay history without advancing TrafficEngine; resume live advancement on reaching the frontier.
- **Live:** jump to the acknowledged frontier and resume.
- **Restart:** create a new run generation with seed stocks and counters.
- **Hidden tab:** stop advancement and reset the wall-clock reference on return.

This needs no interruptible Runner. However, the outstanding chunk must not evict the history being inspected. Pin the visible retention floor until its acknowledgement, or defer that eviction. Ignore results from old run generations; discard wall-clock debt instead of accumulating a catch-up queue.

Failure isolation should distinguish ship failures from failures of the shared engine.

A physical episode fault preserves its valid prefix, resources, known epoch, and reason. It ends that ship’s program. Render its last-known state as a historical fault marker; do not extend its trail or evaluate it as a current moving origin. Object-centered frames and future relative projections must report unavailable coverage when their reference ship lacks a valid state at the requested epoch.

A violated shared-stock invariant or worker crash should pause the run with a diagnostic. Treating those as one ship’s problem would falsely imply the remaining shared state is trustworthy.

CPU scheduling budgets should yield, not create ship faults. For failure coverage, test a narrow episode adapter with a deterministic fault boundary, backed by real Runner fixtures for depletion, rejected capture, and paid-prefix behavior. Production admission must continue rejecting those unsafe candidates. Existing propulsion tests already exercise several relevant physical failures. [propulsion.test.ts](/home/s/code/orbital-logistics/tests/sim/propulsion.test.ts:56)

The implementation gates should follow this dependency order:

1. One rebased episode with exact departure/capture boundaries, resource continuity, unchanged programs across step refinement, and independent numerical checks.
2. Two ships with simultaneous service/departure/arrival tests, resource competition, retry progress, and isolated faults.
3. Identical committed events and states across advance partitions, query patterns, playback speeds, and reversed view queries.
4. Eviction tests across active services, flight boundaries, faults, and historical plans; then a soak spanning many retention windows.
5. Browser pause/scrub/Play/Live/restart/set-switch checks, including delayed worker replies and unavailable frame origins.

No further human decision is required to begin that bounded implementation. Keep persistence, lunar continuation, generalized jobs/rescue machinery, and mutable Runner extension deferred. The first deliverable should establish the fleet transaction and episode seam; the rolling viewer can then consume a precise, bounded history contract.
