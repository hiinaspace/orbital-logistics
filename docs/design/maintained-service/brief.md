# Continuous maintained relay — architecture brief, 2026-10-08

## Request and scope

User accepted finite maintained relay and Follow/Chase, requested smaller/more distinct
station whiskers/timeline corrections, and selected continuous running to test online
stationkeeping and navigating to maintained targets. Earlier session instructions
explicitly authorized Astra reviews for consequential architecture, including
stationkeeping. This is that ownership transition. Solo hobby prototype; no framework
rewrite, no new user authoring gate. Main actual model gpt-6.1-sol.

## Verified environment

| Fact | Evidence |
|---|---|
| natto, /home/s/code/orbital-logistics, codex/model-set-viewer, base32ca545 | hostname/git checked |
| DOM-free canonical six-state v3 Runner, fixed/steered finite force, anchored fuel, exact events | src/sim/{runner,propulsion,schema}.ts |
| powered-ports-v4 requires one powered and one ballistic target, full finite validity, separate maintenance tank, no relay exchange or attached burn | src/sim/schema.ts: powered validation; runner constructor provider admission |
| Each target independently reconstructed inside a visitor Runner; provider must finish horizon/reserve; query exact requested epoch | src/sim/runner.ts |
| Finite maintenance is offline DOP853 shooting; eight checks/64 eval, two pulses, phase-free geometry, six corrections/two skips | spikes/numerics/stationkeeping_search.py and frozen report |
| Existing TrafficEngine owns global stock/event batches and finite admitted flight episodes; only analytic fixed-primary planar routes accepted | src/traffic/{engine,planner}.ts |
| Existing TrafficViewStore extrapolates attached ports with analytic portState, so cannot directly host powered providers | src/traffic/view.ts view() |
| Live worker protocol one pending request, <=1 unit,128 work batches; history128, sample1/16, forecast12; held-head pause/rewind | main.ts + traffic worker/view + continuous contract |
| Previous140 sim/26 browser plus independent maintained replay pass; user accepted scene | evidence/stationkeeping.md, latest user message |
| Unrelated untracked reports/ and research_notes/ | leave untouched |

[Verified by source] Powered station may not accelerate with unaccounted docked mass.
Origin ballistic stocks can remain bookkeeping because no propulsion law carries
origin stock mass in this prescribed gravity/test-particle model. Refuel still needs
explicit finite supply/conservation; no magically reset station or ship fuel.
[Unknown] Online shooting budget/performance, multi-window transfer feasibility and
long-run orbit envelope. Those are bounded experiments before publishing a set.

## Proposed implementation and forks

1. **Separate narrow runtime or generalize existing engine?** Lean separate maintained
runtime/store behind the existing worker/live controls, sharing Runner, display,
resource primitives and bounded solver. Existing engine is deeply analytic/local-time
and heavily witnessed. No broad provider interface/monolithic world rewrite now.
New versioned live domain rejects old worker readers. Alternative rewrite old engine
for arbitrary targets rejected until more than one wanted domain needs it.

2. **Canonical station/origin owner and immutable forecast leases.** One runtime owns
the actual station tank/state, ballistic origin state, baseline and station controller.
Fixed absolute eight-unit control epochs, h=1/256 canonical steps. At these scheduler
epochs, extend a chain of immutable eight-unit finite Runners to <=40 units ahead.
Each chunk starts from the preceding physical terminal state/fuel, not display or
nominal state. Trial/accepted commands use actual field and same Runner. Future
commands computed from committed prefix stay unchanged while any ship targets them.
Forecast construction is triggered by canonical scheduler epochs, never display
queries, wall time, warp or request size. Actual facts commit only at frontier.

Controls: inside deadband coast; otherwise bounded two-pulse six-component shooting
against circular geometry at the phase predicted by an unforced four-unit coast
(no absolute clock phase). Reuse current finite pulse family. Gate improvement,
reserve, envelope samples and physical clearance. Solve failure records diagnostic
and commits an explicit physically checked coast; objective loss differs from crash.
No infinite solve loops, seed expansion or hidden free capture. Each control check
<=64 propagations; <=five initial forecast checks, one appended per scheduler epoch.
Tentative candidate trial integration can use larger h but accepted frozen controls
must be refined/admitted with production h and independent witnesses.

