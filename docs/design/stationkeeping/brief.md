# Stationkeeping + tracking cameras: review brief — 2026-10-08

## Goal and authorization

Solo hobby orbital model-set viewer, not a puzzle or detailed spacecraft builder.
The user likes watching finite/continuous traffic, inertial/rotating/ship frames,
3D and bounded physical thrust. They accepted smooth steering/inclined delivery,
asked for camera follow at unchanged view angle, a chase view, orbit about selection,
and to proceed with stationkeeping. They explicitly requested Astra review of the
high-level stationkeeping approach because it changes a lot. Review before physical
implementation. Camera work can proceed independently. Do not expand into a general
strategy economy, Lambert optimizer, attitude simulator or real mission ephemerides.

## Verified environment / contracts

| Fact | Evidence |
|---|---|
| natto, /home/s/code/orbital-logistics, branch codex/model-set-viewer, base8b3f6be | git/hostname checked this turn |
| TypeScript/Canvas2D orthographic3D, Vite, worker-prepared finite sets | src/main.ts, src/model-set/model.ts, camera.ts |
| Six-state canonical RK4, prescribed massive bodies, exact event boundaries | src/sim/runner.ts, dynamics.ts |
| Finite thrust, immutable anchored mass/cap/depletion, C1 spherical steering | src/sim/propulsion.ts, steering.ts |
| Old fixed programs3, steering programs4; scenario/snapshot3 | src/sim/schema.ts; older readers reject steering semantics |
| Finite displays/frames interpolate only; never physical targets/restart states | src/model-set/model.ts, frames.ts |
| Current port types circular/surface/ballistic | schema.ts: Port, Logistics; logistics.ts |
| Ballistic target is a separate private burn-free Runner, full-horizon safety admission, same physical fields | runner.ts constructor/portState; inflated-radius clearance |
| Capture pays residual velocity, requires bounded miss/speed; docked ship position/velocity follows canonical target | runner.ts apply operation/coast/sample |
| Continuous engine owns fleet/inventories, short local flight Runners; rotates fixed templates and commits at frontier | src/traffic/{engine,planner,view}.ts |
| Rolling128 history,65,536 dense samples; held-head/scrub semantics | docs/design/surface-service/README.md |
| Existing fixed surface and continuous witnesses must retain their dynamics | AGENTS.md, accepted user slices |
| Last slice134 sim/23 Chrome + independent seven-step DOP853 | docs/evidence/smooth-steering.md (past results; revalidate changes) |
| Unrelated untracked reports/ and research_notes/ appeared this turn | git status; do not edit/delete/include them |

Physics is not full self-consistent N-body; bodies are prescribed, stations/ships are
test particles with propulsion mass. Current circular ports have constrained rails,
so their maintenance fuel cannot just be charged arbitrarily and claimed physical.
Ballistic ports integrate gravity but cannot maneuver. Docked ships inherit station
motion without paying their own burn; once a station burns that implies the station
engine carries their mass. Cargo/fuel stocks also complicate station mass if transferred.
These are the main ownership issues, not the camera.

## Current lean: bounded physical maintained-depot exhibit first

A finite scene is the initial vertical slice: a station under a small real perturbing
body, deviations from a nominal inclined orbit, finite paid correction burns, plus
one ship arriving at the actual maintained trajectory. Show the station's own fuel,
maintenance activity and error/correction provenance. The set should visibly differ
from a no-maintenance baseline in a rotating frame and retain actual transfer burns.
No resetting to a nominal orbit and no positions scripted to a perfect rail.

1. **Target ownership.** Extend existing trajectory-backed canonical port providers
   with an explicitly powered type: initial six-state, station dry/fuel/engine,
   finite frozen burn/steering program, policy, full validity interval/clearance.
   Construct a logistics-free private Runner (no recursive target references), admit
   the entire interval, and use its physical state for capture/dwell/undock. Keep
   station propulsion fuel distinct from exchangeable port inventory. Explicit new
   logistics domain makes older readers reject rather than ignore maintenance.
   Do not duplicate the target as an independently executed visible ship.
   Alternative: unified world Runner/fleet integrator with targets and ships as peers.
   Strong long-term option but changes continuous dispatch, save/history, stock
   ownership and coupled mass simultaneously. Lean defer until needed, not prebuild.

