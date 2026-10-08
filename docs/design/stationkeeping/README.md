# Maintained relay — 2026-10-08

The user accepted smooth finite steering in 3D and selected stationkeeping plus
tracking cameras, explicitly requesting an Astra high-level review. The
[brief](brief.md), [review](astra-review.md) and [disposition](disposition.md) preserve
that decision. Actual transport was gpt-6-astra/xhigh, CLI 0.153.4, exit 0, session
01a11dbf-8667-7433-9810-e8a8bbf92605; the transport header was verified before reading. Retained report/log whitespace is
normalized at line endings; review content is unchanged.

## Physical ownership

`powered-ports-v4` is a new logistics domain with exactly one powered relay and one
ballistic origin, in the same prescribed gravitational field. Older readers reject
the discriminator. New readers reject powered fields under legacy domain/rail tags.
Existing scenario/dynamics/snapshot v3 and program 3/4 contracts are unchanged.

A powered rail contains initial six-state, full validity interval, integration
policy, clearance, fixed dry/ballast mass, its own maintenance tank/exhaust/engine,
frozen finite-arc program and fuel reserve. Its private logistics-free Runner is
constructed from the enclosing physical field, never from an arbitrary recursive
bundle. No target impulses or operations are supported. Full-horizon safety,
requested-epoch validity and reserve admission precede visitor execution. Capture,
dwell and release use this canonical trajectory, never display interpolation.
The visitor bundle retains the entire provider definition; changing it invalidates
the old arrival solve rather than mutating a forecast in place.

The relay does not exchange cargo/fuel in this slice. All its exchange stocks and
capacities are zero. A visitor carries its own loadout during dwell and departs
before maintenance. Attachment intervals and positive-throttle maintenance arcs
are half-open. Capture at an arc start/interior rejects; capture at its end is
permitted unless another arc starts there. Release at a burn start is permitted.
Attachment across a burn, including a stay through the horizon, rejects statically;
capture has an execution defense as well. This avoids unaccounted docked mass.
Maintained-station freight/refuelling needs an authoritative mass/event owner later;
that does not necessarily require a monolithic numerical integrator.

## Bounded maintenance policy and witness

**Orison · maintained relay** is a finite 64-unit exhibit. Meridian starts in a
35° circular orbit of radius 3; Mote supplies a small gravitational perturbation.
Nominal orbit geometry is independent of the perturbed trajectory. Position is
projected into the reference plane to find its current phase; position and velocity
are compared to a circular state at that phase. Maintenance permits phase drift.
It never resets state onto an ideal orbit or silently matches a nominal clock.

Authoring checks occur at 4,12,20,28,36,44,52,60. Position/velocity deadbands are
.001/.0003; the full-horizon envelope is .02/.005. Outside the deadband, a bounded
six-component shooting solve chooses two constant-force pulses of 1.9 units with a
.2-unit off interval. Commands become fixed inertial directions and throttle values,
with actual engine, mass, cap and fuel integration. This pulse family does not claim
attitude dynamics or smooth continuous gimbal control. Each check has at most 64
candidate propagation evaluations, with a .3 fuel reserve. Failure preserves a
report rather than increasing the search or publishing an admitted scene.

The accepted policy makes six corrections and two deadband skips, uses about .02094
of its initial .6 fuel, and has maximum observed phase-free position error .002366.
A changed initial state generates different corrections; solve-budget and reserve
failures are retained. The original four-check attempt violated the declared
maintenance envelope; its [failure report](search-failed-envelope.json) is retained.
The accepted denser cadence stays within the eight-check review budget.

Tern leaves the independently ballistic origin at 20, uses two steered finite burns,
arrives at 34, dwells until 36 and departs at a maintenance start. It keeps its .05
loadout; this is a relay rendezvous, not a freight-delivery/return objective. Arrival
is solved against the frozen actual target. Both nominal-clock and unmaintained
substitutions miss the gate. Corrections continue after the visit.

`stationkeeping_search.py` independently authors using seven-state DOP853. Station
solves use a fixed bounded pulse family. The visitor uses the accepted inclined
transfer as a seed; a finite-difference Jacobian and pivoted QR choose six locally
independent parameters from 14, holding the others fixed. Its 256-evaluation ceiling
is separate from station checks (66 accepted calls). The [frozen report](search-report.json)
is compiled by `scripts/stationkeeping-fixture.ts`; `--check` verifies byte identity.
No solver/controller runs during playback, scrubbing or camera movement.

## Presentation, budgets and failures

The powered station has one presentation record per scene, containing its actual
fuel, thrust, event boundaries and trajectory. It is still drawn as a station;
there is no duplicate independently propagated ship icon. Its timeline, schedule,
error/fuel readouts and whiskers use the physical program. Orbits adds a nominal
geometry line and an unmaintained comparison trajectory/marker when it is selected.
The comparison starts from identical state/field and receives no thrust.

At most two visitors, one powered relay, two total ports, 32,768 powered target grid
intervals and 65,536 aggregate target grid intervals are admitted. Finite preparation
also bounds nominal grid work plus event allowances to 262,144 and serialized display
packets to 8MB. Each Runner retains its existing 65,536-node ceiling. The witness has
4,113 station display samples and 2,053 visitor samples in a 4.27MB JSON packet.
Dense station display is retained once, while canonical private providers remain
independent per visitor; this is a bounded finite design, not a new live cache.

Authoring failure, leaving the maintenance envelope and a physical fault are
separate outcomes. A missing correction can leave a physically safe drifting orbit;
it does not imply a crash. Unsafe/depleted/incomplete providers fail finite admission
before public inventory effects. Physical queries require the exact requested epoch
and valid status, with no extrapolation or nominal fallback. Runtime adaptive
maintenance, shared stock mass/refuel, continuous maintained-station dispatch and
persistence remain separate extensions. [Evidence](../../evidence/stationkeeping.md)
records numerical, safety, replay, endpoint and UI checks.
