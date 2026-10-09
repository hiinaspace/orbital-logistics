# Continuous maintained relay — 2026-10-08

The user accepted the finite stationkeeping witness and requested continuous online
maintenance/targeting, with quieter station graphics. **Orison · maintained service**
is a separate versioned runtime beside analytical/surface traffic. It uses the same
canonical Runner and powered-port admission, with no drawing samples as targets.

[Verified brief](brief.md), [Astra review](astra-review.md), [disposition](disposition.md)
and [transport log](review.log) preserve the decision. Actual reviewer transport was
gpt-6-astra/xhigh, CLI0.153.4, session `01a11e5c-cf89-77d0-b23b-02798fa26852`, exit0.
The reviewer inspected the architecture/base, not this implementation. No claimed
external implementation review. Main implementation: gpt-6.1-sol.

## Physical ownership and dispatch

One owner appends immutable eight-unit station/origin/baseline chunks at absolute
8k control epochs, 40 units ahead. Anchors carry exact terminal state and remaining
maintenance fuel; used fuel is cumulative separately. Control arcs end by offset4,
so joins are quiet and on the common h=1/256 grid. Failed bounded maintenance solves
commit a physically checked coast and diagnostic. Phase comes from the unforced
endpoint, allowing phase drift while correcting circular geometry.

The visitor targets the actual perturbed station. Both fourteen-unit flight legs
and a two-unit quiet relay dwell are admitted before departure. Return shooting
starts from the paid outbound capture/release prefix. A full pair Runner verifies
both captures/reserve and reconstructed providers at every canonical grid point and
station event boundary, tolerance1e-10 state/1e-12 fuel. Leases carry full body/policy/
state/fuel/control definitions and ordered absolute chunk IDs; forecasts are never
revised within a run. No correction overlaps attachment and no arc crosses a lease join.

Departure candidates are6+8k, with one bounded zero-revolution prograde Lambert seed
per leg. [Poliastro's primary documentation](https://docs.poliastro.space/en/stable/autoapi/poliastro/core/iod/index.html)
provides the universal-variable equations. The seed only initializes finite-force
shooting; no Lambert impulse executes. Initial Hohmann-style seeds failed the paired
return experiment. The retained preliminary six-candidate probe found one feasible seed pair without
expanding branches/seeds/budgets. That preliminary probe did not include paid capture;
the retained first-pair admission and final evidence do include it. This is a fixed
narrow family, not global routing.

The coplanar fixture has one ballistic origin, one maintained relay, one visitor and
a prescribed perturber. The relay keeps fixed ballast and its own finite .6 tank.
Cargo .05 stays aboard the visitor; relay cargo/refuel exchange is zero. Origin fuel
has a finite4 buffer and explicit .015/time clipped external import. Refueling occurs
atomically after the two-unit home dwell; the station tank never resets. This tests
continuous targeting and paid visits, not a demand-driven freight exchange model.

## Budgets and time

Station shooting has64 candidate evaluations/check; each flight leg has96. Counts
include finite differences, line searches and production refinement. Each candidate
is a logistics-free Runner. Separate from these192 flight candidates, outbound-prefix
and complete-pair admission each use three physical propagators, plus bounded checks
at8193 common-grid points/provider. Station admission separately checks the eight-unit
controlled/coasting result and origin/baseline propagation. A generator yields
between trials/propagations; worker requests consume24 work steps and at most one
requested simulation unit. A trial remains synchronous; wall-time latency is measured,
not guaranteed. Initialization yields through preparation without sending false readiness.

Historical canonical chunks are evicted at the actual head; the current/future owner
has a50k aggregate-node limit. One active pair/private providers remain. Reported
`runnerNodes` conservatively estimates the private providers from parent grid size
plus64 event nodes; it is not heap instrumentation. Display retains128 actual units
and up to40 known future units: ≤23 chunks, ≤6 visits, ≤65,536 dense visit samples.
One held reply allows24 chunks/7 visits/2200 frames. Both serialized replies and a
conservative sum of cached UTF-8 display components are limited to8MB. JS heap/RSS
and temporary solver garbage are not represented by serialized-byte bounds.

At a held cursor, only plans/chunks known by that epoch appear. Pause acknowledges
one pending reply without moving the cursor; Play traverses history, Live returns to
the head, Restart rebuilds the selected set. Display histories and resource anchors
are retained; none restart physics. One separate held pose preserves a non-grid
paused cursor across its pending acknowledgement; historical interpolation includes
committed right brackets and exact event-left states. Camera, warp and query partition cannot change
control epochs or admitted burns. The calendar guard is10000; the retained soak is512.

## Failure semantics

Failed planning waits for a later fixed candidate and exposes the reason. Maintenance
envelope loss blocks new dispatch; valid admitted flights finish. Free-flight failure
retains the paid executed prefix and last physical state while maintenance continues.
Attached failure stops the shared run before unsupported station thrust, preserving
attachment; it never silently detaches or suppresses leased corrections. Physical
lookahead failure raises a worker error and pauses at the last acknowledged safe head;
it does not commit a future collision as a current actual event. Restart is explicit.

Station whiskers are sparse, shorter, translucent teal; station correction spans are
shallow teal against a thin coast line. Ship maneuvers retain their larger gold marks.
No new persistent caveat captions/footer were added.

## Evidence and artifact lifetime

[Implementation evidence](../../evidence/maintained-service.md) covers deterministic
partition/rewind, paid repeated visits, faults, storage and independent early/late
DOP853 replay. `npm run evidence:maintained-service` reproduces the512-unit runtime,
frozen station control stream and first/last admitted pair convergence report.

The brief/review/disposition, bounded transfer probe and first-pair snapshot are durable
authoring evidence. Redundant preliminary controller/runtime probes were removed after
the final script superseded them. Review log formatting is preserved except trailing
whitespace/EOF normalization, if needed. Unrelated reports/ and research_notes/ are untouched.
