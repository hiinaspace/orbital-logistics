# Numerical feasibility spike — 2026-10-06

This is a bounded numerical experiment, not an implemented M0/M1 game. It checks a simple TypeScript integrator against analytic orbits and a separate Python/SciPy implementation, retains a useful planet–moon encounter, and identifies contracts the production core must preserve. Source and machine-readable outputs are in `spikes/numerics/`.

## Recommendation

Start the M0 implementation with a DOM-free TypeScript core, normalized units, and classical fixed-grid RK4 on this one short encounter. Keep Python/SciPy as an offline oracle and potential level-authoring tool. This spike found no numerical reason to move the initial game to Python, port a large astrodynamics library, or introduce WASM. It does not settle editor usability or targeting feasibility.

Use `h = 1/512` and horizon `6` as a conservative starting fixture configuration, not a universal accuracy setting. There are only about 3,074 nodes including one off-grid burn. Benchmark and validate the actual browser core before committing to a worker or any broader performance promise. RK4 is deliberately the simplest initial choice; long-horizon drift, extreme encounters, or finite thrust may justify an embedded adaptive scheme later. Changing integrators must preserve the same physical/event contract.

## Model and retained fixture

Units: binary separation `1`, `G(Mplanet+Mmoon)=1`, angular rate `1`, binary period `2π`. The prescribed circular binary has masses/GM `0.98` and `0.02`, orbit radii `0.02` and `0.98`, and a barycenter at the inertial origin. Planet radius `0.08`; moon radius `0.025`. Both bodies move; the ship is massless and feels both inverse-square fields without force softening. These are stylized design parameters, not real Earth–Moon data.

The fixture was constructed backward from a selected relative periapsis candidate at `t=2.5`, moon distance `0.12`, and relative speed `0.6`. Its initial inertial state `[x,y,vx,vy]` is:

```json
[1.831588135066403, 1.1554226967793058, -0.8584162086330673, 0.2617205685421131]
```

An off-grid inertial impulse at `t=1.137` adds velocity `[0.015,-0.010]`, magnitude `0.01802775638`. The baseline and edited trajectories are numerically noncolliding over `[0,6]` with large clearance margins. Dense TS sampling and independent DOP853 evaluation support that statement; there is no general collision certifier in this spike.

| Measurement | Baseline | Edited |
|---|---:|---:|
| Refined closest moon distance | 0.1200000000001 | 0.0928733545676 |
| Refined closest moon epoch | 2.5000000000005 | 2.5064736289318 |
| Minimum planet center distance, dense TS samples | 1.1200000000 | 1.0604690542 |
| Maximum TS vs tightened oracle position error on 601 samples, `h=1/512` | 2.47e-10 | 2.37e-9 |

The small burn changes endpoint position by `1.44451446` separation units at `t=6`, enough to give a visible before/after arc. The edited near-moon pass stays about `0.06787` above the nominal moon surface. This is a hand-selected numerical fixture, not a player-authored solution or evidence of a fun puzzle. No docking, cargo, optimizer, fuel model, or burn-handle semantics are implemented.

`encounter-samples.json` retains 601 samples per branch, ship/body states at each sample epoch, the burn, and construction provenance. It can drive a read-only diagnostic viewer without duplicating the simulation.

## Calibration and independent check

The TypeScript checks use independent closed-form circular motion and Newton-solved elliptic/hyperbolic Kepler equations. Cases: circular orbit, ellipse `a=1,e=0.6` starting at periapsis, and escape hyperbola `|a|=1,e=1.5` starting at periapsis. The elliptic runs span one full period, the hyperbolic run `4` time units. The hyperbolic case covers periapsis-to-outbound coast; it is not a complete inbound/outbound deflection test. The combined endpoint state errors at `h=1/1024` were `1.74e-13`, `3.77e-10`, and `1.08e-11` respectively. Halving step generally reduces the non-roundoff-dominated errors by approximately sixteen, as expected for RK4.

