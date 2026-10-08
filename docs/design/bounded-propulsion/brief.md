# Bounded propulsion senior-review brief — 2026-10-08

User explicitly approved finite-thrust transfers, analog viewing speed, and Astra
senior review before implementation. Solo hobby prototype; keep the slice bounded.

## Verified environment and evidence

| Fact | Verification / path |
| --- | --- |
| Clean checkout before this brief, branch codex/model-set-viewer, HEAD8394ad0 | git status/rev; /home/s/code/orbital-logistics |
| TypeScript pure simulation; Canvas2D + DOM; worker prepares finite sets | src/sim/, src/main.ts, src/model-set/ |
| Canonical six-state [x,y,z,vx,vy,vz], schema/modelv2 with v1 wire conversion | src/sim/schema.ts, vectors.ts |
| Fuel is currently discrete; RK4 propagates only six kinematic components | src/sim/dynamics.ts, runner.ts |
| Grid/event endpoints authoritative; off-grid sample propagates disposable state | Runner.#ensure/#coast/sample/coastSegments |
| Current event ordering: service completion, undock, impulse, dock, transfer start | Runner.#performEvents |
| Capture snaps position within tolerance and charges tiny velocity residual | runner.ts:operate; capture tolerances1e-5 in lunar set |
| Ballistic port targets use dedicated burn-free canonical Runners, complete finite validity and enlarged-surface certification | runner.ts constructor/portState; schema.ts |
| Current coast safety certificate bounds gravitational acceleration only | dynamics.ts:certifiedCoast |
| Historical XY solvers assume impulses; preserve but guard unsupported powered inputs | src/planning/domain.ts, rendezvous.ts |
| Worker emits dense disposable view samples with exact ledger events; interpolation preserves event-left endpoints | src/model-set/model.ts |
| Ship samples fuel/cargo are currently piecewise constant between display samples | model.ts:sampleVessel |
| Ibis final return impulse1.13506 vs departure0.46280 | fixtures/model-sets/selene-freight.json |
| Existing speeds .25/1/4/16, finite Replay rewinds state | src/main.ts |
| Existing83 sim +7 browser checks; spatial/lunar independent DOP853 evidence | docs/evidence/spatial-foundation.md, lunar-freight.md |
| Python uv project with SciPy, Ruff/ty hooks | spikes/numerics/pyproject.toml and .pre-commit-config.yaml |
| Actual model checks must come from CLI transport | codex0.153.4; prior spatial review metadata |

Current accepted direction: watching prepared traffic is sufficient. User accepts
stable labels/lunar set, asks bounded propulsion next. Continuous operations,
3D camera, ground launch, atmosphere, attitude dynamics and a general scheduler
are explicitly outside this slice. No further research/product review needed.

## Mostly-worked proposal (opinions, not implemented)

1. Add optional engine limits (maximum thrust, optional acceleration cap) and
   optional nonoverlapping finite thrust arcs to existing spatial bundles. Arc:
   id,start,end,unit inertial direction, constant throttle in[0,1]. Keep impulses
   for original content; powered demonstration programs have no substantial impulses.
   Lean keep kinematic State6 and store fuel alongside it, but change model/snapshot
   version or explicit powered model discriminator so old data cannot acquire silent
   semantics. Need recommendation on minimal compatible versioning.
2. Integrate gravity+F/m direction and fuel consumption F/ve consistently. Constant
   force until acceleration cap then throttled force; no attitude/body-axis steering
   yet. Either augmented RK4 state7 or exact scalar mass evolution used by every RK4
   stage. Lean exact mass evolution for piecewise constant thrust and cap, with
   explicit cap transition/depletion boundaries if needed; evaluate rigorously.
   Stop deterministically at depletion, preserve flown prefix, no negative fuel or
   successful-looking required continuation. Work limits remain bounded.
3. Start/end/depletion split canonical intervals independent of view requests. At
   shared epoch end powered arc before service/undock, then existing impulse/capture
   order; start powered arc after undock and before any coast. Forbid substantive
   impulse coincident with or inside powered arc, overlapping arcs, thrust while
   docked or servicing. Do not silently turn thrust off on an incompatible operation.
   Ledger records start/end/failed/depletion plus integrated fuel/propulsive delta-v;
   partial samples must report continuously varying fuel and cumulative fuel use.
   Snapshots/reload and coast diagnostics must use same powered propagator.
4. Safety: extend half-clearance acceleration bound by maximum possible thrust
   acceleration over the whole interval, using dry+cargo lower mass (or cap). Every
   RK stage and off-grid propagation remain subject to canonical safety subdivision.
   Capture retains existing tiny charged residual interface; tighten powered witness
   numerical gates to make residual negligible and independently expose pre-snap
   position/velocity. No final impulse can rescue failed finite-thrust targeting.
5. First verification: constant inertial zero-gravity analytic rocket motion (if
   current positive mu schema requires synthetic tiny mu, prefer pure propagator
   unit test instead of widening all scenarios); mass/cap transition/depletion;
   inclined directions; event order, partition/query invariance, reload, negative
   dock/fuel cases; independent DOP853 and h/h2/h4 for moving gravity/targets.
6. Offline bounded route authoring: two powered segments (departure and braking)
   with constant headings, coast between. In planar domain, two headings and two
   durations solve four terminal state constraints at selected departure/arrival.
   Impulsive programs seed high-thrust solutions; continuation lowers thrust.
   Bound iteration/evaluation count, headings/durations, clearance, fuel and epochs;
   allow a small declared grid of alternate arrival/wait times. Begin one fixed-primary
   route, then one complete lunar voyage with finite-stock service/return if feasible.
   Compare two engine strengths if both valid; don't require every lunar route to
   solve, don't infer infeasibility from restricted-family failure. Retain rejects.
7. UI: powered path/timeline spans, subtle thrust indication on ships, continuously
   changing fuel, inspector thrust/acceleration while selected; provenance in About.
   Analog logarithmic speed .05–16x with readable rate; pause separate. No new editor.

## Open decisions / review priorities

- State/mass integration and canonical semantics overlap: merge these decisions if
  appropriate. What is the smallest sound primitive that does not overbuild guidance?
- Exact mass analytic stage evolution vs augmented RK4, including cap and depletion.
- Schema/snapshot compatibility: optional extension vs explicit modelv3.
- Is two fixed-heading segments a practical first target family for finite lunar
  rendezvous? What bounded fallback preserves the approved acceptance objective?
- Does the proposed safety bound actually certify the powered stages/continuous arc?
- Which capture/failure/partial ledger semantics must be fixed before content work?

Verify load-bearing source claims first, label [verified: how]/[unverified]/[unknown].
Rank findings by leverage, and deep-spec whichever decision YOUR ranking identifies
as most important. Identify real human decisions separately from choices we can make.
Depth budget: focused architecture review, ~10–15 minutes, no recursive delegation,
no implementation or repository writes, no changes to running preview. Do not review
old game design, suggest a full optimizer, or expand to ground/3D/indefinite worlds.
Deliver a concise prioritized review and concrete acceptance gates.
