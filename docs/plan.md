# Tactical plan — updated 2026-10-08

Status: **model-set viewer accepted; coherent 3D engine and lunar freight implemented**.

On 2026-10-08 the user chose fictional orbital buildups and traffic as the next
product direction, authorized retiring the CoaDE editing UI, and requested implementation.
The main app offers Orison orbital freight, the lunar DRO, and Selene lunar freight.
See [current direction and architecture](model-set.md) and [viewer evidence](evidence/model-set.md).
The user-authorized overnight work completed Astra architecture review, a canonical
six-state migration with planar compatibility and independent spatial calibration,
stable label anchors/fades, and bounded lunar freight authoring. Three validated
round trips now serve a ballistic lunar depot; burns, captures and refueling are paid.
See [spatial evidence](evidence/spatial-foundation.md) and
[lunar freight evidence](evidence/lunar-freight.md). The viewer retains its 2D projection.
Synchronized analytical views are deferred for taste feedback. Multi-system content,
ground launch/landing, upkeep/production and new propulsion remain follow-up work.

The [recovered Fable consultation](design/orbital-model-set/README.md) and
[synthesis](design/orbital-model-set/synthesis.md) informed this direction. Watching
and exploring are sufficient; no required courier/puzzle optimization gate remains.
Shared stocks and berths are validated for prepared independent runs, not a general
joint fleet scheduler. Runtime intent remains deferred.

## Historical editor and puzzle milestones

M1/M2/M3a were accepted; initial M4a fixed-program puzzles were implemented.
The following records their original scope and gates, which no longer prescribe the
next product step.
On 2026-10-06 the user accepted the manual editor and initial rendezvous helper,
requested encounter markers, selected-node hover and overlap selection, then
explicitly authorized continuing with M3 tasks. Those M2 follow-ups are implemented
and validated; see [encounter evidence](evidence/m2-encounters.md),
[initial M2 evidence](evidence/m2.md), [M1](evidence/m1.md) and [M0](evidence/m0.md).
M3a now implements one-tug reusable delivery, finite service inventories, return
constraints and a validated authored round trip; see [M3a evidence](evidence/m3.md).
M3b's joint handoff and the M3 synchronization/product gate remain open.
On 2026-10-06 the user accepted M2 refinements/M3a and explicitly chose to move
into M4 puzzles using absolute maneuvers before dynamic instructions. Initial M4a
adds Return ticket / Express return, player-selected fixed-time port targeting,
separate saved time/fuel/hardware scores, replay/export and cleaner execution
layers. [M4a evidence](evidence/m4.md) retains two validated time/fuel alternatives.
M3b is deferred by this sequencing decision, not completed. Human voluntary
optimization, hardware variation and a beneficial gravity assist remain open M4 gates.
The remainder records the reviewed plan and intended sequence.
Source: /home/s/org/projects/orbital-logistics/charter.md.

## Core-loop reconsideration — 2026-10-07

The user subsequently questioned whether the periodic proposal offers the same
kind of construction depth as Zachtronics or transport games, requested OpenTTD
source research, and explicitly authorized a free-form Astra game-design
consultant with its own experiments/subagents. The [new synthesis](design/topology-study/proposal.md),
[OpenTTD source notes](design/topology-study/source-notes.md) and
[independent consultation](design/topology-study/consultant/recommendation.md)
recommend a finite three-port courier probe **before** the recipe/timeline build.
This historical recommendation was superseded by the accepted model-set direction above. No app source was changed during that study.

An offline analytical scan found circuit versus serial-shuttle time/fuel choices
with one tug, and a faster two-tug alternative. All ships return; both impulses
are paid and cargo mass is accounted for. Six directed legs passed independent
DOP853 checks. The experiment changes fuel/cargo allowances and is not a run in
the app, global optimality or gameplay evidence. The proposed hands-on gate starts
with one tug and asks whether the player voluntarily reorganizes routes. Keep
intent/resolution/event seams and timeline diagnostics, but do not equate adding
repetition with proving a new game. Runtime scheduling and joint ships remain
deferred. Existing milestone acceptance is unchanged.

## Prior periodic programming study — 2026-10-07

The user reviewed M4a as largely working, identified departure/docking bookkeeping,
and requested detailed periodic-service design and an Astra review before further
implementation. [Reviewed proposal](design/periodic-transfer/proposal.md),
[Astra review](design/periodic-transfer/astra-review.md) and
[disposition](design/periodic-transfer/review-disposition.md) record the prior
proposed slice; the reconsideration above is the current recommendation.
This is planning/evidence work; no reusable recipe or timeline is
implemented yet, and the full M4 product gate remains open.