Two-body specific energy and angular momentum drifts are measured only where those quantities should be conserved. In the unburned circular planet–moon field, the Jacobi constant is the appropriate diagnostic: maximum drift fell from `3.53e-9` at `h=1/128` to `1.42e-11` at `h=1/512` and `8.91e-13` at `h=1/1024`. Ordinary inertial ship energy/angular momentum need not be constant in the moving binary field. A burn changes the Jacobi constant; this report does not test conservation across it.

The offline oracle independently implements the barycentric ephemerides and acceleration in NumPy and uses SciPy DOP853. It integrates separately before and after the exact burn epoch. The main oracle uses `rtol=1e-12, atol=1e-14, max_step=0.05`; a tightened run uses `3e-14,1e-15,0.01`. Their maximum combined state differences on 601 samples were `3.42e-12` baseline and `9.88e-12` edited. These are numerical consistency checks, not certified error bounds or independent validation of the chosen physical approximation. [SciPy documents DOP853 and recommends it for high-precision nonstiff solves.](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html)

| RK4 step | Baseline endpoint state error vs tightened DOP853 | Edited endpoint state error |
|---|---:|---:|
| 1/128 | 7.12e-8 | 7.75e-7 |
| 1/256 | 4.33e-9 | 4.65e-8 |
| 1/512 | 2.67e-10 | 2.84e-9 |
| 1/1024 | 1.62e-11 | 1.75e-10 |

## Time queries and event semantics: first architectural trap

An integrator that advances its authoritative state whenever rendering/scrubbing requests a new time changes its numerical partition according to UI request order. In an eccentric-orbit demonstration with `h=1/32`, direct propagation and ten irregular sequential request splits gave a combined endpoint difference of `2.05070136e-5` at `t=6`. The naive runner takes full `h` steps from its latest requested endpoint and shortens the final step of each request; the next request resumes there. Neither result establishes a physical change; the arithmetic partition changed.

The spike instead creates canonical nodes at absolute grid epochs `k*h`, with exact impulse epochs inserted. A query uses the preceding node and a temporary partial RK4 step; queries never change stored nodes. Querying the same irregular epochs leaves the final state unchanged exactly. Queries outside the stored horizon are rejected. This checks immutable stored-node queries, not a completed mutable playback/advance implementation. The terminal partial node belongs to its fixed horizon: a future extension must discard that terminal partial node and resume from the preceding canonical grid/event node. Do not turn a requested viewport endpoint into an authoritative permanent integration split.

The off-grid impulse check observes its epoch exactly, adds Δv once, and exposes a post-burn state at the burn epoch. Velocity-jump residual with the same coast partition is `1.64e-17`. A production event contract must additionally define stable event ordering, simultaneous events, checkpoint/cursor state, and pre/post-event query side. This spike does not implement resumable queues, clock ticks, save/replay, cancellation, or edit invalidation. The same canonical propagation contract must drive prediction and execution; time warp should change display scheduling rather than physical step size.

## Apsis and collision limitations

Relative apsis candidates solve `(rship-rbody)·(vship-vbody)=0`; negative-to-positive on a smooth coast brackets periapsis. For the eccentric analytic case, the apoapsis bracket surrounds `π`. The edited moon periapsis bracket is `[2.505859375,2.5078125]`. A refined root/event query is needed for a useful snap.

A circular orbit has radial product zero everywhere. The numerical circular test had magnitude at most `2.29e-13`, yet a raw sign-change detector invented a periapsis near `t=3.153`. Require a degeneracy/conditioning check and label a circular/near-circular apsis undefined or nonunique. A burn can discontinuously change the radial product without creating a smooth apsis. Repeated encounters need an identity including named body, event kind, and a local time/branch bracket; selecting the first/second event by ordinal alone can silently switch branches after edits. If the selected bracket loses the event, show that explicitly. This spike retains brackets, not a production event locator.

