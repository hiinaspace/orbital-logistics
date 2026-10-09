# Orbital model sets

Accepted direction, 2026-10-08: watch fictional space buildups and traffic rather than
require the user to solve puzzles, author policies, or design individual maneuvers.
The CoaDE editor is retired from the prototype's main UI. Historical functionality
and acceptance evidence remain in Git and the earlier milestone documents.

## What matters

The scene centers on schematic ships and stations, their transfers and loadouts, and
ways to understand their motion. Reference frames, scrubbing, trails, and eventually
simultaneous analytical views matter more than rendering atmosphere, rings, or stars.
Watching a prepared service is sufficient; optional operational interaction may grow
from a wanted scene rather than a required puzzle loop.

The content ambition includes Earth/Moon, Earth/Mars, Jupiter and its moons, larger
solar-system networks, and fictional systems including binary stars. Future ships may
use sustained thrust, solar sails, or exotic propulsion. Stationkeeping, upkeep,
imports/exports and manufacturing could make the traffic more meaningful. These are
content/model directions, not implemented capabilities or current prototype tasks.

## First viewer slice

- Orison: one fixed primary, four circular orbital stations, four reusable freighters,
  seven complete deliveries across a finite 64-unit horizon. Explicit Hohmann windows,
  departure/capture burns, loading/unloading durations, and refueling are prepared
  offline. Station role labels are descriptive, not a manufacturing economy.
- Selene: the independently witnessed planar DRO in the existing circular binary
  fixture, through t=24. Rotating and inertial views show the same integrated ship.
- Selene lunar freight: three freighters carry 0.48 supplies from two planet-orbit
  depots to the DRO depot and return, through t=12. Finite ballistic station targets,
  paid departure/arrival/capture, unloading and finite-stock refueling. See
  [experiment and provenance](design/lunar-freight/README.md) and
  [validation](evidence/lunar-freight.md).
- Orison · powered transfer and Selene · powered freight: finite fixed-heading
  departure/braking arcs, continuously consumed fuel, thrust/acceleration inspection,
  powered timeline/path spans, finite service stocks and paid returns. The lunar set
  compares force2/4 at the same times; [bounded propulsion evidence](evidence/bounded-propulsion.md).
- Shared play/pause/analog-speed/scrub/replay, pan/zoom/fit, inertial/rotating/object-centered
  frames, selection and overlap chooser, ship activity lanes, selected fuel/freight
  traces, finite station stocks, event jumps, and reversible display layers.
- No puzzle objectives, scoring, maneuver handles, precision editor, or acceptance
  dialog in the viewer. The numerical fixture format still retains legacy goal
  metadata for compatibility; it does not impose a task on the viewer's user.

## Execution and presentation

Each vessel retains a versioned scenario/program JSON. A worker runs every complete
program through the canonical Runner and rejects truncated/failed runs.
The logistics schema admits two to eight ports: legacy circular rails around a fixed
primary, or finite burn-free ballistic targets in the prescribed multi-body field.
The viewer set contains ship identity/color/cargo label, station roles/berth counts,
and a chosen rotating frame. All vessels must have identical world/port data and
unique identities.

The finite prepared sets are overlays of independently executed test ships.
Before admission, the combined transfer ledger is checked against one finite stock
per port at every change epoch; berth occupancy is checked too. The authored services
have no ship-to-ship handoff, collision/mutual gravity, runtime dependency, or resource
competition that requires replanning. Shared stocks and berths are real constraints on
which prepared sets are admitted. They are not a general scheduler.

The worker returns dense disposable drawing samples plus exact event epochs and each
ledger. Physics checkpoints stay inside the Runner. Playback performs view-only
interpolation; cargo/service and refueling change at exact ledger epochs, while powered
fuel/cumulative usage interpolate continuously to event-left resources. Docked positions
are evaluated on analytical rails or disposable ballistic target drawing samples.
Physics uses the target's dedicated canonical Runner, including capture, constrained
dwell and undock; view interpolation is never a physical target. Free-coast display velocities use pre-burn
endpoints so an impulse is not smeared into the preceding interval. At extreme zoom,
linear display interpolation can become visible; it never becomes a propagation origin.