Prior recommended sequence (retained for context, deferred by the new proposed gate)
superseded the tentative dynamic-terminal-match-first idea:

1. One recipe, two actual voyages, horizontal ship timeline and fuel/cargo/Δv traces.
   Commit departures/durations, derive service/waiting, and compile each complete
   dock-to-dock transfer from its own simulated prefix. Retain immutable accepted
   execution and inspectable paid v1 events; defer runtime scheduler insertion.
2. Compare economical impulse, a validated generous-impulse domain and bounded
   finite thrust on the same objective, before second-ship machinery. No permanent
   chemical-only or torch-only choice yet.
3. One shared berth/handoff with two ships, then bounded cadence/runtime work from
   concrete need. Three deliveries/gap constraints precede a sustained-cadence claim.

The retained two-voyage schedule completes 0.4 cargo at 51.334523 using identical
service quantities, carrying real finite inventories, consuming 0.259748 fuel.
The cheap geometry recurs every 15.853883 but the tug misses every other opportunity.
Current patient/express witnesses establish completion-time/fuel differences,
not different cadence. See the proposal for exact authoring semantics, primary
research, raw measurements, diagram, acceptance cases and propulsion uncertainties.

## Recommendation

Use TypeScript + Canvas 2D + DOM + Vite for the playable greybox. Use Python/SciPy
as an independent numerical oracle and optional offline fixture-authoring
tool. Preserve the ability to replace propagation behind a small pure-data
interface if measured failures demand it; do not build two production simulators,
a native port, or a WASM bridge now.

One developer, one application, one simulation module. This is a continuity and
scope recommendation, not a measured claim that TS is universally fastest.
Python desktop could remain native if that experience proved preferable; no port
is inevitable. PyKEP CR3BP/variational tools may help later targeting experiments,
but they do not supply the editor or application event contract. An orbital package might
supply a good propagator but does not supply this game's authoring semantics,
canonical event scheduler, moving-frame interaction, or understandable puzzles.
The first uncertainty is whether the tutorial-derived manual edit is understandable
and expressive.

## Confirmed human direction

User clarified on 2026-10-06: mirror **Children of a Dead Earth's astrogation
tutorial** as the first step, because subtle selection/editing/visualization UX
matters even in 2D. Use visual-first presentation with precise numbers on demand.
The charter direction is solid; higher-level synchronization is the later departure
from CoaDE tactical maneuvers. The game is installed locally via Steam.

Therefore the first deliverable is a small interaction reference study followed
by a 2D tutorial-derived editor, not a moon flyby challenge selected in advance.
Inspect installed tutorial text and UI resources read-only; do not copy assets or
tutorial prose into the project. Record observed source details separately from
actual played interaction. Keep a short list of behavior that still needs seeing
in-game (drag gain, focus, snapping and transitions). No title, distribution
license, campaign or deployment decision is required yet.

The moon pass remains a numerical/visualization regression fixture, not the
prescribed opening lesson. The two-body calibration scene supports the initial
maneuver tutorial. A simple maneuver goal can make edits purposeful without
introducing docking, cargo, a solver, or a new lesson design prematurely.

[Installed tutorial reference](evidence/coade-reference.md): Level1Tutorial28–37
establish selection → begin trajectory → hover previews the future → click pins
epoch → adjust handle → manage burn list. Crucially, tutorial item 36 says holding
the mouse is unnecessary. Implement an explicit interaction state machine:
inspect / hover-preview / epoch-pinned / handle-edit; settle click-to-engage,
commit and cancel semantics after observing the actual UI. Do not assume a
pointer-down drag is equivalent. Support precision numbers without replacing
spatial editing. Keep camera focus, selected object, view frame, burn-reference
body and live/preview epoch as separate state.

Full tutorial mirroring spans milestones: the manual prefix is M1, matching and
phasing are M2, and the game's refueling/return segment informs M3. The first
slice is explicitly an adaptation of the manual prefix, not a claim to reproduce
the entire tutorial.

## KSP/mod reference supplement

[Primary-source KSP study](evidence/ksp-reference.md) supplements the CoaDE
interaction contract. Borrow fine/coarse signed increments, precise maneuver-time
adjustment, next/previous node selection, and discoverable apsis snaps from the
PreciseNode/Precise Maneuver/MechJeb references. Put precision controls in the
selected-node inspector; they should support spatial manipulation rather than
replace it. Simultaneous vessel/target encounter ghosts are useful feedback.