Question: should maintainers prepare fixed lookahead chains, or only reserve specific
flight intervals? Lean fixed bounded chain + immutable leases because one visitor/no
exchange means future station state is unconditional once accepted. Lease identity is
full physical interval definition/revision, not a hash of drawing samples. Need exact
start/end validity and target equality verification at flight commit.

3. **Bounded pair admission to avoid docked deadlock.** One visitor initially at the
ballistic origin. Plan outbound + two-unit relay dwell + return together before
leaving. Candidate departure grid6+8n, outbound14,dwell2,return14 initially, so relay
capture occurs at control-window offset4 and release offset6 (maintenance pulses only
in first4 units). Each leg shoots two fixed-duration vector-force pulses against
actual station/origin forecasts, six terminal components, finite thrust/acceleration/
fuel. Initial seed from actual radial/tangential/Hohmann velocity differences; no
rotated prerecorded trajectory as physical plan. Limit each leg to~96 propagations;
coarse solve + production refinement, bounded damped Newton/trust line search.
Exact paid pre-capture residual +numerical allowance <1e-7. Final complete round-trip
Runner includes both physical providers and actual burns/operations; independently
verify provider samples against authoritative owners before departure. Departure
waits on failed pair planning and retries a strictly later fixed candidate.

Question: reserve both legs or permit independent relay departures? Lean paired
admission, keeping no-attached-burn invariant structural. If a return flight faults,
ship becomes last-known fault and station keeps running. Failure before relay arrival
cannot strand an attached ship; rejected capture remains free-flight fault. No cargo
exchange at relay. Refill only at origin from finite stock with explicit external
supply/atomic dwell completion; maintenance tank never resets. Broader cargo/fuel
handoff or maintenance carrying docked mass deferred.

4. **Actual/forecast/history ownership.** Worker canonical chunks/active episode are
physical. Main store only disposable chunk samples and admitted episode predictions,
plus exact event-left/right states. Retain64 (or128 if inexpensive) actual units and
<=40 planned ahead, evict old chunks/episodes and resource anchors. At cursor, show
only chunks and episode plans admitted by that epoch. A lookahead plan is not past
fact. Need immutable chunk ids/upserts, head watermark, bounded pending held reply.
Older cursor must not acquire newly solved future burns. Snapshot evidence should
include cumulative fuel/refuelling and controller outcomes, not physical restarts
from display. Memory-only restart; persistence/snapshot format migration deferred.

Bounds to declare before publishing: <=24 retained physical chunks across origin,
station/baseline? (this arithmetic needs review:64history+40future is13 chunks per
body, so39 total; set explicit aggregate nodes rather than undercount), <=4 retained
round trips, <=65536 dense display samples, <=8MB serialized reply/store packet,
<=1 pending request. Discard completed private episode provider Runners and canonical
chunks older than head anchor, retain display/metadata for past. At most~5 future
chunks per body; <=100k retained canonical nodes. Max tested calendar~1e4 initially,
not existing1e6 claim. One bounded optimization may pause worker replies; measure
worst latency and show existing preparing/waiting state, no false ship fault for yield.

5. **Witness and stop conditions.** Start coplanar weakly perturbed fictional system,
ballistic origin radius2, maintained relay3, Mote6. Finite force, mass, reserve,
no impulses. One visitor, no relay exchange; warm start geometric and actual state.
Experiment first5-10 candidates/<=256 simulated units; if no robust paid pair within
budget report and stop solver expansion. Successful set should demonstrate several
online corrections, skips, >=3 repeated visits beyond original64-unit horizon and
at least one rejected/retried plan witness. Soak512+ if affordable; show bounded storage,
canonical partition invariance, independent late-window DOP853, unchanged actual
fuel/events under rewind/frames/warp; depleted/fault/retry/revision negatives. Both
actual station and spacecraft paid fuel plus explicit origin supply conserved.

UI: small teal sparse exhaust whiskers and shallow muted station timeline correction
marks; ship maneuvers stay gold/tall. Station inspector/control failures and refuel
stocks use existing restrained optional details. No new explanatory footer/captions.

## Review instructions

Verify load-bearing claims against files before critique; label verified/unverified/
unknown. Prioritize architectural correctness and ownership, not general mission
optimization or visual taste. Rank forks by leverage; deeply specify the top one.
Spot-check canonical chunk continuity, target identity and docked mass/failure issues.
Propose tighter simpler bounds/semantics if needed. Distinguish required human choices
from decisions we can make. No edits, no agents/reviewers/paid processes, no broad
optimizer. You may run a bounded read-only probe/test. Target <=10-minute review.
