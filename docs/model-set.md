# Orbital model sets

Accepted direction, 2026-10-08: watch fictional space buildups and traffic rather than
require the user to solve puzzles, author policies, or design individual maneuvers.
The CoaDE editor is retired from the prototype's main UI. Historical functionality
and acceptance evidence remain in Git and the earlier milestone documents.

The current framing is an **orrery with spaceships** or an operating model train set:
selective compression of distance, time and operations preserves visible journeys.

## Current workspace

October14 public-entry scaffold: `/` is a separate, readable landing page with
an optional small prepared cycler preview; `/viewer/` owns the full workspace.
The landing imports no viewer, simulation workers or heavy exhibit assets. See
[entry/loading evidence](design/landing/README.md) and
[Cloudflare Pages deployment](deployment/cloudflare-pages.md). The owner has rewritten
the article; proofreading and the viewer action button are complete. Public source
visibility remains pending; the static site is deployed at `orbital.hiina.space`.
The project now uses the Unlicense, retains third-party notices and includes a static build transcript at
`/build-log/`. The October15 follow-up rewrites the historical raw review bodies
and updates the private GitHub branch in place. The owner accepted the remaining
low-sensitivity cached-object exposure without requiring a Support purge. See the
[publication review](publication-review.md).

The October13 viewer polish implements a docked11-set library, independent paired
views and one shared timeline player. `viewer/session.ts` owns the only clock,
worker and immutable scene publication; each `viewer/viewport.ts` owns camera,
selection, locked tracking target and disposable drawing resources. The numerical
engines and retained regression fixtures are unchanged. See
[architecture/validation](evidence/viewer-workspace.md) and the
[reviewed plan](design/viewer-polish/plan.md). Older exhibit inventories below are
historical milestones; the public library is `src/viewer/catalog.ts`.

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

Adaptive flexible service now primes32 units of committed execution for live viewing,
then advances the display clock through that history while the worker refills. Its
physics head still owns actual facts; predictions keep their known-at visibility.
At full lead the128-unit total retention provides96 units behind the viewer. This
set's speed control is capped at4× after measured production-browser rollouts;
other sets retain16×. A slower device can still drain the buffer; playback waits
rather than extrapolating. Live joins the
buffered edge without rewinding a later cursor. Pause/hidden stops new work, history
can drain through a terminal fault, and Restart resets the seeded run. See
[reviewed playback contract](design/responsive-service/README.md) and
[original measurements](evidence/responsive-service.md) and
[sensitivity planning and4× evidence](evidence/sensitivity-planning.md).

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


## Maintained multiship network — 2026-10-09

The user accepted faster flexible service and selected a modest fleet exhibit.
After [Astra review](design/multiship-service/README.md), **Orison · relay network**
adds Ibis → Solstice beside Tern → Meridian. Both maintained relays orbit at radius3
under the same Orison/Mote field and thrust limits; Solstice begins a quarter orbit
away. Equator remains a ballistic radius2 hub with two berths and one finite fuel
inventory/import stream. Journeys overlap and deliver actual stationkeeping fuel;
ships retain their .05 cargo mass throughout this assigned fuel service.

One `maintained-network-v1` runtime owns the shared actual frontier and stock anchor.
Private epoch transactions process due flight facts and stable-identity refuels before
sequential bounded planners, then install the complete result without yielding.
Each relay owns its canonical loaded stream and one assigned reservation. Exact
sealed hub intervals can be shared; drawing data cannot seed physics. Storage guards
cover aggregate owners, private trials, cache and held displays. The existing32-unit
lead/128 total retention preserve Pause/Play/Live. The new set is capped at2× after
isolated actual-frame measurements at1×/2×; legacy speed ranges remain. Legacy domains are unchanged.

A shortage keeps a returned ship attached until a later funded retry. Coupled
capture/transfer/release faults invalidate that visitor and dependent station from
the event-left state; the healthy lane continues. Stopped stations are last-known
markers, with no later physical position or usable reference frame, even after that
stop leaves the rolling history window. Unexpected invariant failures stop the common
head at its last published state. General routing, shared-relay competition, new
fields, demand dispatch, station-to-station journeys and free-flight fault recovery
remain separate work. See [numerical and browser evidence](evidence/multiship-service.md).
The user accepted the exhibit at2×. A later robustness follow-up replaces the
duplicate legacy candidate sum with network-wide accounting, enforces reserved
short-runner caps, cleans up refused registrations and initializes chart cursors
at the current time. See [follow-up evidence](evidence/network-robustness.md).

## Finite staged launch and recovery — 2026-10-09