KSP/these mods were not run, and documented console controls are not desktop
mouse behavior. No current compatibility or UX quality is assumed. KSP's patched
conics do not validate our integrated multi-source paths. Transfer-window plots
remain later level/phase tools, separate from editing one maneuver epoch.

## Build order and stopping points

| Slice | Concrete output | Evidence / stop |
| --- | --- | --- |
| Planning spike (this session) | Locked local toolchain; numerical comparison; read-only encounter viewer; reviewed plan | Record what ran, discrepancies, and remaining limits; no M1 completion claim |
| Reference study | Installed CoaDE astrogation sequence and interaction contract, with unknowns labeled | Map each tutorial action to a 2D adaptation and acceptance observation; avoid inventing a clone from memory |
| M0a — pure propagation | Versioned fixture/program; analytic ephemerides; RK4; impulse/fuel handling; surface termination | Circular/eccentric/hyperbolic analytic checks and step halving; moving-body oracle comparison; reject unsupported close approaches |
| M0b — canonical runner | advance/seek/snapshot; stable event order; bounded retained samples | Different update partitions, warp factors, save/reload yield identical committed steps and events; rejected burn leaves state unchanged |
| M0c — executable scene | One ship/central body, pause/advance/reset, serialization | Run headlessly and in browser using same runner; no renderer-owned dynamics |
| M1a — tutorial and inspection | Two-body tutorial-derived scene; selection, frames, synchronized scrub and minimal readouts; moon pass remains diagnostic fixture | Match the source interaction contract where observed; future-body transforms at sample time; explain what a selected maneuver changes |
| M1b — edit one maneuver | Click path; radial/transverse handle interaction + numbers; baseline vs draft; incremental/total delta-v; undo/delete | Player moves a visible orbit goal toward/away deliberately, undoes it; prediction is converged and execution/draft/stale state is clear |
| M1c — queue/replay | Multiple explicit-epoch burns, one apsis snap, execute, save/load and replay | Retain before/after JSON, recording, latency distribution, prediction/execution comparison and ledger tests |
| Human M1 gate | Short hands-on session: change pass altitude or timing, inspect in two frames, execute | User explains effect and deliberately revises it. If opaque, revise fixture/controls; do not use optimizer to hide failure |

M0a and M0b are small modules with checks, not a generic simulation framework.
Make each slice runnable before accumulating abstractions. M1 can first show one
maneuver while the serialized program already supports an ordered list.

**Early M1b check:** before full queue polish, give the tutorial-derived orbit edit
a visible purpose (for example widen the orbit into a marked target-radius band).
Let the player move it toward the goal, undo, and deliberately change it the other
way without supplying exact burn values. This tests local intention and feedback,
not ability to explain multi-body dynamics. Then unlock placement/epoch editing
and retain the full M1 gate. The same target-band pattern can later apply to the
retained moon pass: center distance [0.09,0.10] in time window [2.4,2.6], equivalent
surface altitude [0.065,0.075]. These are distinct quantities, not interchangeable
labels. That moon exercise is feasible numerically but is not the opening lesson.
Do not build a tutorial campaign now.

## Numerical and temporal contract

Provisional choices, to be finalized using measured fixtures:

- Internal normalized units: separation=1, total gravitational parameter=1,
  planet–moon angular speed=1 for a self-consistent barycentric circular fixture.
  Keep unit metadata in scenario JSON; decorative radii are separate from surfaces.
- Fixed RK4 is the initial candidate for short bounded encounters. Do not infer
  long-horizon or arbitrary-close-pass suitability from one benchmark. Compare
  h, h/2, h/4 and an independent DOP853 result; record raw state and encounter errors.
- A canonical grid is anchored at scenario epoch; scheduled impulses split grid
  intervals deterministically. Render/playback requests do not become authoritative
  endpoints. A state queried between committed nodes is interpolation or a
  disposable propagation from a checkpoint, never the next integration origin.
  Grid/event boundaries are resumable; a final partial horizon endpoint is not.
  Horizon extension must discard that temporary endpoint and resume from the
  preceding canonical grid/event checkpoint. Preserve a true burn at the endpoint.
  Snapshots include grid index/origin and executed event cursor, not just epoch/state.
  Test partitioned execution, horizon extension and checkpoint/reload explicitly.
  Fixed stepping is an initial choice; adaptive internal steps can obey the same
  display-independent contract.
- An event root is refined from the same bracket/algorithm regardless of sampling
  or warp. Simultaneous operations get an explicit stable order. Persist the event
  cursor/armed state in snapshots. Seek restores a checkpoint and replays forward.
