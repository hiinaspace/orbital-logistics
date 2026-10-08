# Spatial foundation evidence

2026-10-08, natto. User authorized overnight 3D foundations after Astra senior review,
then a bounded lunar-freight feasibility experiment. No full 3D camera or scheduler.

## Architecture and review

[Review brief](../design/spatial-foundation/brief.md), [Astra review](../design/spatial-foundation/astra-review.md),
[dispositions](../design/spatial-foundation/disposition.md), and [transport](../design/spatial-foundation/astra-transport.json).
Actual `gpt-6-astra`/xhigh, CLI0.153.4, read-only, exit0; no further reviewers delegated.

One canonical `rk4-canonical-v2` engine uses `[x,y,z,vx,vy,vz]`. The input validator
upgrades schema1 scenarios/programs explicitly, preserving original fixture JSON;
new serialization is schema2. Legacy snapshot anchors are rejected with recovery
instructions; scenario/program conversion and replay remain available. Nested editor
baseline/accepted programs pass the same boundary. Circular rails use explicit 3D
center and orthonormal u/v, retain absolute phase+rate*t, and reject malformed bases
without repeatedly normalizing serialized values.

Burns are inertial Cartesian vectors or body-relative R/T/N components with an explicit
inertial orientation axis. R is relative position; T is normalized axis×R; N=R×T.
Legacy CCW burns become +Z-axis reference burns, normal0, preserving clockwise semantics.
Axis/R cross norm≤1e-10 rejects before mutation; zero impulse can bypass geometry.
Fuel uses the resolved vector magnitude and current mass. No view-dependent burn axes.

Runner preserves epoch-anchored grid/event steps, ordered event transitions and replay
validation. Public event boundaries expose the state before the first instantaneous
event and after the last at that epoch. Dock ledger records pre-attachment miss and
residual speed separately. Display interpolation uses the actual left endpoint;
it never reverses a burn from a post-capture position or supplies physical targets.

The safety certificate uses full spatial separation and speed. Its proof is unchanged:
inside every source's half-clearance neighborhood, acceleration is bounded by the sum
of μ/(radius+half-clearance)². Relative excursion is bounded by (ship speed+source speed)h
plus accelerationBound*h²/2. If it remains inside all neighborhoods, neither stages nor
continuous motion reach a surface. For an accepted u/v rail, the Frobenius bound
|radius*rate| sqrt(|u|²+|v|²) conservatively bounds evaluated source velocity, including
basis rounding. Failed certificates subdivide deterministically or stop; no softening.

Spatial apsis/closest-approach diagnostics use full relative vectors. Legacy targeting
and geometric orbit matching explicitly require the XY domain and +Z, normal0 reference
burns; they reject spatial inputs instead of projecting them. All view transforms carry
six components; the schematic projects XY, retains Z rotation and exposes nonzero depth/
vertical velocity on ship inspection. A zero projected speed has a stable glyph heading.

## Verification

- `npm run build` passed.
- `npm run test:sim`:80 passed, including nine new spatial/label cases plus migrated
  legacy checks. Tests cover all retained planar programs, translated oblique analytic
  motion, fourth-order convergence, noncoplanar moving-source covariance, normal/
  Cartesian burns and pole rejection, third-axis surface/capture failure, paid residuals,
  canonical partitions/snapshots/event sides, planner guards and pre-capture display.
- `PLAYWRIGHT_PREVIEW=1 npm run test:browser`:6 production Chrome tests passed,
  including stable anchors through scrub reversal/frame changes/selection. Existing
  loading cancellation, finite replay, controls, resources and narrow layout remain checked.
- `npm run evidence:spatial`: independent Python/SciPy DOP853 checks with tightened
  oracle, h/h2/h4, explicit event-left states and fuel. Smooth coast errors decrease
  approximately16× per halving until roundoff. At h=1/512 the largest sampled spatial
  position error is2.325e-11; velocity8.393e-12. Oracle tightening changes state by at
  most1.246e-11, below one tenth of the declared1e-8 normalized budget.
- Inclined logistics h=1/512,1/1024,1/2048 independently replays the full paid round trip,
  exact discrete trace and resources; position error≤1.494e-12, velocity≤8.054e-13.
  Independent pre-attachment capture position/velocity residuals plus2e-8 combined
  uncertainty remain below the1e-5 interface tolerance. Post-dock equality alone is
  not used as capture evidence.
- Fifteen pre-migration fixtures/vessels at `65935ab` retained in
  [spatial-planar-baseline.json](spatial-planar-baseline.json). Full state differences
  ≤3.375e-13, propellant≤4.441e-16; exact zero-z/vz and discrete event/resource parity.
  [Parity report](spatial-parity-report.json). This baseline was captured before changing
  the engine; it is immutable and must not be regenerated with v2.
- `npx tsx scripts/model-set-fixtures.ts --check` validates current authoring without
  overwriting retained v1 fixture files. `npm run evidence:model-set` refreshes the
  independent four-vessel resource replay for canonical6-state outputs.
- Python Ruff format/lint/ty pre-commit checks cover the new oracle in spikes/numerics.

## Labels and boundaries

Each object retains its initial label anchor through playback, reverse scrubbing,
frame changes and pan/zoom. Selected labels take priority, followed by hovered labels;
visibility changes after150ms blocked/260ms clear dwell and fades over140ms. Scene changes
reset anchor memory. This removes per-frame relocation; brief overlaps during fades
are possible. These are presentation clocks, never simulation steps. Human readability
judgment remains open.

The viewer still projects3D into XY and does not imply spatial proximity from overlap.
There are no arbitrary-axis views, depth camera, general spatial targeter, target burns,
maintained station trajectories or runtime fleet scheduling. Existing finite scenes
retain their original orbital/logistics scope. Lunar freight is a separately gated
experiment, not established by this foundation evidence.
