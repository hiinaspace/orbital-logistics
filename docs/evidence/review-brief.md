# Astra senior design review brief — 2026-10-06

## Goal and scope

User explicitly requested initial tactical planning for orbital-logistics, an
Astra senior review, sol/luna subagents as useful, local repo initialization and
bounded toolchain/technical spikes. Browser-first is a preference, not immutable;
Python/native is allowed if it actually accelerates the greybox. Solo experienced
engineer, strong Linux/backend/graphics/ETL, less established orbital numerics and
game/interaction design priors. Right-size; no enterprise ceremony.

Read docs/plan.md (main decision artifact), docs/charter.md (captured product
intent), docs/evidence/environment.md, docs/evidence/ecosystems.md. Numerics are
being finalized concurrently under spikes/numerics; inspect existing model.ts,
run.ts, report.json and docs/evidence/numerics.md if present. Treat absent/not-yet
reported checks as unverified, not failures. Do not wait for or modify agents.

## Verified facts versus interpretation

| Fact | Evidence/status |
| --- | --- |
| Host natto, Ryzen 7 7840U, Node 22.22.1/npm 11.4.2/uv 0.11.7 | [verified: shell versions and numerical report] |
| Repo /home/s/code/orbital-logistics, branch codex/initial-planning, new no commits/remote | [verified: git init/status] |
| Vite 8.3.3, TypeScript 7.0.2, tsx 4.23.15, Playwright 1.63.0 exactly locked | [verified: package.json/lock] |
| Installed Chrome 154.0.8037.97 works with Playwright | [verified: test:browser passed shell Canvas and module worker test] |
| Production build passes after adding vite/client declarations | [verified: npm run build] |
| No completed M0/M1 editor, physics runtime, targeter, logistics or deployment | [verified: src is a tiny smoke shell, spikes not production] |
| Physics model is inertial summed inverse-square prescribed barycentric rails | [verified: charter and spike model.ts; taste choice not physical universe] |
| TS short-horizon RK4 fixture timings ~13ms at h=1/512, horizon=6 on Node | [verified: provisional report.json; not input-to-paint/browser latency] |
| Small impulse changes noncolliding sample closest moon distance ~0.12 to 0.093 | [verified: provisional report.json; sampled not root-refined events] |
| Independent oracle agreement and full safety checks | [unverified: oracle work currently underway; inspect artifacts for current status] |
| A prepared encounter is better first interaction than blank sandbox | [interpretation; user question pending] |
| Keeping TS runtime and Python offline is lower risk than Python UI + port | [interpretation; official-doc survey, not comprehensive ecosystem benchmark] |
| Fixed-step RK4 is enough for M1's bounded fixture | [hypothesis, supported by convergence but not arbitrary flybys] |

User questions sent: prepared moon pass vs gentle orbit-editing lesson vs delivery;
visual-first vs technical readouts; charter changes / CoaDE frustrations. No answer
at brief creation. Provisional defaults: prepared pass, visual-first with precision
on demand. They remain explicit assumptions, not authorization to change core.

## Decisions to critique (re-rank by your judgment)

1. Build order: M0 canonical calibrated runner then prepared encounter, one burn,
   frames/inspector then full queue/apsis/replay; stop for manual human gate.
   Lean this way; reject full logistics vertical slice first because editor opacity
   could dominate and hide which hypothesis failed. Is this over-isolated from
   what makes the logistics game interesting? How small can a meaningful objective be?
2. Runtime stack TS/Canvas/DOM/Vite, Python/SciPy reference only. Alternative
   Python desktop/Pyodide/REBOUND/PyKEP; considered but likely no shortcut to
   authoring/event semantics. Is there a genuine domain-library advantage missed?
3. Canonical numerical/event contract. Grid + explicit burn splits independent
   of readout epochs. Snapshot/forward seek. Snap resolves epoch with selected
   occurrence provenance, not a dynamic event program yet. Burn body-relative
   radial/positive-CCW transverse, resolved from pre-burn state at execution.
   Reject rendering-frame basis and silent apsis retarget. What is under-specified
   or needlessly complicated? Point out if canonical final-horizon semantics fail.
4. Workers only once measured necessary; versioned predictions and actual
   cancellation; start small horizon before caching/WASM. Alternatives: worker
   immediately or coarse approximate preview. Is single-thread-first distracting?
5. M2 local fixed departure/arrival shooting on two burn components + charged
   matching impulse, visible branch limits; M3 one-tug round trip then second ship
   dependency. Is branch control feasible as described? What concrete narrower
   fixture or failure contract makes it practical?
6. Numerical thresholds tie independent/converged position error both to chosen
   encounter resolution and intended pixel scale, later capture tolerance. Unknown
   current values; don't mistake aspirational threshold for results.

Possible overlap: temporal event identity, basis provenance, UI stale/draft state,
and replay could be one contract rather than several isolated architecture tasks.
M1 interaction acceptance should get more attention than generic module design.

## Requested output and depth budget

Verify first, label load-bearing findings verified/unverified. Give prioritized
critique, choose your own highest-leverage issue for one concrete deep spec.
Separate true human taste choices from decisions the implementation owner should
make. Include minimal tactical next assignment and a short recommendation table
suitable for disposition. Aim for ~1500–2500 words maximum, less if clear.

Not-list: no exhaustive orbital mechanics/library survey, full campaign/economy,
3D/VR, deployment, generic architecture scaffolding or additional model reviews.
Do not implement anything. The main agent will spot-check and synthesize.

## User clarification received after reviewer launch

User explicitly prefers mirroring the CoaDE astrogation tutorial first, visual-first
with precision on demand, charter solid, synchronization later. Local Steam install
found; a read-only resource study is underway. docs/plan.md now reflects this. Any
review recommendation about opening with a prepared moon encounter must be
synthesized against this superseding user choice.
