# Airless surface-to-orbit — verified review brief, 2026-10-08

Request: senior architecture/design review using gpt-6-astra/xhigh, before implementing
this next authorized slice. Verify load-bearing code claims first, label each finding
[verified:how]/[unverified]/[unknown], then prioritize forks by leverage. Deep-spec the
one you judge most consequential. Read-only; do not delegate. This is a solo hobby
viewer: bring implementable decisions, not enterprise scaffolding or a human task list.
No need to repeat earlier puzzle/editor arguments. State which decisions truly need
human taste and which the main agent can make and test.

## Product/scope

The user accepted the schematic model train set viewer, finite propulsion, whiskers
and continuous analytical traffic. Now authorizes trying airless surface-to-orbit,
2D/in-plane first, with this review. Aerodynamics, terrain, Earth launch and staging
are deferred. They specifically want future multistage/reusable vehicles remembered:
a payload can itself be a future independently propelled ship, and close launch
scales/timeframes must coexist with orbital viewing. Do not implement staging now.
Watching/scrubbing frames is enough, no compulsory maneuver authoring or puzzle loop.

Lean: one finite curated ascent and cargo handoff from a slowly rotating spherical
body to one circular orbital depot, followed by attached dwell. Reuse the existing
pure Runner/dynamics/finite-thrust model and offline SciPy authoring. Keep continuous
orbital service working; don't force general ascent solving into its dispatcher.
Landing/reuse and continuous launch scheduling would be subsequent slices. If a
surface-to-station witness proves infeasible within a bounded search, deliver an
honest gate report, not a fake orbit attachment or weakened safety.

## Environment and current facts

| Item | Evidence |
| --- | --- |
| Repo / main | /home/s/code/orbital-logistics, natto, codex/model-set-viewer, HEAD0cdf307dc218cbd40236064aec279ca02ab64048, no remote |
| Stack | TypeScript7 / Vite8 / Canvas2D / DOM / dedicated workers; Python via uv, scipy DOP853 and Ruff/ty hooks |
| Reviewer | Codex CLI0.153.4; request gpt-6-astra at xhigh; main loop gpt-6.1-sol. Main checks transport before reading report. |
| Canonical simulation | src/sim/schema.ts, runner.ts, dynamics.ts, propulsion.ts. Six-state schema3, positive-radius spheres, pure prescribed gravity, fixed inertial direction/throttle arcs, exact mass/cap/depletion, paid capture residual. |
| Guard | Constructor rejects distance<=radius. derivative rejects inside/on sphere. certifiedCoast sufficient positive-clearance certificate subdivides to max depth, never softens/traverses surface. |
| Attachments | logistics supports circular ports around a fixed primary, or finite certified ballistic targets. Dock/undock/finite service through same Runner. Constrained dock motion uses dedicated provider. No surface port/support/launch type yet. |
| Display | SceneView/VesselView independent of Bundle. Exact event sides, interpolated disposable display samples. Reference frames transform every vertex at its own epoch. Future force whiskers and faded flown trails. |
| Continuous | TrafficEngine owns finite stock/flows/services/window retries/global commits; finite local Runner episodes own flight.128-unit bounded history, held-head cursor, one request. Fixed templates in XY around mu1 primary only. |
| Prior checks |103 sim/12 production Chrome,2,048-unit soak, independent later-window DOP853/flow reports at docs/evidence/continuous-traffic.md. Not a live rerun of old reports in this review. |
| Current changes | Only docs/design/surface-ascent/boundary-probe.ts/json and this brief initially. In parallel main is diagnosing/fixing worker lifecycle, separately from physics. |

[verified: node --import tsx docs/design/surface-ascent/boundary-probe.ts]
Current exact-surface initial states reject at t0. A positive1e-6 or2e-6 center height
with mu=R=1, initial spin.003, dry1/cargo.1/fuel1.4/ve3/F5/cap3, h1/8192 advances
0.5 with altitude~.16418 and fuel paid. F1 fails near surface with consumed prefix,
without crossing. Six cases retained in boundary-probe.json. This proves only
boundary feasibility; no orbital witness is authored yet.

Primary sources consulted, not a requirement to reproduce Apollo:
- https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html (Moon radius/gravity/spin).
- https://science.nasa.gov/moon/facts/ (Moon context).
A normalized Moon-like R=mu=1 body at omega~.003 is a reasonable fictional first set.
A documented center height1e-6 R corresponds to meter-scale legs/vehicle COM for a
Moon-sized sphere. These are visual/reference scales, not a real mission claim.

## Worked forks

