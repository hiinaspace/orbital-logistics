# Finite airless staging: senior review brief

Goal: one curated finite in-plane mission on Selene. A stack launches, separates without a kick, courier delivers freight to Lantern, booster lands at Cairn. No atmosphere, turnaround repetition or mixed network yet. User approved this sequencing and requested Astra review.

## Verified environment and seams
|Fact|Evidence|
|Checkout on natto, branch codex/model-set-viewer, HEAD 8707202; source unchanged except unrelated untracked precedents|git status/log inspected|
|Canonical 6D RK4 Runner with finite force/acceleration cap, dry+cargo+fuel mass, fuel depletion, exact event before/after states|src/sim/runner.ts, schema.ts, propulsion.ts inspected|
|Surface departure is atomic supported launch into powered arc; land checks physical clearance and pays velocity residual|runner.ts inspected|
|Finite model set prepares independent Runners sharing port definitions, then checks global stocks/berths by ledger|src/model-set/model.ts inspected|
|Finite worker prepares SceneView; viewer assumes every vessel exists through whole window, frame and sample queries cover it|prepare.worker.ts, main.ts, frames.ts inspected|
|Existing frozen ascent/landing and independent DOP853 scripts provide feasible authorship patterns|docs/design/surface-{ascent,landing}/assemble.ts and *-study.py inspected|
|Node/npm/tsx/Chrome/Playwright work on natto, sayu accesses checkout over SSH; production preview4178 forwarded|commands verified|

## Proposed architecture (claims of feasibility remain unverified)
A narrow explicitly versioned staged-flight-v1 definition and orchestrator outside legacy Bundle schema. Validate finite mission definition strictly. Run stack using existing Runner, stop at separation after thrust ends. Its nonfuel ballast includes payload dry mass plus payload fuel, with freight separately counted; stack engine consumes only booster fuel. At separation exact canonical state creates two new independent Runners, each own dry/cargo/fuel/engine; sum child wet masses equals stack wet mass and common velocity conserves momentum. No geometry offsets or separation impulse. For finite curated exhibit, author burns offline, freeze fixture, execute forward unchanged; no browser optimizer.

Maintain three actor lifetimes: stack [start,split), booster [split,end], courier [split,end]. Retired stack remains timeline/history actor but hidden at current epoch. Child absent before split, rather than a duplicate independently propagated payload. SceneView gets lifetime/presence explicitly; retained selection shows attached/retired status; inactive reference frame falls back safely. Follow selected stack could follow booster at separation, provided replay reverses lineage deterministically. Current lean keep selection explicit instead of auto-handoff complexity.

Re-use prepareSet for per-segment dense views or extract one-segment preparation helper. Combine admitted segments into one SceneView with one global port ledger and one initial stock anchor. Each child begins with stock snapshot from stack; no initial dock event at split, ports global changes deduplicated and berth/resource invariants rechecked. Synthetic separation viewer event has no propellant consumption. Stack/courier freight .1 once, booster none. Reject separation midburn/service/docked or on fault; child trajectories derive from actual Runner state, never drawing interpolation.

## Decisions to audit/rank
1. Narrow staged domain versus expanding core Scenario/Program. Lean narrow domain, reject general vehicle hierarchy now for scale. What essential future-compatible contract is missing?
2. Ownership, accounting and event sides overlap; deep-spec highest-risk boundary. Are ballast encoding and per-child logistics stock copies safe if global ledger audits enforce one authority? Alternative shared multi-vehicle physics engine is larger.
3. Lifetime/frame/timeline behavior; lean retain all three lanes, hide unavailable actors/glyphs, disable reference option before birth/after retirement, no forced selection handoff.
4. Independent validation: whole physical mission at h=1/512,1/1024,1/2048 plus tight/regular DOP853; exact split mass/momentum/fuel assertions, paid captures, unchanged collision certificates, shuffle query/snapshot continuation, lifecycle browser scrubs/frames/selection/replay/reset switching.

Depth budget: verify load-bearing facts first, then prioritize critique and give concrete minimal architecture. Read-only; do not edit files, launch paid reviewers or subagents. No redesign of network, thermal/hull/aero/attitude physics, or general game/editor. Identify any genuinely human choices; otherwise choose a sound bounded path. Report verified/unverified labels. Numerical feasibility will be investigated in parallel by main agent, so do not claim frozen burns already solve this.