All objects and all path vertices transform at their own epoch. A rotating frame
uses both rotation of axes and the angular-velocity term for velocities. Changing the
view never edits a program. Model assumptions/provenance live in optional details.

Replay rewinds the finite scene, including its inventories. It is a playback option,
not sustained service, physical recurrence, or free resource replenishment.

## Continuous analytical service

Implemented after user-requested Astra review: **Orison · continuous service**.
Two ships alternate between two analytical orbital stations, using revalidated
rotated powered episodes at integer synodic windows. A fleet engine owns shared
stocks, atomic service, external imports/exports, completed fuel usage and failure
isolation. Its fixed-route dispatcher is a first seam for future demand/rescue policies.

Pause/scrub holds a retained128-unit history; Play catches up to the held head and
resumes, Live jumps to it, Restart creates new seeded resources. Known future plans
remain separate from committed flight facts. Incremental worker deltas and bounded
retention keep history independent of total runtime; display interpolation never
restarts physics. A faulty ship shows its last known marker while others continue.

See [reviewed ownership/playback/storage contract](design/continuous-traffic/README.md)
and [numerical, retention and UI evidence](evidence/continuous-traffic.md). Memory-only
sessions, a tested1m calendar limit and analytical stations bound this slice. Lunar
continuation, maintained stationkeeping, demand dispatch and persistence remain open.

## Next decisions after viewing

First assess the experience directly: readability, motion, frames, time controls, and
what kind of activity the user wants next. No required engagement diary or puzzle gate.
Then choose one content extension or simulation change from that feedback.

The new lunar set uses safety-certified finite burn-free station trajectories and
bounded offline transfer witnesses. Maintained or maneuvering stations need a new
explicit propulsion/event model; the current target type cannot imply free stationkeeping.
Ground stations also require a real launch/landing model through the surface boundary;
a circular orbital port must not be relabeled as a ground facility.

Preparation can progress from curated programs to a small transfer catalogue and then
automatic scheduling/optimization if desired. Automatic route selection is authorized
by the accepted direction; retain inspectable generated programs, costs, and provenance.
Dynamic flight commands and a periodic programming language are not prerequisites.

## A coherent 3D migration

Implemented 2026-10-08 after user-requested Astra review. The engine now uses a
canonical six-state contract with explicit legacy conversion. The later
orthographic camera adds 3D presentation while preserving Top/XY compatibility. See [spatial evidence](evidence/spatial-foundation.md). The
validated migration covers:

1. Versioned six-component state with an explicit v1 planar conversion; 3D source and
   port rails with plane/orientation; full-distance force and surface-clearance checks.
2. Burn semantics that define the orbital plane/normal, including degenerate radial
   motion and an explicit out-of-plane component. Never infer a burn axis from a camera.
3. Compatible docking, snapshot, event, targeting and fixture-authoring paths. A planar
   solver must either advertise its domain or gain the additional degrees of freedom.
4. Planar parity against retained v1 fixtures, an inclined analytic two-body check,
   independent 3D DOP853 comparisons, convergence, and frame invariance before showing
   a new 3D model as valid. Spatial rendering/camera complexity can follow separately.

A z=0 field alone would not validate these requirements. Conversely, viewing a supplied
3D trajectory through a 2D projection is a narrower option than validating its forward
propagation. Do not assume either requires replacing all existing numerical work.

## Bounded propulsion

Implemented after user-requested Astra architecture review. Canonical v3 converts
propulsion-free v1/v2 bundles explicitly. Fixed inertial headings, throttle, thrust
and optional acceleration caps use an anchored exact mass law at all RK stages.
Start/end/cap/depletion boundaries are independent of viewing; interrupted arcs retain
paid prefixes. Historical aiming tools reject powered programs. See
[contract and provenance](design/bounded-propulsion/README.md).
The user accepted stable labels and the original lunar set. The user also accepted powered choreography. Continuous operations and 3D presentation are now implemented
in later slices; finite Replay still rewinds stocks.


## Airless ascent extension — 2026-10-08

[Reviewed surface contract](design/surface-ascent/README.md) adds `surface-ports-v3`
without changing canonical physics/snapshot v3. Surface ports use analytical physical
spin and positive supported COM height. Exact initial attachment and an atomic
`launch` bound to its first finite arc preserve identity, mass and inherited rotation;
free-flight surface guards remain unchanged. Legacy snapshots retained before the
change replay exactly. Launch is a departure for shared berths.

