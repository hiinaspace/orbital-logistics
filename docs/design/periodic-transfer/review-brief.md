# Astra review brief — periodic transfer programming, 2026-10-07

Read `proposal.md` in this directory first. User explicitly requests Astra review
before more implementation. Solo experienced SWE (Linux/backend/data/graphics),
less direct experience orbital mission design/repeating missions. Product goal:
Zachtronics-like physical logistics machines worth watching, CoaDE spatial editor
plus horizontal ship timelines, finite resource/cadence choices. Review design,
not a request to implement a new simulator or language.

## Evidence / environment

| Fact | Verification / path |
| --- | --- |
| Current checkpoint `617fdc2`, `codex/m4-puzzles`; browser TS/Canvas/Vite | [verified: git HEAD and package.json] |
| User accepts M1/M2/M3a and current M4a largely works; departure/docking UX clunky | [verified: current user message; not an independent usability study] |
| One tug, two circular kinematic ports, finite resources, impulse-only | [verified: src/sim/schema.ts, src/sim/dynamics.ts, src/sim/logistics.ts] |
| Full immutable validated bundle, canonical RK4/event boundaries, same event/physics implementation | [verified: src/sim/runner.ts; event order completion → undock → burn → dock → transfer-start] |
| Dock rejects miss and charges bounded residual velocity; transfers atomic at completion | [verified: runner.ts; tests/sim/logistics.test.ts] |
| Local helper fixed departure/arrival, paid arrival, CCW <1 revolution, clearance/work/component bounds, h/h2 gate | [verified: src/planning/rendezvous.ts; docs/evidence/m2.md and m4.md] |
| Burn.assist static provenance; no route commands/runtime resolver; snapshots replay v1 bundles | [verified: schema.ts, runner.ts, docs/route-intent.md] |
| Duration capped64, maxNodes65536; no unbounded service loop | [verified: schema.ts; runner retained nodes] |
| Two explicit voyages at2S complete0.4cargo by51.3345, grossfuel.264619; immediate-repeat miss1.90 | [verified: npx tsx scripts/periodic-study.ts; schedule-study.json] |
| Same study h/h2 finalfuel difference8.46e-13; varied query partitions exact | [verified: script asserts; no new independent oracle] |
| Real campaign interest / torchship expression / two-ship feasibility | [unknown: not playtested/implemented] |

Primary research URLs and limited summaries are in the proposal. You may verify
load-bearing source claims with web/read tools, but avoid a broad unrelated survey.
Existing calibration and archived M0–M4 evidence need no full re-audit unless a
specific architectural recommendation depends on a contradiction. No app changes
this turn; new study script only compiles explicit schedules into unchanged Runner.

## Decisions and leans

1. **What repeats / what scores?** Recipe evaluated against actual phase/resources,
   finite two-load batch first; then bounded throughput. Alternative exact world
   periodic orbit/steady-state solver rejected as prerequisite: not necessary for
   reuse and finite stocks can't sustain forever. Is finite batch too weak to test
   periodic programming? Specify smallest honest sustained/cadence contract if so.
2. **Authoring abstraction / assistance boundary:** port service + full transfer
   blocks, player chooses itinerary/window/duration/family, helper fits numeric
   burns. Alternative only event-relative manual burns + terminal match preserves
   editor authorship but may fail position and perpetuate bookkeeping. Alternative
   automatic best-path itinerary optimizer rejected: removes core choices. Does
   the proposed local solver still do too much or not enough? This and #3 overlap.
3. **Departure phase / timeline:** unwrapped actual occurrences, shared opportunity
   origin, hard default miss, explicit bounded next-opportunity policy later.
   Alternative repeat fixed timestamps/chosen cycle period often drifts from
   geometry; free anytime departure with runtime leastfuel scan silently plans.
   How should the player combine cadence and state readiness without giant DSL?
4. **Opportunity/cost view:** selected-leg departure×duration survey, totalpaidfuel
   atactualcargo, Δv optional; noC3only. Small survey first, unresolved ≠ infeasible.
   Alternative only numerical controls cheap but obscures important time choices.
   Are costcurves/windows better first than2D porkchop? Howavoid solverfailuremaps?
5. **Propulsion regime:** generous impulses for reuse gate, then separate finite
   thrust samepuzzle comparison (constantF+mflow, notfakeconstantaccel). No chemical
   realism requirement. Alternative commit torch now could remove orbital identity
   or require expensive targeter redesign; permanentlylowΔv risks narrowfamilies.
   User explicitly interested torch; challenge delaying meaningful propulsiontest.
6. **Runtime seam/order of slices:** full explicitlytimed docktodock intent from
   actual prefix first, then two voyages/timeline, then2ships sharedresource. Older
   route-intent.md tentatively says terminalvelocitymatch first: proposal deliberately
   changes that. Immutable runner/snapshot/canonicalscheduler need deliberate extension;
   cannotmutatesavedburncache. Prioritize real technical risk over inventedplatform.

Author interpretations to push on: grouping transfers solves dock UX; a bounded
local helper leaves enough expression; propulsion can be evaluated independently
of periodic program semantics. None are established playtest facts. Feel free
to merge/reorder/kill decisions. Separate genuine human taste choices from things
we can engineer/verify. Give concrete failure examples and a minimal next spec.

## Depth budget

Prioritized critique, then deep-spec whichever fork you rank highest. Focus on
player model and minimum implementation experiment; technical scheduler details
only enough to prevent wrong abstraction. No general DSL, global optimizer,
campaign, fleet simulator, manufacturing, thermals, power grid, procedural content,
3D/VR, or enterprise architecture. Don't spend the review rediscovering the whole
repo or rerunning all browser/numerical evidence. No further agents/reviewer calls.