2. **Attached mass / resource semantics.** Initial bounded domain reserves engine
   correction windows while the depot has no docked ships. Reject dock/dwell intervals
   overlapping station thrust (half-open endpoints precisely specified), including
   capture during a burn. This keeps physical mass honest without making each ship's
   private Runner guess fleet occupancy. Cargo/propellant exchange buffers are
   separate external storage mass model as with current ports; maintenance tank is
   not silently refilled from them. Alternative: make station mass include all bay
   ships/stock at every event and replan when occupancy changes—appropriate for a
   continuous follow-up, but a materially larger world ownership migration.
   Is this constraint a useful honest first slice or too artificial to establish
   stationkeeping? If adopted, keep it in optional set details, not repeated UI caveats.

3. **Controller and dynamic calculation.** Author finite maintenance using a pure
   bounded policy at fixed check epochs: compare actual station state to a nominal
   reference, skip inside deadband, resolve a capped finite correction from actual
   prefix, append immutable paid program and repropagate. Numerical shooting may
   use the existing RK dynamics, explicit iteration/evaluation limits, and reject
   infeasible/surface/fuel cases. Freeze the accepted output with policy settings,
   actual before/after error, solve counts and failures. This tests state-dependent
   corrections without secretly introducing runtime live replanning.
   Alternative: continuous low-thrust state feedback evaluated at RK stages; elegant
   but new dynamical law/closed-loop mass semantics and future forecast identity.
   Alternative: manually scheduled burns/charge synthetic fuel; easy but weak witness
   for the user's stationkeeping/dynamic planning interests. Prefer actual feedback
   checks compiled for a bounded exhibit, then a shared world controller later.

4. **Transfer planning.** A ship's finite arrival must be solved against the station's
   frozen canonical physical target at arrival, with event-left miss/speed checked
   before docking, independent DOP853, fuel paid and same program replayed. The
   existing inclined finite transfer can seed it, but must not claim a general solver
   if a bounded offline shooting witness suffices. Demonstrate mismatch against the
   nominal/unmaintained target so the actual provider matters. Arrival/service windows
   stay outside maintenance arcs. Do not force all current traffic templates into a
   nonperiodic target domain merely to turn this finite scene into a continuous set.

5. **Failure semantics.** A missing correction is not a teleport/automatic orbital
   decay. Propagate paid actual prefix; bounded authoring can fail the candidate and
   preserve report. Runtime powered-target admission rejects unsafe/depleted/invalid
   providers before any traffic/inventory effect. Scene must not render a perfect
   nominal marker after physical failure. A continuous maintained-target fault needs
   a shared world policy and last-known handling for attached ships; defer explicitly
   if we choose the finite scope. Need real negative tests, not only sunny path.

6. **Storage/API scale.** Reuse child Runner with no logistics; no nested bundle
   recursion. ≤8ports,≤128arcs,≤64keys/arc,65536canonical nodes each existing domain;
   avoid samples copied once per ship if possible. One finite target +one visiting
   ship for this scene. Dense target ephemeris/event-left/right samples only for
   disposable display; export/save retains exact initial condition and paid program.
   New physical target semantic must be rejected by old readers. Future refuel/
   occupancy-driven replanning should not mutate an already committed provider.

These decisions may be one ownership decision wearing several hats; merge/reframe
freely. The purpose is useful stationkeeping validation without an accidental whole
world rewrite, but do not endorse the lean if its artificial windows fail that goal.

## Independent camera slice (review only if a load-bearing conflict)

Camera follow is presentation tracking of selected object's current transformed
position while retaining view angle and zoom; per-vertex physical frame transforms
remain unchanged, so inertial paths keep inertial shape instead of collapsing into
a ship-centered trail. Chase aligns a camera rig with velocity relative to a chosen
primary, plus a stable orbital-plane up; robust fallback at zero speed/radial motion.
Deterministic pose from cursor epoch rather than wall-clock smoothing makes rewind/
scrub stable. Dragging orbits around selected physical position, keeping its existing
screen position; pan/zoom can offset a tracked target. Off/Follow/Chase, separate from
Frame. Pause/scrub/replay/set switch/fault selection must be explicit and tested.
Orthographic only: chase means behind-and-above schematic view, not a perspective
cockpit/collision boom. Human feel remains a later review gate.

## Requested review and budget

Verify source before critique. Label claims verified/unverified/unknown. Rank the
real architectural risks, then deepen the highest leverage decision. Give a bounded
implementation recommendation, target/fuel/attached-mass/forecast semantics, exact
failure/validity and versioning implications, acceptance witnesses. Identify genuine
human taste/scope choices vs engineering decisions we can make. Around1200–1800words
is enough. Do not re-review all accepted physics, research mission realism, run long
optimizers, modify files, launch agents/reviewers or paid processes. Read-only shell
inspection/short experiments allowed. No new product research is needed for this pass.
