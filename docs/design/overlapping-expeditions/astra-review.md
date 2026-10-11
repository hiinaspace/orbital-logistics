# Overlapping expeditions: architecture review

Reviewed 2026-10-10 against continuous Apollo query/engine/view, finite Apollo ownership, analytical traffic admission, canonical Runner and maintained-world chunking. Architecture approval with evidence gates, not completed implementation evidence.

## Decision

Add a narrowly versioned fleet exhibit while preserving accepted single-Odyssey behavior. Own one compiled Apollo mission, two named expedition actors, one passive local orbital craft, one calendar and one resource ledger.

For local activity choose an initially orbiting craft with no docking, service, transfer or propulsion. Do not import TrafficEngine: traffic/planner.ts explicitly admits only one fixed gravitating body. Its analytical recurrence does not cover this unchanged moving-Moon field. A separately authored recurring shuttle needs another closure/symmetry certificate and paid operations.

## Expedition transformation

For actor phase delay δ, use offset δ+kT and constant spatial rotation β+kωPadT, where β=ωMoonδ. Keep global body rails unchanged. Rotate inertial velocity directly without rotating-frame correction. The alternate planetary pad has phase originalPhase+(ωMoon−ωPad)δ. Thus δ=T/2 gives an antipodal pad and the same synchronous lunar destination.

Derive occurrences independently from indexed epochs. Before δ, support the second craft at its actual alternate pad with seeded full fuel, zero consumption and no previous flight/refill. Never pass negative elapsed time to the current occurrence helper. First departure is δ+source.launch.

Remap source home-port identity in samples, operations and inspection; retain the shared lunar identity. Qualify event/control IDs by actor and cycle. Resolve recovery, thrust, entry, steering and vectors through the same schedule. Never retarget the shared physical cache.

Subtracting δ can lose exact event epochs. Compare global indexed event times first and assign their exact canonical local times before sampling. Cover launch/capture, arc boundaries, entry/recovery, transport and refills. Use one indexed formula for event rows, boundaries and exact after-samples.

## Berths and accounting

Analytically admit lunar attachment intervals including neighboring cycles and wraparound. The current half-open [landing,liftoff) interval lasts 2 units; proposed separation T/2≈51.692658 provides ample slack. Preserve event-left/right occupancy and reject changed schedules that overlap. Each planetary pad owns one berth, including initial support and hidden support after transport completion.

Each actor owns its tank, initial fuel, cumulative consumption and refill counter. Shared anchors sum imports while retaining importing port and recipient. Require aggregate and per-actor conservation. Zero net ground stock needs explicit import/debit facts. Future recurrence is known; resource mutations become actual only at the common head.

Merge operations chronologically and preflight each bounded atomic batch. Existing 4096-unit jumps can contain about 79 combined refills, exceeding the old 64-operation cap. Reduce jump size or reject by aggregate pre-count before changing any owner. Clip final partial occurrences to the common calendar.

## Local propagation

Use short immutable absolute-epoch Runner chunks, patterned after MaintainedWorld's origin stream without controller, baseline or targeting. Carry exact terminal canonical six-state into each successor. Fixed chunk boundaries align with the integration grid independently of requests, queries and warp.

Include both original gravitational sources at every stage. Seed a planetary orbit comfortably above air. Enlarge only the integration exclusion radius to atmospheric top plus admitted clearance, as finite Apollo vacuum legs do; preserve gravity and rendered radius. This certifies vacuum validity. Retain Moon clearance and existing safety guards.

Never reset or rotate-repeat an approximate circle. Propagate actual perturbations. The craft owns constant mass/fuel, no berth and no replenishment. Eight-unit chunks, initially proposed h=1/512 and 32 Hz drawing, are reasonable starting choices pending convergence and close-view checks.

Prepare chunks privately before publishing fleet progress. Expedition facts cannot outrun required local admission. Isolated local failure is acceptable using established last-known semantics: preserve knownEpoch and actual prefix, reject later physical/frame queries, stop its future trail, retain its marker after history eviction, and let independent expeditions continue. Unexpected invariants still stop at the last complete published head.