The first finite set is Cairn → Lantern, with real loading, paid ascent/insertion,
paid capture residual, unloading and dwell. Offline authoring fixes depot phase once;
no runtime steering or target relocation occurs. Dense launch samples belong only to
presentation. Explicit close view, ship follow, orbit fit, slower rates and the scale
indicator expose launch versus orbital motion. Stages, reusable recovery and
general launch dispatch remain later work; future separation requires explicit
child mass/fuel ownership and conserved momentum, not duplicated scalar cargo.

## Airless finite return — 2026-10-08

**Selene · Surface round trip** preserves the original outbound program and fixed
port phases, then refuels from Lantern's finite stock, loads .05 return freight,
waits for the departure window, coasts and brakes through eight finite arcs.
An explicit `land` attaches Swift to Cairn's rotating supported COM. Old surface
`dock` remains exact initial-only attachment. Full 3D capture uses a local geometry
bound and paid rocket residual matching; forbidden simultaneous impulses/starts
reject before execution. No atmosphere, hull contact or attitude model is introduced.

Landing is one berth arrival; unloading completes after a finite dwell. Invalid
subsequent service does not roll back a successful landing. All free flight retains
existing interval guards. Dense disposable samples cover both complete flights at
close scale; exact event-left states prevent display interpolation from smearing
attachment backwards. **Surface view**, ship follow, Fit, frames and speed remain
explicit controls. No camera/rate change is automatic at touchdown.

See [review and authoring provenance](design/surface-landing/README.md) and
[implementation evidence](evidence/surface-landing.md). The user accepted landing.

## Continuous surface service — 2026-10-08

**Selene · continuous surface service** repeats Cairn ↔ Lantern with one Swift,
unchanged fixed flight witnesses and actual serviced loadouts. Fleet resources and
berths remain global; a private support prelude replays atomic launch in each finite
Runner. Arrival identity and original local epochs are explicit. Stocks are finite
with explicit clipped imports/exports; shortages wait for later windows.

Dense disposable episode coverage supports close scrubbing across128 units of
rolling history without raising the fleet drawing grid. Prediction reuse requires
identical execution; divergent execution has separate committed coverage. Past faults
retain last-known validity and paid usage. Pause/Play/Live retain the existing
held-head semantics; Restart preserves the selected set. Exhaust-side whiskers use
actual capped force with a bounded nonlinear length scale.

See [review/contract](design/surface-service/README.md) and
[evidence](evidence/continuous-surface.md). The user accepted continuous service.
Stationkeeping, staging and atmosphere need separate model/content gates.


## Orthographic 3D viewer — 2026-10-08

Implemented at the user's request before stationkeeping. The camera projects the
already transformed six-state world onto a screen plane. It has no authority over
physical frames, burns, propagation, sample epochs or continuous-service ownership.
Top preserves the original XY view; 3D, Front and Side plus orbit/pan/cursor zoom
expose inclined motion. A quiet XYZ triad describes camera orientation. Bodies are
opaque spheres; paths are clipped to their silhouettes/front hemispheres, and hidden
markers are neither labeled nor pickable through the globe. Visible projected
overlaps retain the chooser. Surface view returns explicitly to Top/close scale.

**Orison · crossing planes** is a small finite demonstration: Tern tilts 45° and Lark
changes from −30° to +25° around a different node axis, then both restore their original
planes at the opposite nodes. Impulses are paid by the unchanged Runner. Two reference
beacons remain on the original circular rails. This validates spatial maneuver
viewing rather than general 3D targeting or finite steering. Existing powered and
continuous sets also support the camera and projected exhaust whiskers.

See [camera contract](design/spatial-viewer.md) and [evidence](evidence/spatial-viewer.md).
Ground pads still spin in the authored XY plane; camera changes do not add physical
latitude, arbitrary spin axes, attitude or maintained stations. The user accepted the 3D controls and requested a see-through toggle plus smooth
steering. Layers now offers See-through bodies, with occlusion enabled by default.

## Smooth steering and inclined finite delivery — 2026-10-08

