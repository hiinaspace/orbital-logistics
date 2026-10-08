# Continuous traffic senior-review brief — 2026-10-08

User accepted finite propulsion/schematic viewer and analog speed. Authorized next:
continuous traffic, Astra review of architecture/storage and scrub/playback/rewind.
Planning failures may wait for next window; flight faults isolate a ship, others
continue, even if eventually idle. Future stationkeeping/demand-triggered jobs and
cargo/fuel rescue are desirable extensions, not this slice. Validate analytical
stations first. Also requested future thrust-vector whiskers and distinction from
flown trails. Solo hobby prototype, bounded implementation, not enterprise storage.

## Verified environment

| Fact | Evidence |
| --- | --- |
| Clean branch codex/model-set-viewer, HEADfa9b9358bdc109b74a8bea4abd3cd066305257bd | git status/rev |
| natto, /home/s/code/orbital-logistics; TS pure sim, Canvas2D, worker; no remote | checkout/package.json/src |
| Canonical schema/modelv3, State6, fixed inertial finite arcs, anchored exact mass/cap/depletion, grid/events independent of queries | src/sim/schema.ts, propulsion.ts, runner.ts |
| Runner owns bounded finite program/nodes. Snapshots verified by replay from bundle; no append/prune/live runner API | runner.ts |
| Kinematic fixed-primary circular ports or bounded ballistic targets; capture charges residual and constrains attached motion | logistics.ts, runner.ts |
| Current worker prepares whole finite SetRun then terminates | src/model-set/prepare.worker.ts; main.ts loadSet |
| Viewer SetRun has per-vessel Bundle, disposable samples/event-left boundaries/ledger, static world; independent overlays with aggregate stock/berth admission | model.ts |
| View-only interpolation; all transforms use each vertex's epoch; object/rotating frames pure | model.ts, frames.ts |
| Finite Replay rewinds inventories; current seek pauses, Play advances cursor, Rewind seeks start | main.ts |
| Five accepted finite sets;95 sim +9 browser tests, independent spatial/lunar/powered numerics; powered residual plus1e-8 allowance<1e-7 | docs/evidence/bounded-propulsion.md and prior reports |
| Orison has one fixed mu1 primary at origin, circular coplanar prograde ports, engine force1/ve3/dry1/tank1; four berths per station | orison-powered.json |
| Kestrel has two validated powered legs Anchor→Kiln→Anchor, flight3.024522336946932 each. Outbound t0.8, cargo0.16/fuel0.65; return t12.185307878766574, cargo0/fuel0.6423113829300793 | canonical event-left extraction via Runner |
| Anchor rate0.8108737462959251/phase0; Kiln rate1.3975424859373684/phase4.72854450350631 | saved fixture |
| Resource accounting is discrete finite transfers plus continuous burns; no external station supply, fleet runtime, persistent store or runtime guidance yet | sim/logistics.ts, model.ts |
| Reviewer CLI codex0.153.4; actual model/effort verified from log before report read | prior review transport; current CLI |

## Mostly-worked proposal and open forks (opinions)

1. **Execution unit and authority.** Keep finite canonical Runner as an immutable
   powered-flight episode, rather than immediately adding append/prune to it. A pure
   TrafficEngine owns absolute frontier, shared station stocks, per-ship attached/
   service/wait/flight/fault state, schedules/counters. At departure create a new
   local-epoch0 Bundle from actual attached rail state and serviced fuel/cargo.
   Rebase circular phases to absolute departure and rotate validated thrust headings.
   Same dynamics/safety/capture, with final dock operation. Carry terminal fuel/cargo
   back to fleet; do not reset mass invisibly. Drop Runner after episode completion
   once retained drawing history extracted. This lifetime decision overlaps storage.
   Rejected: infinite mutable Scenario horizon/event array and unbounded Runner nodes;
   whole-world recurrence/reset mislabeled sustained simulation. Is the episode seam
   sound and small enough, including capture/event ordering and numerical ownership?

2. **First planner/domain.** Two ships cycling two analytical circular ports. Reuse
   independently witnessed Kestrel two-arc legs via fixed-primary rotational/time
   symmetry; not a new numerical optimizer. Each direction requires its exact dry/
   cargo/fuel/engine regime, and next departure phase window computed analytically
   from retained reference departure + integer synodic periods. At service completion
   restore the template's starting fuel/cargo by explicit finite stock transactions,
   then plan next window. Each candidate is a new inspectable Bundle, terminal/
   capture/clearance validation before admission; reject mismatch, retry next window.
   Local epochs/rebased phases avoid huge event timestamps inside RK4. Need bounds/
   numerical guards for large session time and repeated window calculation. No lunar
   ballistic continuation, arbitrary mass steering, runtime shooting or hidden route
   search. Longer-term dispatcher interface should accept jobs to support demand or
   rescue later, without implementing them now.