1. **Contact/support and lift-off.** Lean explicit body-fixed surface berth with
   `kind:surface,bodyId,rate,phase,centerHeight` and documented physical vehicle COM
   above the sphere; fixed primary/XY admitted first. Center height is part of scene
   geometry, not arbitrary numerical startup nudge, and must get sensitivity tests.
   Keep core positive-clearance guards unchanged. Constrained pad dwell represents
   mechanical support. A launch operation releases the berth at its current state,
   inheriting physical rotation velocity, only if positive net outward acceleration
   with its same-epoch finite-thrust arc (account gravity and centrifugal terms).
   Reject ordinary unpowered surface undock. Alternative: true zero-clearance contact
   complementarity/one-sided lift-off certificate; more general but changes core
   safety substantially. Would the COM-height representation be honest and sufficient,
   or should an explicit one-sided contact model be required now? No teleport to a
   safe altitude or unpaid initial speed. No sphere collision exemptions in free flight.

2. **Wire/initial attachment/arrival semantics.** Lean additive versioned surface
   port model, retaining existing wire fixtures and snapshots. Initial dock at epoch
   with zero residual and exact pad state is an explicit initial attachment; reuse
   existing dock event rather than a generalized initialization API yet. Surface
   dock later in flight must reject (landing not implemented). New explicit `launch`
   event rather than renaming an orbital port/undock. Alternatives: generalized
   initial attachment field, or canonical schema/model4 if adding meaning to v3
   would violate snapshots. Review compatibility burden and reject unknown fields
   in legacy formats explicitly where needed. Future staging must be separately
   paid mass/identity/ownership events; don't encode a vehicle as a scalar cargo ID.

3. **Steering/authoring.** Lean bounded offline optimization of6–16 contiguous fixed
   inertial heading arcs (same existing finite-thrust implementation), full exact
   gravity and fuel. Departure at pad after finite load service, coast/circularize
   and paid negligible residual capture at the moving orbital depot. No large end
   capture correction. Independent DOP853 and same-program3-step convergence before
   admission. Alternative: radial/tangential local steering law/gravity turn directly
   in RK stages; useful later but more solver/oracle/snapshot complexity now. Keep
   propulsion limits plausible, inspect gravity losses/height/speed rather than
   claim optimality. New set may show a single curated ascent; it needn't return or
   satisfy legacy round-trip puzzle objective to be a valid viewer scene.

4. **Readability across scales.** Whole-orbit fit plus a Launch view preset centered
   on pad with a closer scale, and ship-follow view as it climbs. Preserve manual
   pan/zoom; no compulsory automatic camera or speed changes. Show pad mark/orbital
   depot distinctly, begin from supported/loading state, actual launch and burnout
   events, altitude/radial/tangential speed/TWR in inspector on demand, fuel/freight
   traces. Existing analog speed/scrub and thrust whiskers do much of the work.
   Alternative simultaneous inset is more UI work; defer unless preset can't make
   the launch readable. How to use scales without implying full-size glyph hulls?

5. **Future staging seam, kept small.** Preserve stable ship identity and real dry/
   cargo/fuel mass accounting in this slice. Document that separation will create
   child vehicle state+mass ledgers at one atomic event; shared initial velocity,
   explicitly paid separation impulse if any, conservation of mass/momentum and
   separate propulsion thereafter. Do not add unused hierarchical fleet entities,
   physical drag/landing legs or reusable booster schedules today. Does the first
   launch API foreclose that future in any less-obvious way?

## Proposed evidence gates

- Unit: supported surface dwell follows physical spin, launch inherits tangential
  velocity, same-epoch event order, invalid/weak/unpowered release rejected without
  fuel or state side effects; body penetration remains failure. Replay/snapshot and
  partition/query independence, legacy fixture regression.
- Author bounded positive-clearance ascent to an orbital depot, actual thrust/fuel,
  no authored impulses, pre-snap position and velocity residual plus1e-8 each<1e-7.
  Independent DOP853 full resource/event replay and h/h2/h4 convergence; COM-height
  sensitivity and clearance evidence suitable for near-surface flight (cannot just
  enlarge body radius by.03 and call all near-pad trajectories unsafe).
- Browser: load/scrub/ascent/burnout/handoff, whole scene and launch view/readouts,
  frame invariance, repeated fixed/continuous/launch set switching, no console
  errors. Diagnose reported worker error with reproducible evidence separately.
- Out: full contact collision geometry, terrain, aerodynamic ascent, landing,
  staging/reuse, runtime launch optimizer, multibody surface launches,3D camera.

Please verify claims against code/probe; critique geometry/contact and compatibility
especially. Return recommendations, prioritized dispositions, the deepest selected
spec, and a short executable test matrix. Main implements only after synthesis.