**Orison · inclined transfer** delivers .05 supplies from radius 2 to a 35° depot at
radius 3 using two finite steered burns. Force/acceleration limits, actual fuel and
pre-capture position/velocity matching are independently checked. Its physical
steering keyframes use C1 spherical easing and are evaluated at every RK stage and
cursor/whisker time. New steering programs use schema4; scenario/snapshot v3 and
historical fixed-heading programs retain their contracts. See
[command/authoring contract](design/smooth-steering/README.md) and
[evidence](evidence/smooth-steering.md).

See-through bodies is a session preference under Layers, initially off. Enabling it
keeps rear paths/markers visible and selectable while preserving the overlap chooser
and physical state. Existing launch/landing/continuous witnesses keep their original
headings; retargeting those flights, attitude/gimbal dynamics, state-feedback guidance
remain separate work. The user accepted smooth steering and the inclined set.


## Tracking and maintained relay — 2026-10-08

Track offers Follow at the current angle/zoom and deterministic velocity-relative
Chase, independently of the physical reference frame. Orbit gestures pivot about the
selected object while preserving its projected position. Fit releases tracking;
set changes reset it. See [camera contract](design/camera-tracking.md).

After the requested Astra review, **Orison · maintained relay** adds a station with
its own finite propulsion budget in a perturbed inclined orbit. Offline bounded
checks maintain orbital geometry while allowing phase drift. Six corrections and
two skips compile to a frozen program. The visitor solves against that actual
canonical trajectory, arrives, dwells and releases before maintenance. Station
fuel/error readouts, activity lane, whiskers and an unmaintained comparison expose
what the corrections buy.

The new `powered-ports-v4` domain admits one maintained relay and one ballistic
origin over a finite horizon. The relay has fixed ballast, its own tank and no cargo/
fuel exchange; visitor attachment cannot overlap a station burn. Admission checks
complete target safety/reserve, exact epoch validity and explicit aggregate work/
display limits. Display samples never drive capture. This is the finite ownership
witness before continuous maintained traffic, shared mass/refuelling or runtime
maintenance. See [review/contract](design/stationkeeping/README.md) and
[evidence](evidence/stationkeeping.md). The user accepted the finite witness and tracking cameras.


## Continuous maintained relay — 2026-10-08

The user selected continuous stationkeeping/actual-target navigation. After
[Astra architecture review](design/maintained-service/README.md), **Orison · maintained
service** appends immutable canonical target forecasts and admits paid visit/return
pairs online. Eight-unit controls and quiet relay dwell preserve separate tank/mass
ownership. One visitor carries its cargo throughout; the origin refuels from finite
stock with explicit supply, while relay exchange remains deferred.

Failed bounded plans retry later windows; free-flight faults isolate the visitor and
attached faults halt before unsupported maintenance. Canonical physics retains only
current/future owners;128-unit disposable history supports the existing Pause/Play/Live
semantics. Station whiskers and correction lanes are smaller, sparse teal marks.
[Evidence](evidence/maintained-service.md) records512-unit repeated service, independent
early/late replay, conservation, partition invariance and storage limits. Human
viewing of the new continuous set is next. Shared maintained-station exchange/mass,
general fleet routing and arbitrary online spatial transfers remain separate work.


## Flexible maintained service — 2026-10-09

The user accepted flexible transfer schedules and economical relay dwell rather
than requiring an industrial wall-clock timetable. **Orison · flexible service**
selects departure, flight duration, passive dwell and return jointly. Tern explicitly
delivers maintenance fuel; Meridian's engine carries the visitor's actual dry/cargo/
fuel mass while docked. Both legs and dependent station controls are admitted as one
immutable funded plan. Short idle forecasts leave later timing choices open.

See [Astra-reviewed ownership/scheduling contract](design/flexible-service/README.md)
and [numerical, sustained-run and browser evidence](evidence/flexible-service.md).
The previous maintained domain and analytical/surface sets retain their semantics.
This bounded economical family is not a general route optimizer. Pause/Play/Live,
retained history and frame/camera controls remain presentation; a failed prerequisite
stops its dependent station future before any ghost attachment or fuel transfer.
Viewing the new cadence is the next human gate. Multiple visitors, demand/rescue,
arbitrary online spatial targeting and phase-maintaining station policies remain
separate extensions.