## Playback and queries

Retain 32-unit committed lead, 128-unit history, one outstanding request and held-head Pause/Play/Live. Yield bounded work between chunks. Measure sustained 16× before preserving its performance claim.

Keep physical world providers shared once. Dispatch queries by stable identity and epoch. main.ts currently enumerates terminal-braking at unshifted k*T; use the same actor occurrence enumerator as paths and metadata.

Handle transport presence, trail breaks, hit testing, frame availability and camera presentation separately per actor. The waiting second craft remains visible/selectable. Physical frames use actual state; camera blending is presentation. Historical inspection cannot borrow another occurrence's recovery summary.

Composing two existing view stores is acceptable only with one shared template and explicit pre-delay support. Local-time history must never create negative cycles. Retaining only the latest local physical chunk restricts canonical queries to that coverage; older UI queries use retained disposable rows.

## Storage and work

A single seed ExpeditionEngine may supply the sole compiled cache; fleet resources remain authoritative. Never construct a second physical preparation. Send one template and compact actor descriptors.

Derive aggregate strip bounds from both shifted schedules, history, lead, forecast and held/pending retention. Existing single-actor 120k samples/36 MB and 110k assembled limits need aggregate replacement. Proposed 240k/72 MB strip ceilings are provisional, not measured sufficiency.

Composing stores and then transforming complete outputs can create extra dense copies. Count both source strips and transformed rows, or memoize transformations and clip assembly. Count shared template ownership correctly through structured cloning. Serialized bytes are not a heap measurement.

Local ownership comprises its continuation anchor and bounded active chunks, plus disposable history/brackets. Count all physical nodes/bytes together with Apollo, pending chunks, held rows, assembled arrays and initialization copies. Enforce limits before publication. Expose compilation count, local chunk/node/work counts, retained samples/bytes, resource/event counts and packet peaks. Eviction/restart release owners.

## Evidence gates

1. Independent delayed-actor absolute-epoch replay through ascent, paid capture, liftoff and recovery, preserving original force/load/error margins.
2. Waiting/first departure, shifted exact seams, periodic berth collision rejection and conservation; coarse/fine advancement yields identical facts.
3. Local independent integration, step convergence, chunk/uninterrupted parity, long-run clearance/drift, bounded ownership and injected isolated faults without partial publication. Short orbital survival does not certify a million-unit calendar.
4. Production browser overlapping activity, both entry/transport/refill sequences, fuel-chart jumps, delayed prelaunch support, selection/tracking, historical queries, pending-reply Pause/Play/Live, restart/switching and sustained 16× with aggregate memory plateaus.

Libration stations, orbital docking and staging add physical/resource dependencies and remain later slices.

## Implementation direction follow-up

The owner proposes extending the schedule with optional actor identity, epoch/rotation offsets and source-pad mapping, then materializing each actor's global cycle directly. This avoids composed transformed dense copies and preserves original schedules without an instance. Both stores share the source template; aggregate guards remain required.

If local physics extends to frontier+32, retain canonical chunks covering frontier through that forecast end, or clip local coverage to the committed frontier. Keeping only the last eight-unit chunk would otherwise discard canonical current-state coverage. Never reconstruct physical current from decimated rows.

## Source review and worker materialization follow-up

Reviewed the initial fleet/query/view/orbiter implementation. Shared compilation, delayed supported prelude, port remapping, periodic lunar berth admission, atomic refill facts, full-field local propagation and retained canonical frontier-to-forecast coverage follow the contract. The current local integration step is 1/256; numerical evidence must certify that actual policy.

The measured roughly 679 ms cycle materialization on the main thread is an experience blocker. Building immutable cycle rows in the existing simulation worker before publication is approved. Send the shared template once and only newly materialized actor/cycle rows thereafter. Keep main-thread assembly disposable; frontend missing-row access must reject rather than silently rebuild a cycle. Associate injected rows with the admitted actor, cycle and template, and retain exact boundary sides and indexed epochs unchanged.

