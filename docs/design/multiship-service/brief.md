# Three-station maintained freight exhibit: verified brief

User authorization2026-10-09: implement the small multiship orbital exhibit;
the earlier kinematic fleet was already pleasant at1×. Continue Astra reviews.
Solo prototype; aim for a useful operating exhibit, bounded implementation and
smooth1× rather than general logistics optimization. Do not add more perturbers,
atmosphere, staging, persistence or arbitrary spatial transfers in this slice.

## Verified environment and baseline

| Fact | Evidence |
|---|---|
| Repo/host | `/home/s/code/orbital-logistics`, natto/Ryzen7 7840U; branch `codex/model-set-viewer`, HEAD e44f76b; no remote. Only unrelated prior untracked reports/research notes. |
| Viewer | Existing4178 production preview; TypeScript/Canvas/inline module workers, Chrome154.0.8037.97. |
| Physics | Prescribed fixed Orison(mu1,radius1) + circular Mote(mu.004,radius.12,R6), canonical RK4 h1/256, six-state and force/mass/cap/depletion. DOM/wall-clock independent. |
| Current service | `src/adaptive/{world,planner,plan,engine,view}.ts`: one ballistic originR2, one maintained phase-free relayR3, one visitor with passive docked mass and donor-funded station fuel. Coupled-service-v1 freezes finite out/back legs, owner controls and derived transfers together. |
| Planning | Each opportunity solves an80-unit unloaded guide, ranks near-Hohmann schedules, tries≤4 coupled candidates. Force sensitivities replace probes where eligible; every candidate still canonical and paid. |
| Work evidence | Through512, same7 schedules,8876→3000 numerical sweeps. Independent original-anchor22-state DOP853 through528 validates14 captures. See `docs/design/sensitivity-planning/{timing-512,oracle}.json`. |
| Playback |32-unit committed lead,128 total retained history.4× sustained512 without buffer exhaustion in headless Chrome, but human observed some hitches. Treat1× as target for this next set. |
| Historical contracts | Existing AdaptiveEngine is single-visitor and validated narrowly. TrafficEngine owns shared stock transactions for kinematic fleets; it cannot target maintained rails. Do not disguise independent stock balances as one depot. |
| Validation/runtime | npm build/typecheck, `npm run test:sim`, `PLAYWRIGHT_PREVIEW=1 npx playwright test`; one owned4179 test service. UV numerics with Ruff-format/lint/ty hooks. Preview4178 retained; bounded durable evidence in this folder. |

All facts above verified by source/current artifacts this turn. Sources to audit:
`src/adaptive/engine.ts`, `src/adaptive/plan.ts`, `src/adaptive/world.ts`,
`src/traffic/resources.ts`, `src/traffic/engine.ts`,
`src/model-set/model.ts`, `src/main.ts` and `AGENTS.md`.

## Proposed concrete slice

Three stations: a shared ballistic Equator hub with2 berths and one actual fuel
stock/import stream, plus maintained Meridian and a phase-offset maintained relay,
each with one visiting berth. Two finite-propulsion freighters initially leave the
hub. Each serves its assigned relay and returns/refuels at the common hub; the
second relay is propagated in the SAME Mote field, not a rotated copy of the
gravity source. This first topology avoids simultaneous visitors at a maintained
station while adding real concurrent journeys, two maintained tanks, common
stocks, docked mass and station refueling. Fixed assignments are explicit; no claim
of arbitrary route dispatch/queueing between relays. Both travel directions,
station phase drift and overlapping activity should be visible.

Lean: a separate versioned network runtime, not weakening adaptive-relay-v1.
Reuse canonical AdaptiveWorld, sensitivity targeting and frozen CoupledTrip;
extract/share the small per-vessel lifecycle only if review favors it. One global
epoch transaction owns hub resources, vessel completions and actual publication.
At a control epoch, bounded generators prepare station forecasts/route candidates;
publish/commit the epoch only after necessary work is complete. Stable identity
ordering controls same-epoch resource requests. Successful planned journeys
reserve one station berth through their attachment and freeze the required
station controls; the actual trajectory/fuel debit is owned once by that station.
Idle/failure retries are bounded and don't stop independent established journeys
except at a physics-frontier underflow.

Shared-origin forecasts can be cached/reused only for identical canonical model,
anchor, interval and step. Cache entries are physical immutable Runner intervals,
never drawing interpolation; cache lifetime is bounded by the rolling history
and active/speculative horizon. Each maintained relay has its own physical owner;
its loaded forecast is not reusable for different onboard mass/events.

Unmeasured hypotheses: duplication and guide work offer more headroom;2 actors
should be feasible at1× with32 units of lead. There is no measured linear scaling
guarantee. Begin with instrumentation for1/2 service lanes; isolate guide/targeting/
proof/render costs before adopting a different controller policy. Only if needed,
use cheaper forecast ranking or looser orbital maintenance with fresh numerical
and service evidence. Keep exact paid physical admission throughout.

## Open decisions for review

1. **Topology/gate.** Recommend assigned relays + common hub first. Alternative:
both ships compete for both maintained berths immediately. Rejected initially
because replacing already-frozen future station controls introduces revision and
dependency invalidation, obscuring the first scaling witness. Is the proposed
topology a sufficient next slice, and how should reservations be represented?
2. **Runtime reuse.** Recommend one global network transaction plus reusable
world/plan components. Alternative: compose two whole AdaptiveEngines. Rejected
naively because child engines mutate independent hub balances and can commit
different epochs while another child yields. Can a narrow prepare/commit seam
reuse lifecycles safely, or is a small separate orchestrator clearer?
3. **Forecast ownership/cache.** Shared origin is mass-insensitive under our
prescribed gravity, relays are not. Recommend exact-key bounded origin interval
cache and one physical world per relay. Audit what can be shared, especially
forks/candidates and resident-node accounting. Sharing drawings is insufficient.
4. **Resource/berth reservations.** Actual hub refuel must debit one stock in a
single same-epoch transaction, with bounded deterministic shortage wait. Future
arrival reservations should not manufacture fuel or make unrelated ships halt.
Is an episode/refuel reservation necessary, or can arrival attachment precede
resource availability since the hub has2 berths? Source remains ballistic.
5. **Failures and history.** A visitor fault stops its dependent station at
event-left if future maintenance mass/credits are invalid; other lane continues.
The failed ship/station remain last-known markers with explicit validity; do not
invent continued frozen physical coordinates. One shared head and128 history;
32 lead and cap2× provisionally, select supported cap after1×/2× browser evidence.
6. **Bounds/gates.** Provisional aggregate budgets400k transient canonical nodes,
140k retained worker nodes,16MB reply/held view and≤2 active episodes plus bounded
retained episode history. Measure actual usage; account shared runners once AND
private candidate duplication.512 actual-unit conservation/visits/failure tests,
canonical request/yield/scrub invariance, independent original-anchor multi-lane
oracle and Chrome playback/switch/selection/fault checks. What crucial gate is
missing? Avoid an enterprise framework or unbounded search.

Some decisions overlap; merge if it improves the design. Review verify-first,
label verified/unverified/unknown, then recommend a concrete right-sized design.
Budget~10 minutes. Don't re-review camera, atmospheric physics, old editor or
general optimal transport. Do not modify the checkout or spawn extra reviewers.
