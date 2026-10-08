# Bounded propulsion — 2026-10-08

Implemented after the user accepted the finite-thrust/analog-speed proposal and
explicitly requested Astra senior review. [Brief](brief.md),
[review](astra-review.md), [transport](astra-transport.json) and
[disposition](disposition.md) preserve the decision flow. Actual reviewer:
gpt-6-astra/xhigh, CLI0.153.4, exit0, session01a11c6d-c32b-7573-b479-0455410f68b2.
The reviewer verified the baseline and criticized the proposal before implementation;
it did not review the final diff. The implementation owner spot-checked its claims.

## Runtime contract

Canonical scenario/program/snapshot v3, `rk4-canonical-v3`. Old propulsion-free
v1/v2 scenarios/programs explicitly convert; original fixture JSON remains intact.
Legacy snapshots require replay from their scenario/program. Propulsion fields in
legacy data are rejected before conversion. Historical aiming tools reject powered
programs; prediction/apsis diagnostics use the same interval propagator as execution.

An engine supplies maximum force and optional maximum propulsive acceleration;
exhaust velocity remains a ship property. Each arc has fixed inertial unit direction,
constant throttle in[0,1], start and end. At mass m, force is
`min(throttle*maxThrust,maxAcceleration*m)`, and fuel flow is `-force/exhaustVelocity`.
Cargo and dry mass count toward acceleration but cannot be consumed.

Kinematic State6 remains unchanged. Each active arc owns an immutable mass anchor:
linear decay under constant force, exponential decay after an acceleration cap.
Every RK4 stage evaluates that anchored law, including the preceding interval's
endpoint mode. Start, end, cap transition and fuel depletion split canonical steps.
Disposable samples never become restart checkpoints. There is one powered/coasting
propagator for prediction, execution and event refinement.

At a shared epoch: end thrust, complete service, undock, impulse, dock, start service,
start thrust. Nonzero explicit impulses inside or touching an arc, overlapping arcs,
and operations strictly inside arcs reject. Attached/servicing thrust rejects at
runtime. Early depletion stops at zero fuel; exact-end exhaustion closes the arc,
then subsequent events still require their own fuel. Interrupted arcs retain flown
state and fuel usage. Cumulative usage includes partial arcs; closing a ledger entry
does not charge fuel again.

The surface-exclusion certificate adds a conservative propulsion acceleration bound
`norm(direction)*min(commandForce/nonfuelMass,maxAcceleration)` to its gravity bound.
It certifies continuous motion and RK stages; subdivision/work exhaustion preserves
a safe paid prefix. This is separate from integration-accuracy evidence.

## Authored sets

- Orison · powered transfer: force1 Kestrel, four finite arcs, one delivery and return.
- Selene · powered freight: force2 Wren and force4 Lark follow the same departure,
  arrival and service times between Nightfall and Selene Hub, each delivering0.16.
  Four arcs per vessel, finite-stock refueling, paid negligible capture residuals.

Both contain no authored impulses. The original impulsive sets remain available.
These are fictional normalized systems, not calibrated engines or actual missions.
Heading is fixed during each arc; there is no attitude simulation or runtime guidance.
The cap is validated by an independent inclined calibration, not enabled in these sets.

[Experiment](experiment.md) records the fixed-time two-heading/two-duration family.
[input.json](input.json) was extracted from HEAD8394ad0 with the then-v2 engine before
implementation. [search-report.json](search-report.json) retains all24 bounded force/leg
attempts and accepted solutions. A rerun produced identical per-attempt stdout.
Kestrel passes all forces8/4/2/1; Wren passes both legs8/4/2; Ibis's return only passes8
with little reserve. Failed lower-force searches are failures in this restricted family,
not physical impossibility. No alternate-time grid was needed for the admitted Wren set.

## Reproduce

```sh
uv run --project spikes/numerics python spikes/numerics/propulsion_search.py
node --import tsx scripts/propulsion-fixtures.ts
npm run evidence:propulsion
npm run build
npm run test:sim
PLAYWRIGHT_PREVIEW=1 npm run test:browser
uv run --project spikes/numerics --group dev --group plots pre-commit run --config spikes/numerics/.pre-commit-config.yaml --all-files
```

The saved authoring input is immutable. `scripts/propulsion-input.ts --output <new-path>`
extracts a new study input using the current engine and refuses existing output files.
Do not overwrite the v2 evidence when conducting a later study.

[Validation](../../evidence/bounded-propulsion.md) covers independent seven-state
DOP853, unchanged-program timestep refinement, pre-attachment residuals, complete
resources/returns, powered safety/failure/replay and production browser checks.
Continuous operations, launches, general steering/optimization and the 3D camera
remain separate work. Next gate: whether finite burn durations/choreography feel good
while watching, followed by choosing continuous prepared service or a 3D viewer.
