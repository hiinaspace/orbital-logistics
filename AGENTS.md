# Orbital Logistics

Published hobby identity: Hiina <hiina@hiina.space>.

Read docs/model-set.md and docs/plan.md first; docs/charter.md is historical design
intent and docs/evidence/ records tested behavior. On 2026-10-08 the user accepted
an orbital model-set viewer rather than a puzzle game and authorized retiring the
CoaDE editor UI. The app now shows prepared fictional orbital freight, a lunar
DRO, and three lunar freight round trips, plus fixed-primary/lunar powered trips, with shared scrubbing, reference frames,
stock/ship inspection and timelines. See docs/evidence/model-set.md,
docs/evidence/lunar-freight.md and docs/evidence/bounded-propulsion.md for limits and validation. Watching is sufficient;
do not reintroduce a puzzle/courier-optimization gate or mandatory authoring.

The viewer retains an XY projection. The simulation is now canonical six-state v3,
with explicit propulsion-free v1/v2 fixture/program conversion, spatial rails/burns/capture/safety, and
planar guards on historical aiming tools. See docs/evidence/spatial-foundation.md and
docs/design/spatial-foundation/disposition.md. Multi-system content, ground launches,
production/upkeep and general demand dispatch remain future work. Prepared
multi-ship overlays are admitted only after shared-stock/berth checks; they are not a
joint fleet scheduler. Current burns/operations remain static; route intent is deferred.
Prior periodic/topology studies and the recovered Fable consultation are preserved in
docs/design/. M1/M2/M3a acceptance and M4a evidence are history, not current UI gates.
Ballistic ports are finite burn-free target trajectories, safety-certified through
their complete validity interval by the canonical Runner. Capture, dwell and undock
use that provider; display interpolation never becomes a physical target. The lunar
routes are bounded offline witnesses, not a general multi-body targeting service.
The user accepted stable labels/lunar freight, then authorized bounded propulsion
with Astra review. Fixed inertial finite thrust, exact anchored mass/cap/depletion,
powered safety, partial fuel accounting and analog speed are implemented. Read
docs/design/bounded-propulsion/README.md and disposition.md. Powered demonstrations
have no authored impulses; pre-snap residuals plus numerical allowance must each be
below1e-7. Old snapshots require replay; legacy propulsion fields reject explicitly.
The user accepted bounded propulsion and authorized continuous analytical traffic
with Astra review. Read docs/design/continuous-traffic/README.md and disposition.md,
and docs/evidence/continuous-traffic.md. TrafficEngine owns global service/resources,
window retries and fleet commits; finite local Runner episodes own flight. Known
plans become actual only at frontier epochs. Preserve exact local event timestamps,
128-unit rolling history/resource anchors, one outstanding bounded worker request,
held-head Pause/Play/Live semantics, and last-known fault validity. Current fixed-route
dispatch is not a general optimizer, persistence, rescue or lunar continuation.
No new editor, launch or3D camera is part of this slice.

- Keep simulation independent of DOM, rendering, workers, and wall-clock time.
- Prediction/execution use one dynamics/event implementation. View frames never alter a burn.
- Canonical physics steps and event boundaries must not depend on display queries, warp, or scrub frequency.
- No unvalidated gravity softening, singularity traversal, or free capture burns. Automatic route generation may choose routes; retain inspectable programs, costs and provenance.
- Preserve baseline/program JSON, independent calibration, and convergence evidence.
- Keep model caveats/provenance in optional details, not repeated captions or footers.
- Use uv for Python tools; configure ruff format/lint and ty pre-commit checks.
- Keep large/surviving scratch artifacts under this repo with an explicit lifetime; clean temporary services and files.
- Commits use Hiina identity and Assisted-by: Codex:<actual-model-id>; never Signed-off-by.
