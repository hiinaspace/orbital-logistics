# Libration service: architecture and exhibit review

2026-10-10. Read-only production-source review of the accepted Crossings fleet, its canonical local orbiter, physics, ownership and published design contracts. Numerical probes in this directory are independent authoring evidence, not production admission or completed browser validation.

## Recommended exhibit

Keep Odyssey, Argosy and Wren, and add one named station beyond Selene plus one courier from a dedicated synchronous lunar pad, Haven. Show departure, paid capture, a short unloading visit and paid return. A stationary station in the planet–Moon frame, moving in inertial view while the courier approaches, already supplies a distinct and legible destination. The existing Crossings exhibit remains available. No puzzle, optimization metric, management requirement or automatic camera jump is needed.

Use a prepared canonical courier round trip and an analytically evaluated force-balanced station. This makes the user's precomputation suggestion concrete without introducing live stationkeeping. The station can have cargo stock and a declared use/export stream; do not give it a maintenance tank or imply fuel consumption when no station thrust exists. Haven owns an explicit funded refill/import operation. Keep station inspection focused on its location, visiting ship and useful supplies; put the idealized equilibrium and restricted-field explanation in optional model details.

A passively drifting Lyapunov loop is also numerically viable (below), but is a separate useful visual refinement, not a prerequisite for station visits. A finite canonical loop with tiny closure residual is not permission to silently reset it every period.

## Actual field and station certificate

The nested Crossings source uses mu(Aster)=1, mu(Selene)=0.03, separation R=5, angular rate n=0.09077444574328174 and phase=1.8689123863023496. The proposed 0.08 lunar parameter does not describe this accepted exhibit. Aster is fixed, while Selene follows prescribed circular rails. The canonical force has both direct gravities and no indirect acceleration term. Therefore textbook barycentric CR3BP coordinates must not be imported unchanged.

In axes rotating with Selene and centered on Aster, an equilibrium q obeys

    n² q - muA q/|q|³ - muS (q - R ex)/|q - R ex|³ = 0.

Collinear roots are approximately -4.963233131143351, 3.995359600545797 and 6.123129239772423. The last root is the outer lunar equilibrium recommended here. There are no off-axis triangular equilibria in this particular prescribed field: subtracting x/y balance equations leaves muS R/d³=0, impossible at finite distance. This observation describes the current fictional field, not physical Earth–Moon triangular points.

At x=6.123129239772423, use a circular physical port centered on Aster with exactly Selene's plane, rate and phase. Its analytical acceleration equals the full gravitational acceleration; all attached mass shares that passive restricted-field acceleration. The station's ballast, visitor dry mass, fuel and cargo still have distinct resource owners, but no combined propulsion law is required.

Independent equilibrium_probe.py measured scalar residual 3.47e-18 and maximum vector residual 7.08e-17 across 100,007 epochs through 1,000,000. Moon surface clearance is 0.923129239772423 and atmospheric clearance 4.923129239772423. Independent local-to-global angle arithmetic differs by up to 8.31e-11 position near calendar end. These are double-precision analytical checks, not long unstable free-flight integrations.

Admission should derive the root from the admitted field or validate the complete acceleration identity with a scaled threshold around 1e-12, plus geometry and same-plane/rate/phase requirements. A provider keyed to a different field must reject. Retain the existing general circular-port restrictions; certify this exceptional multi-body passive circle at the new exhibit boundary instead of making arbitrary circular rails valid in all multi-body fields. Verify short canonical and independent integrations against the analytical provider, including rotated late-epoch windows, and retain a practical numerical allowance around 1e-8 for that comparison. Covariance checks through the calendar can reasonably require 1e-9. These are proposed gates; tighten them to measured implementation results.

Describe this as a force-balanced collinear station in an ideal prescribed field. It is an unstable equilibrium: the analytical exact solution does not model disturbances or automatic recovery. Zero station fuel is credible for that model. Do not claim robust indefinite passive survival from a finite Runner replay.

## Courier recurrence and resources

A dedicated Haven pad avoids competition with Tranquility's alternating Apollo stays. Haven must be synchronous with Selene in the same global field. It is then fixed in rotating coordinates, as is the proposed station. Any chosen recurrence interval P admits the same physical round trip rotated by nP, provided the actual launch loadout, surface state and program are identical. The recurrence need not be commensurate with the Apollo ground/Moon period.