**Selene · Launch & recovery** carries Wren on Kestrel from Cairn, separates during
ascent, delivers .1 freight to Lantern, and recovers Kestrel at Cairn. Both vehicles
use smooth finite steering with force and acceleration limits. This is one authored
mission; Replay repeats the same prepared history, without resetting a continuous
resource economy.

The explicit `staged-flight-v1` orchestrator derives legacy Bundles from a single
component manifest. Upper-stage fuel is carried ballast during boost and stays in
its own tank. Separation is a retained thrust-end checkpoint with zero kick and
conserved wet mass/momentum. Children inherit its canonical state, not a display
sample. One mission-start stock ledger audits delivery, berths and consumption;
local child port copies only admit their independent operations.

The launch assembly retires at separation and two child actors become present.
Their lanes/history remain selectable; absent actors have metadata rather than
invented physical samples. Inactive centered frames disable and fall back as a whole
to inertial. Historical paths clip to the selected frame's lifetime. Follow/Chase
stop if their target disappears. Close-zoom drawing samples explicitly include each
newborn child's first coast and flight. Physical nodes, drawing samples and output
bytes have aggregate admission bounds.

[Astra disposition](design/staging/disposition.md) and [validation](evidence/staging.md)
record the bounded contracts. Atmosphere, hull/contact physics, separation kicks,
continuous turnaround and connection to maintained stations remain subsequent work.

## Surface detail and playback — 2026-10-09 follow-up

The user accepted staged launch/recovery as a model-train analogue of a launchpad
catch, and prefers watching it around0.1×. The set now starts at0.1×; playback speeds
are remembered separately for each set during the page session. This changes the
viewer clock rate, not physical durations or integration policy.

Staged actors use rocket silhouettes; the assembly includes a visible join. Their
axis follows commanded thrust during burns, holds the last commanded direction
while coasting, inherits the assembly's release direction before the booster's next
burn, and follows the outward pad normal while supported. Camera/frame transforms
rotate this world axis as a direction rather than subtracting reference velocity.
End-on views have a circular nose/nozzle symbol. This is presentation of steering
commands, not a new rigid-body attitude or angular-momentum model.

For larger networks, the proposed boundary is a funded surface-operation contract:
actual departure/arrival times, orbital handoff state and mass, consumed fuel,
delivered freight, booster recovery and turnaround availability. A pre-solved local
trajectory can supply close playback without online reintegration. At network scale,
most stage geometry can be hidden; inspection can show the local sequence or slow
the shared clock explicitly. Physics/resource outcomes must not change with zoom.
Pre-solving addresses computation cost; it does not make short events more visible
at fast playback. This contract/provider abstraction is a proposal, not an implemented
continuous staged scheduler.

