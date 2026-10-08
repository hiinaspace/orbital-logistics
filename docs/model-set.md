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
- Shared play/pause/speed/scrub/replay, pan/zoom/fit, inertial/rotating/object-centered
  frames, selection and overlap chooser, ship activity lanes, selected fuel/freight
  traces, finite station stocks, event jumps, and reversible display layers.
- No puzzle objectives, scoring, maneuver handles, precision editor, or acceptance
  dialog in the viewer. The numerical fixture format still retains legacy goal
  metadata for compatibility; it does not impose a task on the viewer's user.

## Execution and presentation

Each vessel retains a versioned scenario/program JSON. A worker runs every complete
program through the unchanged canonical Runner and rejects truncated/failed runs.
The logistics schema now admits two to eight circular ports around a fixed primary.
The viewer set contains ship identity/color/cargo label, station roles/berth counts,
and a chosen rotating frame. All vessels must have identical world/port data and
unique identities.

These are overlays of independently executed test ships, not a joint fleet engine.
Before admission, the combined transfer ledger is checked against one finite stock
per port at every change epoch; berth occupancy is checked too. The authored services
have no ship-to-ship handoff, collision/mutual gravity, runtime dependency, or resource
competition that requires replanning. Shared stocks and berths are real constraints on
which prepared sets are admitted. They are not a general scheduler.

The worker returns dense disposable drawing samples plus exact event epochs and each
ledger. Physics checkpoints stay inside the Runner. Playback performs view-only
interpolation; cargo/fuel/service state changes at exact ledger epochs. Docked positions
are evaluated on their analytical rails. Free-coast display velocities use pre-burn
endpoints so an impulse is not smeared into the preceding interval. At extreme zoom,
linear display interpolation can become visible; it never becomes a propagation origin.

All objects and all path vertices transform at their own epoch. A rotating frame
uses both rotation of axes and the angular-velocity term for velocities. Changing the
view never edits a program. Model assumptions/provenance live in optional details.

Replay rewinds the finite scene, including its inventories. It is a playback option,
not sustained service, physical recurrence, or free resource replenishment.

## Next decisions after viewing

First assess the experience directly: readability, motion, frames, time controls, and
what kind of activity the user wants next. No required engagement diary or puzzle gate.
Then choose one content extension or simulation change from that feedback.

Real multi-body station traffic needs more than adding a moon icon. Current logistics
ports are circular rails in a fixed-primary system; future lunar/binary stations need
an explicit trajectory/maintained-orbit target and validated transfers in that field.
Ground stations also require a real launch/landing model through the surface boundary;
a circular orbital port must not be relabeled as a ground facility.

Preparation can progress from curated programs to a small transfer catalogue and then
automatic scheduling/optimization if desired. Automatic route selection is authorized
by the accepted direction; retain inspectable generated programs, costs, and provenance.
Dynamic flight commands and a periodic programming language are not prerequisites.

## A coherent 3D migration

Keep this initial viewer and validated physics planar. A meaningful early 3D engine
slice would migrate the whole physical contract together, while retaining a 2D view:

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