Compile one complete canonical paid route with finite departure/braking arcs, coast, capture, finite dwell, release, return braking and explicit lunar land. Query the analytical station during targeting and capture; disposable drawing samples never become a physical target. Surface support/land semantics, free-flight safety and paid residual capture remain unchanged. Require strict pre-snap position/velocity tolerances and force/fuel/clearance margins in the actual field.

A reused route is valid only with its admitted initial fuel/cargo/dry mass, vehicle, field, port trajectories and steering controls. Refills and loading restore that actual state before each departure. Changing supplies or running short must wait or fault, not fly the old trajectory with a different mass. Freeze the prepared inputs and retain their identity alongside the cache.

One berth at Haven and one at the station suffice for this assigned courier. Admit complete half-open attachment intervals and their neighboring recurrence copies, including wraparound and initial support. Keep resources global and exact: lunar imports/debits, ship tank changes, delivered cargo, station inventory and any consumption/export each have one owner. A station consumption/export rate is an explicit finite-stock process, not an invisible inventory reset. Seeded stocks and cumulative import/export/consumption should satisfy per-owner and aggregate conservation. Future schedule knowledge does not mutate actual stocks before the common frontier.

Use exact indexed global event epochs and restore canonical local boundary times before physical or display queries, as Crossings already does. Include capture, landing, all arc endpoints, cargo completion and refill boundaries. Preserve both event-left/right states. Do not epsilon-snap an approaching visitor into attachment.

## Runtime and bounded cache

Prefer a separate narrowly versioned wrapper around the accepted Crossings fleet and a small dedicated cached-courier provider, rather than adding targeting/controller state to ExpeditionEngine or repurposing the single-primary TrafficEngine. Share the sole Apollo compilation and existing fleet clock. The wrapper owns complete shared publication and the additional resources/events; child cached providers do not independently publish frontiers.

Preflight each bounded advance privately. Validate all due imports, stock transfers, capacity changes and attachment prerequisites before advancing the authoritative owner. A failure in dependent courier/station service must not leave half a cargo transfer or a future ghost visitor. Independent Odyssey/Argosy/Wren can continue after an isolated courier fault; unexpected publication invariants stop at the last fully published fleet head. Preserve last-known markers and physical/frame query validity after faults.

Retain 32-unit committed lead, 128 total history, held-head Pause/Play/Live, one outstanding worker request and worker-only cycle construction. Compile the courier once, prepare rotated drawing strips on the worker, send only newly required rows and evict sent-index bookkeeping with retained strips. Frontend queries must reject missing prepared rows rather than compiling a cycle on demand. Reuse the shared actual-target provider and exact control schedule for inspection/whiskers.

Set aggregate bounds including Apollo cache, local Wren chunks, courier canonical cache, station data, both worker/frontend strip owners, held rows, pending clone and temporary assembled view. Existing 115k-node/40MB physical and 72MB per-owner strip bounds cannot silently exclude the new provider. Choose the smallest measured safe replacement or reduce samples; retain short bounded warm transactions and prepublication packet checks. Station analytical samples are cheap; do not generate a new million-unit station table. Report compile count, warm work, retained nodes/samples/bytes and packet peaks. Serialized bytes are not whole-browser heap.

## Independent passive-loop candidate

lyapunov_probe.py solves the actual rotating equations by symmetry shooting: fix x at the inner equilibrium minus a chosen amplitude, set y=vx=0, and solve initial vy and half-period so y=vx=0 at the next opposite crossing. DOP853 uses rtol=2e-13, atol=2e-14, max_step=.04. The amplitude .15 branch gives a visibly useful planar loop:

- Rotating initial [x,y,vx,vy] = [3.8453596005457973,0,0,0.13923403373410395].
- Inertial six-state at t=0 = [-1.1294585842527698,3.67574669475026,0,-0.46675650326780205,-0.14342178151844687,0].
- Period = 31.13058037181826; single-period closure maximum 1.40e-12.
- x range [3.84536,4.22937], y range ±0.69009; minimum Moon surface clearance .57157.

This is a viable numerical authoring seed, not an accepted canonical periodic provider. Canonical h/half-h convergence, independent integration, endpoint state/derivative seams, cycle covariance and unstable-error treatment are still needed before recurring target queries. A periodic table is a declared approximation with a certified residual/error domain; it cannot advertise infinite exact free flight merely because the renderer loops. The outer exact equilibrium avoids that new provider contract for this implementation.

## Completion gates

