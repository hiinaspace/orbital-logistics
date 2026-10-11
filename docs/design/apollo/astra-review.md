# Finite Apollo exhibit: architecture review

2026-10-10. Scope: one authored planet launch, parking orbit, interbody crossing,
lunar timing orbit, lunar landing and launch, return crossing, atmospheric entry
and ocean recovery. Continuous recurrence is a later task.

## Recommendation

Build a separate, narrowly versioned finite exhibit. Use one prescribed binary
world and one absolute mission clock throughout. Every free-flight phase feels
both gravity sources. Existing six-state finite-steering programs and the Runner
remain the vacuum execution path; atmospheric propagation owns ascent and entry.
A mission assembler owns exact transitions, resources, identity and publication.
Do not grow atmospheric-mission-v2's fixed-primary, two-child, station-delivery
contract into this mission implicitly.

The smallest coherent vehicle is one fictional capable vehicle for the entire
trip. Staging, an orbiting command module, rendezvous and booster recovery are not
needed to establish the requested journey. If staging is retained as content,
use the existing conserved separation ownership and separately budget the child;
do not make staging a prerequisite to the orbital itinerary.

Parking and lunar timing orbits are actual unconstrained coasts under the same
binary gravity. They need no depot and no attachment event. Show a substantial
orbital arc or revolution with near-zero thrust and a clear later departure;
do not claim a perfectly circular persistent orbit in the perturbed world.
The planet parking coast fixes a departure window; the lunar coast lets the
actual spinning landing site move into useful geometry.

## Physical seams

End ascent outside the atmosphere, after a real insertion burn. Initialize the
vacuum owner with exactly that terminal inertial six-state, remaining propellant,
dry/cargo mass and absolute epoch. End vacuum return outside the atmospheric top
on a descending trajectory and initialize entry identically. Density is already
exactly zero outside topHeight, so the force law agrees there. Declare these
epochs in the frozen mission rather than switching physics opportunistically
from render samples. Preserve event-left and event-right states and admit only
one owner for each interval.

No sphere-of-influence gravity switch is necessary. Patched-conic or two-body
arcs may seed the offline solve but cannot replace either force source in the
published replay. Body-relative authoring frames are useful; transform both
position and velocity and include the body's prescribed acceleration in any
relative integration.

Lunar touchdown uses an explicit paid land event with the existing geometric
capture and numerical allowance. Dwell evaluates the actual moving supported
site, followed by atomic finite-thrust launch. No refuel is needed for a first
witness; if used, it needs an explicit finite lunar stock and a transfer ledger.
Splashdown uses the existing bounded dissipative water event, with its impulse
and relative kinetic energy recorded. It does not restore fuel or imply
transport back to the launch pad.

## Source-level integration hazards

- src/model-set/atmospheric-mission.ts explicitly requires one fixed origin,
  two ports, duration <=16 and a particular staging/delivery program. Its local
  entry-clock adapter is valid only for that autonomous fixed world.
- src/model-set/entry.ts currently requires epoch zero, one fixed body and
  fixed-only rail fields. prepareEntry starts at zero; altitude uses bodyState
  at zero; root and monotonicity tests use inertial rather than body-relative
  velocity. A shifted public timestamp does not repair those calculations.
- src/sim/entry.ts entryStepEnvelope bounds only bodies[0], omits moving-source
  displacement and the other body's gravity, and its air-speed enclosure omits
  body translation. Reuse certifiedCoast's all-source principle with explicit
  aero/thrust bounds; do not merely loosen validation.
- entryForces cancels absolute gravity. For a translating atmospheric body,
  terminal control should account for the derivative of its intended moving-air
  target velocity. This includes prescribed body acceleration and spin terms
  if the controller promises to track that target. At minimum define and test
  the chosen relative controller rather than silently importing fixed-world
  behavior.
- RecoveryPose currently freezes a center and recoveredState returns spin
  velocity only. Moving recovery needs the source rail/body identity, current
  body position and velocity, and a body-relative rotating contact offset.
  Update every viewer query as well as physical recovery queries.
- aerodynamicForces itself already computes moving air correctly, but callers
  select bodies[0]. New admission must resolve atmosphere.bodyId explicitly or
  assert its ordering contract.
- moving-surface-ports-v6 is narrowly limited to two bodies, two ports, exactly
  one moving surface port plus ballistic targets, and a two-unit horizon.
  A new mission should not manufacture a dummy timing depot merely to pass it.
  Extend surface-domain admission explicitly or introduce a narrowly versioned
  mission surface-operation adapter that reuses the paid landing/release math.