- RK4 internal stages can approach a surface even if endpoints do not. Use a
  conservative near-body step policy and collision brackets/termination; a
  timestep-converged flyby alone does not prove absence of collision tunneling.
  Validate the domain reachable by the handles, not only a good baseline and seed.
  A conservative unsupported-close-approach stop is acceptable for M1; continuing
  through a surface or unresolved singular region is not. Report collision and
  unsupported approach distinctly. A larger edit in the spike penetrates the
  moon's surface; the spike has no termination and must not be promoted unchanged.
- Store each burn as epoch, referenceBodyId, radial/transverse components and
  basis version. At execution compute radial unit vector from pre-burn position
  relative to that body; transverse is the positive 90-degree rotation (CCW).
  It is not velocity-aligned on an eccentric orbit. Camera changes never rewrite it.
  This is our explicit initial convention, not a verified claim about CoaDE/KSP's
  axes. Their terminology must not silently define the model. The first tutorial
  can use a prograde circular orbit where the distinction is absent; inspect
  eccentric/clockwise behavior before claiming control fidelity.
- Apsis snap initially resolves a named body's selected bracketed occurrence in
  the current draft to an explicit epoch. It is an editor operation, not a runtime
  re-triggering policy. Flag upstream changes that invalidate the selected event;
  never silently follow a different apsis. Durable encounter selection uses the
  named body, event kind and a semantic time window, not the old numerical root
  bracket or mutable ordinal. Regenerate root brackets per revision; zero or
  multiple qualified events mean missing/ambiguous. Save snap provenance and
  flag when an upstream edit moves the selected apsis away from its saved epoch;
  offer explicit re-snap rather than quietly moving the burn. Detect roots only
  on continuous coast segments: a burn discontinuity is not an apsis. Near-circular orbits have no
  unique snap; show unavailable/nonunique rather than choosing a noise sign flip.
  Runtime event anchors come later.
- A burn consumes propellant using pre-burn total mass and exhaust velocity.
  Fail atomically if unaffordable. An execution failure ends/blocks the forecast;
  no successful-looking continuation after a rejected required action.
  For M1 reject duplicate burn epochs; surface termination takes precedence over
  a coincident burn. Add richer simultaneous-operation semantics when M3 needs them.

Proposed numerical acceptance for M1: trajectory disagreement at h/2 vs h/4 and
oracle must be below 1% of the fixture's explicitly chosen encounter-distance
resolution, and below 0.25 screen pixels at its intended close-up scale. Both are
needed; camera zoom alone cannot define physical accuracy. M2 additionally ties
position and velocity error to <1% of proposed capture tolerances. These are
proposals to tune, not current measurement claims. Also bound refined event-time
and relative-velocity error and require stable event/collision classification
under step refinement. Tiny propagation error does not excuse a coarse encounter
readout: sampled minima already have measurably different epochs from refined
roots. The independent tests still apply when preview and execution agree exactly.

## Minimal module seams

- `sim`: scenario/program validation, ephemeris, acceleration, step, event and mass
  transitions, canonical runner, snapshot. No DOM or worker imports.
- `planning`: evaluate a versioned program to a bounded horizon; encounter/event
  diagnostics. Same runner as execution. M2 later adds constrained shooting.
- `view`: sample-time transforms, Canvas rendering/hit testing, camera and axes.
- `editor`: immutable accepted program, draft transaction, undo/redo, selection,
  committed execution epoch vs preview epoch. Plain DOM first; no app framework
  needed until complexity actually warrants one.

Start with structured-cloneable objects and arrays. No ECS, plugin system,
monorepo, server, or schema compiler. Validate untrusted JSON at load (finite
numbers, IDs, masses, ordered event times, schema/model version). Save scenario
and program with their exact versions plus model/tolerance policy. Snapshots are
an acceleration detail; the saved authored program is the durable artifact.

## Prediction interaction contract

Immediate burn handle feedback is a view update; prediction runs separately.
A worker owns a fresh runner for each prediction, not the live execution state.
Every job has scenarioId/modelVersion/programRevision/horizon. Results include
status, completed horizon, event diagnostics and trajectory samples. Accept only
the newest matching revision; label last complete path stale while updating.

Prototype a bounded full prediction first. If it blocks interaction, use the
worker already smoke-tested, chunk work so obsolete jobs stop, and use a coarse
preview explicitly marked approximate during drag; recompute validated preview
on release. Do not claim an approximate path can safely execute. Worker message
versioning alone discards outputs but does not cancel CPU work; yielding or worker
replacement must actually allow cancellation. Add shared-prefix caching only if
profiling shows it helps; checkpoint time must precede the earliest affected burn.