Use a fleet common-end override so worker and frontend enumerate identical required rows. Held history must retain its old-cycle rows through the one pending reply. Sent-row bookkeeping must be monotonic or bounded by retained cycles, not a lifetime Set.

The proposed 32 MB initial/12 MB warm packet ceilings require enforcing the half-period actor phase: the current schema admits other nonoverlapping phases, and an eight-unit advance can then cross two cycle introductions. Either restrict this narrow fixture to phase 1/2 or allow and account for two warm rows. Reject over-budget packets before publication.

Worker and frontend may each own up to 72 MB of materialized rows; report that combined ownership, plus shared template copies, physical cache, pending structured clone, serialized packet and temporary assembly. Per-store limits alone are insufficient. Frontend ingest should avoid reserializing every row solely to remeasure worker-provided counts; validate structure/count bounds and use the established trusted-worker byte contract.

After implementation, browser evidence must measure main-thread ingest/clone handling and the moment new cycles arrive, including sustained 16× across several introductions, Pause during an introduction and set switching/restart. Moving construction off-thread addresses its location, not structured-clone pauses or aggregate memory peaks. The optimization remains conditional on these checks; this review does not claim completed playback validation.

## Final source follow-up: worker rows and seam probe

The updated source explicitly admits half-period spacing, requires prepared rows in the frontend, checks actor/template identity on injection, prunes exported indices with cycle eviction, and uses one common forecast end. Worker cycle construction now precedes packet publication; main and worker retain separately guarded caches. Orbiter canonical chunks cover the published frontier through the forecast. Main requestTraffic allows one outstanding request and advances at most one unit; a paused pending reply therefore has bounded additional held retention. Error packets preserve the last frontend-published head and suppress subsequent requests through liveError.

A targeted direct canonical query probe found one remaining exact-seam defect: the schedule snaps mission boundaries and authored arcs, but not entry/braking or visibility thresholds. Odyssey cycle 1 at global braking epoch 186.5683039468865 subtracts to 83.18298746501374 instead of canonical 83.18298746501375, returning entryPhase='entry'. Argosy cycle 10 repeats this at 1168.7288105246776. Argosy cycle 1 at recovery+2 (240.63756675177575) yields opacity 1.4210854715202004e-14 rather than zero, bypassing the exact hidden-frame condition. The correction is exact global-indexed matching for entry activeFrom/entryEpoch/brakingEpoch and fade thresholds, then assignment of canonical local time, without epsilon snapping. The owner was sent these reproductions.

Actor-specific selection, trail breaks, terminal-braking IDs and hidden-frame camera handling otherwise follow the shared schedule. The selected camera may consume frameOrigin while physical frame transforms continue querying actual state. Physical faults preserve knownEpoch and reject later state/frame queries.

Source approval is conditional on correcting those exact thresholds and passing the running integration/browser checks. Worker/main serialized ownership caps remain distinct from browser heap; delivery should report both cache owners and measured cycle-arrival/clone timing, not only the reduced main construction time.

## Final seam disposition

The updated query adapter now matches exact global entry, braking, recovery, fade, transport and indexed refill epochs before assigning canonical local time. An independent review probe passed 50 assertions across both actors and cycles 0, 1, 10, 17 and 9000: exact braking reports 'braking', hide/reappearance-start opacity is zero, and exact refill preserves the distinct left/right tank values. This resolves the reported numerical seam findings without epsilon snapping.

No remaining source-level blocker was identified in the reviewed scope. Architecture/source approval is granted subject to completion of integration, numerical and production-browser checks. The owner reports initial browser coverage without errors but an 11.67x observed clock rate and 200 ms maximum frame gap while other heavy jobs ran. Retain that result and run the planned uncontended measurement; it does not establish sustained 16x performance. Delivery wording must follow the measured rate and gaps rather than the selected speed setting.
