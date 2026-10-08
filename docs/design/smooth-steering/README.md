# Smooth steering and inclined finite transfer — 2026-10-08

The user accepted the 3D camera, requested optional see-through bodies with occlusion
on by default, and selected smooth steering plus a finite-thrust spatial set.
This slice introduces a physical timed heading law and one offline-targeted delivery.
It does not retarget the accepted fixed-heading surface or continuous services.

## Command contract

Scenario/dynamics/snapshot remain canonical v3. **Programs with steering use schema4**;
fixed-heading programs retain schema3 and their previous arithmetic. Older readers
reject schema4 instead of silently discarding steering and flying a different route.
Current readers reject steering in schema3. Propulsion-free legacy conversions are
unchanged; saved snapshots still require deterministic forward replay.

Each powered arc keeps its throttle/start/end/initial inertial direction. An optional
`steering: {kind: 'spherical-smoothstep-v1', keys: [{offset, direction}, ...]}` defines
unit inertial heading waypoints relative to arc start. Two to 64 keys must cover the
whole arc, with strictly increasing offsets and representable absolute epochs. The
first matches the initial direction; adjacent shortest turns are at most 120°. Larger
turns need an intermediate key, removing the antipodal ambiguity.

Between keys, shortest-arc spherical interpolation uses fraction `u²(3−2u)`.
Heading and angular velocity are continuous, with zero angular velocity at each key.
The explicit easing is reproducible and bounded; it is not an attitude/gimbal solver
or a vehicle slew-rate guarantee. Fixed directions are returned unchanged. Steering
is evaluated at every RK stage and at physical sample queries. Key epochs split the
canonical grid, without resetting the anchored mass law or creating ledger burns.

Force, acceleration caps, depletion and exact anchored mass retain their previous
contract. Integrated propulsive delta-v is exhaust velocity times log mass ratio;
it is the integral of acceleration magnitude, not the norm of a net vector. The
surface certificate uses a unit-direction bound with rounding allowance across the
whole turn. Launch checks its actual initial heading. Display direction uses this
same law at the cursor/whisker epoch; it is never interpolated from sparse samples.
Continuous template symmetry rotations include every key while keeping relative
offsets and exact local/global event mapping. Their authored fixed routes stay fixed.

## Spatial witness

**Orison · inclined transfer** carries .05 freight from Equator at radius 2 to Incline
at radius 3 in a 35° plane. Tern departs at 1, steers through a 1.55559-unit departure
burn, coasts, and brakes from 13.32897 to 15 with a second steered arc. It docks with
paid negligible residuals, unloads at 15.3 and remains attached through 24. There are
no authored impulses. The legacy return objective is unused viewer metadata; this
is a one-way delivery, not a completed return puzzle or continuous service.

An example physical scaling is a fictional primary with radius 1,000 km and gravity
parameter 1,000 km³/s². Time/velocity/acceleration units become 1,000 s, 1 km/s and 1 m/s²;
one mass unit is 1,000 kg. Thus the engine is 250 N, exhaust 3 km/s, acceleration capped
at 0.14 m/s², carrying 50 kg on a 1,000 kg dry tug with 900 kg initial propellant. Departure
and braking last about 26/28 minutes, across a 3.89-hour flight. This is a plausible
low-thrust chemical-scale example, not a calibrated real spacecraft or mission.

`spikes/numerics/steering_search.py` performs bounded independent seven-state DOP853
shooting with three spherical direction keys per arc and two burn durations. The
14 parameters target six arrival components; the accepted result is a feasible
witness, not a fuel/time optimum. It freezes [parameters/directions](search-report.json)
after tight refinement. `scripts/steering-fixture.ts` compiles and admits the saved
program through the canonical Runner and shared inventory checks; `--check` tests
byte-for-byte reproduction. Targets/port phases are then fixed for every replay.

## Viewer and boundary

Layers adds **See-through bodies**, unchecked initially. It persists across set and
camera switches for the session, independently of Clear view's line/marker layers.
With it enabled, body fills/outlines are faint and do not occlude paths, labels or
picking; visible projected overlaps use the chooser. Disabling it restores opaque
spherical clipping. The toggle never changes frame, time, programs or resources.

[Evidence](../../evidence/smooth-steering.md) covers seven-step physical refinement,
independent direction/fuel/events/pre-capture checks, conservative safety, replay,
continuous rotations, drawing and actual browser/in-app inspection. Existing surface
programs retain their admitted fixed-heading steering; smoothing those flights needs
separate retargeting and admission. General state-feedback guidance, throttle ramps,
attitude dynamics, stationkeeping, new ground geometry, atmosphere and staging remain
future slices. No new external design review is claimed.