A fixed primary plus an independently prescribed moving moon is also a coherent
fictional world if deliberately authored and documented. It avoids moving
planet recovery, but still requires all-source atmosphere safety bounds and
absolute time because lunar gravity changes with time. It cannot reuse the
fixed autonomous entry offset unchanged. Choose the world once; do not freeze
the primary during atmospheric phases of an otherwise moving binary.

## Bounded authoring method

Use offline multiple shooting with deterministic saved seeds and fixed work
caps. First choose body radii, gravity, atmosphere extent, engine and fuel so a
clean schematic journey is feasible. Historical hardware and Earth/Moon scale
are unnecessary. Start coplanar or with a modest inclination and favor a useful
landing-site phase over unnecessary plane changes.

1. Author the supported atmospheric ascent and insertion; retain its actual
   terminal state. Propagate a meaningful planet parking coast.
2. Search a small departure-window grid and transfer duration grid. Solve a
   finite departure arc and finite lunar insertion arc, with a long free coast
   between them, against a lunar-relative orbital-state objective. Full binary
   replay decides admission.
3. Propagate the lunar timing coast from that actual insertion state. Solve
   deorbit, coast and terminal landing using the existing smooth return family
   as a seed. Freeze the actual site, never move it to the solved endpoint.
4. Hold a finite surface dwell, solve supported ascent and lunar departure,
   and target a descending planet entry corridor after another long free coast.
   A return lunar parking coast may make this easier but is not required.
5. Replay entry through first safe water contact. Optimize entry corridor and
   loading limits, not a prescribed final splashdown longitude.

Prefer two or three smooth keys for ordinary departure/insertion burns; use
more only where terminal landing needs them. Fix nonzero minimum coast durations,
bound steering turn and fuel, and rank feasible results by simple path quality
and delta-v. These are bounded exhibit choices, not a general trajectory planner.
Retain the actual controls, epochs, work counters and provenance. Never run an
optimizer in playback preparation.

## Budget and validation

Do not integrate the entire interbody trip with atmospheric near-surface step
constraints. Atmospheric legs currently apply a scale-height speed criterion
even outside the air and have a 32768 grid limit. Use separate bounded owners
with a coarser canonical vacuum grid and certified subdivision. Count all
simultaneously retained phase nodes, target/support providers, diagnostics and
serialized drawing data once across the complete mission.

Start with current finite-exhibit packet ceilings where feasible and measure a
full mission before setting any larger explicit ceiling. Reserve budgets before
constructing a phase. A failed phase discards the private mission; publication
occurs only after all phases and resource conservation pass. Dense near-surface
drawing should cover those short intervals only, with coarser coast samples and
exact burn/landing/recovery boundaries.

An internal smaller witness is necessary: ascent -> vacuum coast -> descending
entry in the chosen two-body world, starting at a nonzero epoch. It should prove
the atmosphere/vacuum seams, clocks, all-source clearance and recovery motion
before spending effort on lunar targeting. This is an implementation test within
the already requested task, not a separate user approval gate or substitute for
the complete exhibit.

Final evidence should include independent DOP853 replay from the original
launch and each exact supported release; tighter canonical-step convergence;
seam state/mass/fuel equality; all coast minimum clearances; pre-land residuals
with numerical allowance; no vacuum impulses; paid bounded smooth thrust;
fuel reserve through recovery; integrated orbital motion during timing waits;
and original-state replay of the complete returned mission. Repeated worker
preparation and varied scrub/query order must preserve canonical results.
Browser inspection should cover planet launch, each timing coast, lunar contact
and launch, and return entry at close scale plus the interbody overview. It
establishes display behavior, while the user's viewing remains the aesthetic
acceptance of the complete finite exhibit.

## Implementation review disposition

Astra reviewed the implementation and the frozen witness after the architecture
review. The implementation addresses arc ownership, complete vacuum atmosphere
exclusion, ascent loading limits, support geometry and spin admission, capture
numerical allowance, and splashdown boundary states. Final review found no
remaining correctness blocker for this bounded finite exhibit.

The independent lunar landing residual fits the explicit local allowances. The
later full-mission difference is assessed separately against a 1e-3 envelope;
that envelope does not relax near-contact admission. Independent integration
success, capture correction and recovery relative speed are retained in the
oracle evidence. Continuous service and historical Apollo hardware remain
outside this witness.