3. **Shared resources/service.** Authoritative fleet station stocks, finite buffers,
   atomic service completion in stable epoch/ship order. First set has berth capacity
   at least fleet size at both ports, explicitly admitted domain; no speculative
   reservation system needed to guarantee occupancy. Two ships start opposite ends.
   For ongoing traffic: explicit station external cargo supply/consumption and fuel
   supply rates with capacity limits and cumulative external import/export accounting.
   Anchor exports0.16 loads, Kiln consumes delivered supplies; propellant supplied at
   both. Rates/buffers are config, shown in optional About/inspection; not simulated
   stationkeeping/manufacturing. Between resource events evaluate clamped linear
   flows from an immutable epoch anchor, not cumulatively per view request. Service
   debits actual stocks, applies ship deltas once after duration0.3. Insufficient
   stocks/capacity: no partial transfer, wait/retry on next window. Alternatives:
   inexhaustible invisible resets rejected; finite-only stocks eventually idle is
   permitted but less useful as the main screensaver. Is simple explicit flow scope
   appropriate, or use external source/sink service boundaries instead?

4. **History/storage.** Bounded in-memory rolling history, e.g.128 time units at
   fixed disposable drawing cadence1/16 plus exact events/left boundaries; current
   finite flight Runners and one admitted future plan per ship. Retain only current
   scheduler state + rolling drawing/resource/event records + bounded future plans.
   Completed physics nodes can be discarded. Keep seed/config/version/provenance
   durable in repo. No IndexedDB, save/load UI or trusting user-edited checkpoints
   now. Page/deque/segment record choice open; lean flat bounded pages/segments rather
   than one mutable giant SetRun. View DTO must not forge a valid Bundle by changing
   epoch/duration to match a display window. Existing frames/interpolation reusable
   behind a distinct live view window and resource source. Need numerical state vs
   rendering history distinction, retention limits and long-soak tests. Persistence
   can later save authoritative fleet state plus current episode inputs/cursors and
   rebuild those finite Runners; arbitrary import/restart validation remains separate.

5. **Time and UI.** Separate authoritative frontier from viewing cursor. Initial Live
   plays automatically. Pause stops advancing physics; scrub pauses and inspects
   retained past without rewriting events/rescheduling. Play while behind frontier
   replays retained history then follows Live; Live button jumps to frontier/resumes.
   No eviction while watching past because frontier stays held there. Restart run
   resets seed/stocks/counters explicitly; finite Replay hidden in live mode. Reload
   starts fresh. Slider range is retained past..frontier; future admitted plans visible
   as projections on timeline/path, not scrubbed as committed history. Show frontier
   and cursor distinctly when inspecting past. A worker owns TrafficEngine; bounded
   advance requests/backpressure, stale revisions ignored on set switch/restart.
   Pause may allow one in-flight bounded chunk to finish, but view cursor stays fixed;
   choose whether this is acceptable or an ACK-based stronger pause is simpler.
   Hidden tabs don't accumulate wall-clock debt. Display speed never controls event
   times or canonical grids. Need recommendation on minimal unambiguous controls.

6. **Failures and independent progress.** Planning failure leaves docked state/cargo/
   fuel intact, records cause and next retry; other ships unaffected. Flight failures
   preserve charged valid prefix, mark a ship fault and stop its program, no free
   capture/rescue. For this slice, don't invent physical motion beyond failed model
   validity; render a distinct last-known fault marker/state at its known epoch,
   inspector explains suspension while fleet time continues. User explicitly permits
   eventually nothing happening. Since immutable fully validated flight predicts its
   own execution, real flight faults should be rare here; still need real branch
   coverage (trusted test-injected candidate/fault boundary or policy-budget failure)
   without admitting unsafe production plans. Review failure/state design and test
   seams. Future rescue/demand policies must be able to consume faults but are deferred.

7. **Burn visualization.** Future selected burns: sampled fixed inertial thrust
   vectors/whiskers along future trajectory, transformed as vectors at each sample's
   epoch (cancel rotating-frame omega term), warm dashed route/whiskers, spatial
   sampling density/caps to avoid clutter. Past: ordinary ship-color fading trail,
   no same-strength highlighted burn overlay/whiskers. Keep plan/trail layers separate.
   No changes to physical heading from view frame. This is independent UI work; don't
   spend architecture review budget on aesthetics unless it affects view DTO/time.

8. **Evidence gates.** Retained finite regressions. Pure fleet determinism under
   chunk/query/view/cursor partition, epoch boundaries/service/fuel continuity and
   resource conservation including external flows; window repetition + whole-flight
   pre-snap residuals; planar rotation/local-time equivalence versus original bundle;
   independent DOP853 on multiple later voyages, no retarget at different h; real
   retry and isolated in-flight fault branches; long soak beyond history window,
   bounded samples/events/nodes/heap and cleanup; production Chrome pause/scrub/Live/
   historical Play/restart/set switch/frames/whiskers. Prefer a small two-port witness
   to extending the lunar network or making a scheduler framework.

## Review request

Read-only, no delegation. Verify key claims from source before critique, label
verified/unverified/unknown evidence. Re-rank by leverage; merge overlapping
choices. Deep-spec your highest-leverage decision with concrete small interfaces,
event ordering and tests. Identify actual human decisions separately (none assumed).
Focus architecture/storage/time/failure semantics and minimal scope; do not redesign
physics already independently calibrated or re-review the game direction. Roughly
1500–2500 words is enough. Recommend a bounded implementable disposition; no demand
for a general optimizer, persistent service, dynamic economy or 3D camera.