1. Root/force identity and geometry admission; reject changed rate, phase, mass/field and invalid roots. Independent short and late-epoch canonical comparisons.
2. Full-field courier replay, h/half-h convergence and independent DOP853 comparison through paid captures and lunar return; retained force/fuel/clearance margins.
3. Exact recurrence seams, per-owner/aggregate conservation, neighboring-period berth checks, shortage/capacity and fault behavior, coarse/fine partition invariance.
4. Sustained long-calendar bounded cache and packet ownership; compare resource/event outcomes at multiple advancement partitions and near maximum calendar.
5. Production browser station/courier selection, approach/dwell/departure, lunar landing/refill, physical frames, tracks, historical scrub, pending-reply Pause/Play/Live, restart/switching and measured requested playback rates across cache introductions.

The analytical station plus prepared visitor is architecture-approved subject to these implementation gates. The numerical probes establish feasibility and modeling distinctions, not completed user-visible acceptance.

## Initial implementation source review

Reviewed src/libration/{prepare,query,engine,view}.ts, model-set sampling dispatch, worker/main integration and the Beacon fixture. The implementation uses the approved dedicated domain: logistics-free canonical legs plus explicit paid captures and a separately certified analytical target, so legacy Runner port validation is preserved. The exact loadout is restored by funded Haven refill; parcels are consumed/exported at the station as an explicit operation rather than accumulating/resetting a depot inventory. Changing outbound versus return cargo mass is reflected in their canonical ship mass. Both captures retain paid fuel and strict positional/velocity residual margins. The private resource preflight occurs before the base fleet advances.

Worker cycle materialization, separate frontend retention, aggregate physical/strip/packet counters and the inherited one-pending-request held-view path are present. The nested fleet retains its own bounds as well. The supported phase, force identity and full-field flight certificates are checked at construction; speculative halo or free stationkeeping controls were not introduced.

One blocking calendar-boundary issue was reported: delta() computes last=floor(end/period), then materializes a complete row through (last+1)*period using sample(), which rejects epochs above maxEpoch. With period32, frontier999968 and forecast end1000000 request cycle31250, covering [1000000,1000032], and fail before the calendar can complete. For arbitrary admitted periods, the final partial cycle also extends beyond the calendar. Worker cycle enumeration/materialization, frontend expected endpoint validation and frontend enumeration need a coordinated terminal-boundary contract. The final physical endpoint can be supplied by the preceding row when maxEpoch is an exact recurrence boundary; an admitted partial final row must be clipped. Source approval remains conditional on that fix and completed numerical/browser gates.

The retained source_probe.ts independently compiled the courier and passed 80 assertions at exact launch, station capture, unloading, departure, landing and refill epochs across cycles 0, 1, 17 and 31000. Canonical and display state, attachment, cargo and tank values agree exactly at those boundaries, including the distinct refill left/right cargo states. Measured canonical ownership is 46,817 nodes / 16,981,084 bytes. Station capture position error is 1.921e-12, lunar capture position error 1.674e-12 and lunar residual velocity 3.955e-12; both residual velocity matches debit fuel. These checks cover the courier provider and display adapter, not completed fleet browser performance.

## Final source disposition

The calendar blocker is resolved for the admitted domain. prepareCourier now requires period exactly32; the one-million-unit calendar is therefore an exact recurrence boundary. Both engine and view use courierLastCycle, which caps the terminal strip at index31249, ending at epoch1000000. No truncated strip or generalized partial-period semantics is needed for this schema. The endpoint query may use occurrence31250/local0, while its left side uses occurrence31249/local32; both represent the supported, already refilled Haven state.

The independent terminal_probe.ts passed 70 assertions and queried 42,725 prepared samples across retained windows at frontiers999967,999968,999969,999999 and1000000. Every required strip stays within the calendar and satisfies frontend full-row endpoint validation. Final drawing queries succeed. Final left/right tank6, cargo.15 and cumulative fuel usage agree; position/velocity seam difference is 5.15e-11, below the proposed late-calendar covariance allowance. Queries beyond the calendar reject explicitly. This was a bounded terminal-provider/view-range check, not an expensive million-unit live fleet rollout.

Resource ingestion merges previously held anchors with incoming rows, and release preserves the last anchor at or before the new oldest epoch before dropping older history. With the existing one-pending-request bound, a held reply retains the old cursor's resource context rather than replacing it with the worker's newer window. The source retains separate old/new row ownership checks and aggregate limits.

No remaining source-level blocker was identified in this reviewed scope. Architecture/source approval is granted for the exact outer-equilibrium Beacon plus cached Haven courier. Final delivery remains conditional on the implementation owner's numerical, conservation/partition, retained-history and production-browser checks, including actual playback performance. These review probes do not establish browser heap peaks, smooth playback or user acceptance.