Initial target: handle feedback next animation frame; short-horizon fresh preview
p95 around 100ms on the actual host, measured pointer input to fresh paint, not
just integrator loop time. Measure cold and warm runs, worker transfer and frame
transform/path drawing. Narrow horizon before changing technology.

## Beyond M1

**M2:** a local rendezvous shooting experiment, not a global orbit planner. Begin
with one departure impulse (two components) at fixed departure epoch and fixed
arrival epoch; minimize arrival position residual, then calculate and charge an
arrival velocity-matching burn. Use damped finite-difference Newton/least-squares
with bounds and line search; this is a candidate to test, not a solver guarantee.
Begin in a short collision-free two-body fixture, not arbitrary moon-assist
encounter topology. The selected target/time window and a concrete allowed angular
direction, revolution count and minimum clearance constrain the solve; each
finite-difference trial and accepted update must obey those bounds.
Reject branch-switching, collisions, insufficient fuel, nonconvergence, stale/cancelled
jobs. Show a correction proposal and accept/reject; never mutate plan on failure.
If branch identity cannot be defined reliably, narrow the fixture and solver range.
Compare manually better/worse seeds and correction cost. The user identified manual crossing corrections as a distinct need: geometric
orbit matching and simultaneous interception are now explicit paid actions.

**M3a:** one tug, two explicitly kinematic ports, finite cargo/propellant, docked
load/unload duration, delivery quota, and required reusable return state. Include
arrival-burn cost; distinguish successful proximity from valid capture. Retain a
complete round trip and readable failed capture/terminal-state diagnostics.

**M3b:** second ship and a single named transfer dependency. This is the first
joint prediction gate; transfers and inventory mutation are atomic, port occupancy
is explicit, and downstream predictions stop or become conditional when blocked.
No general language, autonomous dispatch, station construction, or manufacturing.

**M4:** small puzzle sequence + two meaningfully different valid solutions for at
least one puzzle, separate time/fuel/hardware axes and replay viewing/export. A
mathematical assist must produce a demonstrated benefit under the actual model;
a curved path is insufficient. Human voluntary optimization is the product gate.

**M5/M6:** only after product evidence, choose sustained service or one station/
processing/finite-thrust extension. Keep each a separate experiment. Exact cosmic
repetition, full N-body planets, 3D and engine ports are not prerequisites.

## Reusable route intent

The user clarified that matching an orbit before phasing is useful, and cyclic
routes will require dynamically calculated corrections. Preserve authored intent
separately from resolved burns; prediction and execution must use the same pure,
bounded resolver from the actual preceding state. M2 assistance provenance and
M3a absolute-epoch operations remain static. See [route intent](route-intent.md)
for the architectural direction, open transfer-to-orbit semantics and required
evidence. Do not build a general route language in the current M3a slice.

## Work allocation

One implementation owner for simulation and schema while they change. Parallel
work is useful for independent reference checks, bounded view work after data
interfaces settle, and read-only reviews. The retained spike code is an experiment;
promote only after reviewing its limitations, not by copying every helper into src.

## Planning-session measured evidence

- Local npm install, production build, installed-Chrome Canvas/module-worker
  smoke and retained-viewer frame/scrub checks passed.
- TS RK4 at h=1/512 on the constructed horizon-6 binary encounter agreed with
  tightened independent DOP853 positions to <2.4e-9 normalized units on 601 samples.
- The same one-branch propagation measured ~12 ms median in Node; a separate
  installed-headless-Chrome run measured 8.7 ms median (9 warm measured runs).
  Neither includes editing/painting/worker transfer and neither validates long horizons.
- A small impulse changed closest moon center distance from 0.12 to ~0.09287.
  This is a fixture/provenance result, not a player solution or beneficial-assist claim.
- Request-dependent step partitioning, near-circular apsis degeneracy, and surface
  tunneling are demonstrated hazards. Immutable stored-node query checks do not
  substitute for the future mutable playback/replay tests.

See `docs/evidence/` for commands, raw measurements and narrower evidence boundaries.

## Senior review synthesis

Astra (`gpt-6-astra`, xhigh, verified CLI metadata) independently reproduced the
retained samples/oracle and challenged the interaction objective, reachable edit
domain, event accuracy, checkpoint semantics and first solver fixture. Main-agent
spot checks reproduced the partial-endpoint continuation discrepancy (~1.05e-5)
and a 5x seed burn entering the moon surface. The user clarified tutorial-first
after reviewer launch; its prepared-moon opening recommendation is therefore
adapted to a tutorial-derived two-body goal. See
[evidence/review-disposition.md](evidence/review-disposition.md) for every disposition.