Endpoint-only collision tests can tunnel: the retained synthetic segment has endpoints `[-0.1,0]` and `[0.1,0]` outside a radius `0.025` body, while its midpoint is inside. Moving bodies and curved trajectories make a simple linear segment intersection insufficient for a guarantee. M0 needs continuous separation event localization plus step/refinement limits around close encounters, and must stop before any unphysical singular evaluation. [SciPy also warns that sign-change event detection can miss multiple crossings inside one step.](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html) There is no adaptive encounter refinement, surface stop, escape cutoff, failure-state handling, or collision ledger here. The good clearances in this one fixture do not validate a general collision policy.

## Timings and environment

Measured on `natto`, Linux x64, AMD Ryzen 7 7840U, Node `v22.22.1`. Each candidate gets one warmup and seven measured runs; medians below are one ship, two moving bodies, one burn. RK4 currently allocates many arrays and stores every canonical node. Times include propagation/node creation, but exclude JSON, plotting, browsers, rendering, workers, message transfer, targeting iterations, and garbage-collection controls. Longer horizons are throughput measurements only; their physical/collision accuracy was not validated.

| Horizon | h=1/256 | h=1/512 | h=1/1024 |
|---|---:|---:|---:|
| 6 | 6.50 ms | 11.88 ms | 25.03 ms |
| 20 | 21.16 ms | 42.43 ms | 87.60 ms |
| 60 | 64.99 ms | 131.30 ms | 236.59 ms |

Full min/max values and environment are retained in `report.json`; measurements vary under host load/JIT/GC. These do not establish browser latency or responsiveness. They suggest a short one-encounter prediction is cheap enough to pursue without a different language, while broad repeated targeting jobs need work limits and actual browser profiling.

## Reproduction and checks

From `/home/s/code/orbital-logistics`:

```bash
npm ci
npm exec tsx spikes/numerics/run.ts
uv sync --project spikes/numerics --locked
uv run --project spikes/numerics python spikes/numerics/oracle.py
uv run --project spikes/numerics ruff format --check spikes/numerics/oracle.py
uv run --project spikes/numerics ruff check spikes/numerics/oracle.py
uv run --project spikes/numerics ty check spikes/numerics/oracle.py
npm exec tsc -- --ignoreConfig --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --allowImportingTsExtensions --skipLibCheck spikes/numerics/model.ts
uv run --project spikes/numerics pre-commit install --config spikes/numerics/.pre-commit-config.yaml
uv run --project spikes/numerics pre-commit run --config spikes/numerics/.pre-commit-config.yaml --files spikes/numerics/oracle.py
```

The TS runner throws on a colliding sampled fixture, failed fine-step analytic calibration, changed canonical query endpoint, or incorrect impulse jump. Python asserts the TS/oracle position errors, oracle refinement difference, and sampled fixture clearances. Ruff formatting/lint and ty passed using Python `3.13.13`, SciPy `1.18.1`, NumPy `2.5.3`, Ruff `0.16.10`, ty `0.0.85`; exact dependencies are in the isolated `uv.lock`. A local pre-commit config supplies Ruff format/lint and ty hooks, installed into the root Git hook. An explicit run against `spikes/numerics/oracle.py` executed and passed all three hooks. The script itself is executed via tsx; only the DOM-free `model.ts` receives a standalone strict TypeScript check here. Root browser/app checks are reported separately.

Retained artifacts: `model.ts`, `run.ts`, `oracle.py`, isolated Python project/lock/hooks, `report.json`, `oracle-input.json`, `oracle-report.json`, and `encounter-samples.json`. Re-running intentionally replaces these small evidence snapshots; they are not immutable scientific archives.

## Next evidence gates

1. Promote a small, tested propagation/event contract into the actual core; preserve canonical epochs and exact impulse side/order. Add production collision localization and deterministic checkpoint/replay tests before trusting user-edited encounters.
2. Implement one named-body apsis query with degeneracy handling and preserved branch bracket, using this fixture. Add body-centered transforms at each sample epoch; frame changes must not alter inertial states.
3. Measure stale-prediction handling and edit latency in the actual browser, then decide whether to move prediction into a worker. Retain manual before/after evidence separately from this constructed fixture.
4. Later, spike bounded rendezvous shooting against the same forward core and one fixed branch. This spike says nothing about optimizer conditioning, solvability, or whether player targeting is satisfying.