[Orekit's generated ephemeris interface](https://www.orekit.org/site-orekit-latest/apidocs/org/orekit/propagation/BoundedPropagator.html)
provides a relevant precedent for querying bounded trajectories after numerical
integration. No Orekit dependency was added.

## Bounded lunar return profiles — 2026-10-10

Continuous lunar ground service now tries a short deorbit/coast/terminal-braking
return, with bounded nearby departure choices and the original powered descent as
fallback. The same northern pad, inclined depot, binary field and synchronous spin
remain. Candidate selection favors economical, less bent controls without waiting
for a global optimum; all capture, fuel and clearance checks remain canonical.
Separate seed families, streamed admission and an actual serialized-node preparation
allowance keep failures private and bounded. Completed depot physics retires before
its longer drawing history. See [reviewed design](design/lunar-return/README.md)
and [comparison and rollout evidence](evidence/lunar-return.md).


## Finite planet–moon expedition

The Aster–Selene expedition joins atmospheric ground departure, physical timing orbits, full-field interbody transfers, lunar surface service and atmospheric return in one prepared finite exhibit. It retains exact state/fuel seams and absolute-epoch entry; a separate authored continuous wrapper now supplies repeated service. See [design](design/apollo/README.md) and [evidence](evidence/apollo.md).

## Continuous planet–moon expedition

Aster–Selene · Continuous expedition repeats the accepted finite atmospheric mission with one canonical compilation, exact absolute-epoch rotational reuse, supported ground recovery and paid imported refill. It keeps a rolling history and the shared Live/Pause controls. See [design](design/continuous-apollo/README.md) and [evidence](evidence/continuous-apollo.md).

## Overlapping planet–moon expeditions

**Aster–Selene · Crossings** adds Argosy from Farpoint and the local Wren orbiter. Two independently fuelled expeditions alternate visits to a shared lunar pad; one canonical compilation serves both through validated phase symmetry. Global absolute-epoch local coasting, isolated faults, worker-prepared cycle strips and bounded rolling playback share one fleet publication. See [design](design/overlapping-expeditions/README.md) and [evidence](evidence/crossings.md).

## Libration-region relay

**Aster–Selene · Beacon relay** retains Crossings and adds the actual-field outer equilibrium station Beacon plus Kestrel’s cached finite-thrust lunar round trips. Haven funds restored departure loads, and delivered relay parcels are explicitly consumed. Shared rolling playback needs no online station controller. See [design](design/libration-service/README.md) and [evidence](evidence/libration.md).

## Staged missions and reverse playback — 2026-10-11

**Staged expedition** and **Staged service** retain separate booster, orbiter and
lander inventories through exact state splits, atmospheric recovery, lunar landing
and paid rendezvous. The continuous wrapper uses one admitted physical mission,
funded turnaround and bounded retained history. The user accepted these exhibits
and requested a maneuver aesthetics pass: insertion now uses a gentler continuous
burn, and the lander ascends into a prograde rendezvous coast. World scale and
physical gates are preserved. See [current evidence](evidence/staged-refinement.md)
and [Astra disposition](design/staged-refinement/disposition.md).

The wider speed control spans reverse, center0× pause and forward. Reverse is
playback of physical history; it does not undo events/resources or integrate the
canonical service backwards. Live resumes forward. Compact [real mission references](design/mission-reference/README.md)
are retained for offline comparison, without introducing real missions into the UI.

## Combined Aster–Selene exhibit — 2026-10-11

**Aster–Selene · full service** combines the refined staged launch/lunar landing/
rendezvous/recovery recurrence with Kestrel's funded Haven–Beacon service and two
canonical free satellites, Wren and inclined lunar Solace. Four distinct terminals
and seven selectable assembly/stage/craft lanes share one rolling clock and resource
history. Prepared clocks remain independent; the composition publishes atomically
and isolates passive satellite faults. See [design and Astra disposition](design/aster-system/README.md)
and [evidence](evidence/aster-system.md). Planned markers have fixed epochs and
timeline labels no longer wrap. Measured CPU projection/reconstruction costs were
reduced while retaining Canvas/DOM/SVG. This is an authored exhibit, awaiting the
user's activity/density preference, rather than a general route dispatcher.

## Solar-scale powered cycler — 2026-10-11

**Sol · Mars cycler** adds a finite 2,398-day history with a powered recurring carrier
and three funded Earth-to-Mars cargo taxis. Prescribed circular Sun/Earth/Moon/Mars/
Jupiter proportions replace the miniature Aster/Selene field in a separate versioned
prepared domain. Spacecraft coasts and bounded thrust are forward-integrated throughout;
actual encounter epochs preserve lunar/Jovian phases. Day-based playback, heliocentric/
Earth–Sun rotating and local centered views share the existing 3D camera and controls.
Preparation is off the playback path. This is a fictional powered cycler, with independent
fuel/capture/resource gates, rather than a real Starship or ballistic Aldrin trajectory.
[Contract/review](design/solar-cycler/README.md) and [evidence](evidence/solar-cycler.md)
cover the finite resource calendar, numerical comparisons and production performance.

## Compact powered cycler — 2026-10-11

**Aster–Selene · Cycler** and **Aster–Selene · Cycler service** retain the carrier/taxi
aesthetic at the accepted fictional planet/moon scale. One reusable shuttle makes two
parcel deliveries per72-unit cycle; the carrier coasts54 units, with smooth powered
departure/insertion and a short Beacon resupply. Synchronous pads and the actual-field
Beacon anchor permit exact admitted-cycle rotation without online re-solving. Tanks,
carried mass, paid captures and cumulative imports/deliveries remain physical.
Native canonical RK4 admits the full coupled forward execution against independent
DOP853; fixed-field reuse never propagates a drawing sample.128-unit rolling history
includes32-unit lead, bounded worker transactions and held/rewind/Live semantics.
[Contract/reviews](design/compact-cycler/README.md) and
[evidence](evidence/compact-cycler.md). Sun/Mars/Jupiter analog remains separate work.

## Compact cycler refinement — 2026-10-12

The owner rejected v1's fully powered taxis/long Beacon burns. Historical profile-v2
keeps the field but uses a closer2.171-radius carrier pass,86.5% coast, four-unit
carrier burns and explicit coast intervals on every taxi leg. Earlier handoffs and
Cairn longitude1.2 give Aster boarding radius3.198. Independent/aboard time is6.5/7
inbound and7.5/40 outbound. Exhaust4 is restored with reserve; stronger short-burn
engines are explicit. This improves morphology, not a demonstrated optimal natural
cycler. Both runtime modes use the admitted source; Wayfarer's label is shortened.
[Current evidence](evidence/compact-refinement.md) and
[review dispositions](design/compact-cycler/refinement/disposition.md).

## Finite ballistic pass-through service — 2026-10-12

The user rejected the remaining Beacon turnaround, accepted the zero-thrust research
plot and requested real early parking/phasing coasts. **Aster–Selene · Cycler** now
shows two uninterrupted native carrier circuits and two paid Pipit round trips:
early Aster launch, four parking laps, small orbital connection, lunar braking/descent,
return orbital capture/coast and separately phased ground landing. Wayfarer never
stops, burns or resets. Native absolute-epoch targets, separate tanks/carried mass,
all four reserves, funded reloads and bounded work/drawing publication remain explicit.
The old supported-cycle service is retired from the chooser; continuous free-carrier
correction and resource recurrence remain a later gate.
[Contract/reviews](design/compact-cycler/redesign/README.md) and
[validation](evidence/pass-through.md).

The finite **Aster–Selene · Cycler fleet** adds two independently propagated, time-phased unpowered carriers and two riders. Riders dwell on Selene and use lunar parking before boarding the later carrier; Cairn has two schematic berths, Haven one. Explicit parent identities preserve paid captures, separate tanks and actual carried mass. See [design](design/cycler-fleet/README.md) and [evidence](evidence/cycler-fleet.md).

Compact cycler sets now offer **Layers → Potential map**: fixed colors and isolines on the physical XY plane, aligned during scrubbing and frame changes. It is default off, supports Top/oblique views and suppresses near edge-on views. The timeline resizes from its top edge. The scalar field is display-only; Lagrange-like markers and schematic relief remain later views. See [evidence and 4K compositor limits](evidence/potential-field.md).

The accepted scalar layer now fades to the background before the overview edges. **Layers → Relief** adds an adjustable schematic height mesh with bodies and ships riding its curve; **Lagrange points** adds three equilibria derived from this fixed-primary rotating force. Physical states/resources remain unchanged. Named-frame centering, historical epochs and Follow use the same display deformation. WebGL failure falls back to the flat map. See [relief evidence](evidence/relief.md) and [Astra disposition](design/potential-field/relief/disposition.md), including the current 4K rendering envelope.

Relief now runs independently of Potential map, with a separately toggled rectangular **Relief grid**, transparent tint/isolines and shallow-angle silhouettes/perimeter outlines. The multiplier slot has fixed width. L4/L5 are explicitly deferred pending a corresponding dynamics model; no geometric guides are shown. See [current relief-grid evidence](evidence/relief-grid.md).

## Continuous stabilized cycler fleet — 2026-10-12

**Aster–Selene · Continuous cycler fleet** extends the accepted later-carrier visits using a separately admitted numerical stabilization contract. Two carriers/two riders repeat their funded missions, while carrier maintenance fuel remains permanently debited. Immutable clipped drawing chunks support four-loop rolling history, held/reverse/Live and bounded resource publication. Cyclers recommend two-loop trails with a remembered Layers slider; the timeline can resize vertically and scroll. See [design/reviews](design/continuous-cycler-fleet/README.md) and [evidence](evidence/continuous-cycler-fleet.md). Extra ships are a later content gate.

## Spatial observatory exhibits — 2026-10-12

**Sol–Earth · Webb halo**, **Sol–Earth · Gaia Lissajous** and **Sol–Earth · Observatory departure** are finite compact fictional circular-binary scenes. Both bodies orbit the barycenter; all five Lagrange points derive from the admitted field. Real spatial trails and a close **L2 rotating** frame show vertical motion. Departure starts in Earth parking orbit and pays two bounded finite burns into the halo; no ground ascent or real mission reconstruction is claimed. Lissajous is a finite center-motion witness with no exact recurrence. Old coplanar relief stays separate. Compact grids add a dimmer adjustable strength and circular fade. See [evidence](evidence/libration-orbits.md) and [review disposition](design/libration-orbits/implementation-disposition.md). Stationkeeping, physical visits and continuous libration service are later slices.

The fictional Helion–Orison observatory extensions add a maintained Lissajous-like
continuous survey and a finite airless staged launch/parking/halo mission. See
[extension evidence](evidence/libration-extensions.md). The survey continues actual
six-state flight with paid corrections and a bounded history, rather than replaying
an orbit. The mission conserves stage mass/fuel and continues from actual parking
states. New names are fictional; Webb/Gaia/WMAP remain aesthetic inspirations.
