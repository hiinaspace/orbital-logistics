# Orbital Logistics

Published hobby identity: Hiina <hiina@hiina.space>.

Read docs/model-set.md and docs/plan.md first; docs/charter.md is historical design
intent and docs/evidence/ records tested behavior. On 2026-10-08 the user accepted
an orbital model-set viewer rather than a puzzle game and authorized retiring the
CoaDE editor UI. The app now shows prepared fictional freight traffic and a lunar
DRO, with shared scrubbing, reference frames, stock/ship inspection and timelines.
See docs/evidence/model-set.md for limits and validation. Watching is sufficient;
do not reintroduce a puzzle/courier-optimization gate or mandatory authoring.

The first viewer remains 2D. Multi-system content, ground launches, production/upkeep,
continuous propulsion and a coherent 3D engine migration are future work. Prepared
multi-ship overlays are admitted only after shared-stock/berth checks; they are not a
joint fleet scheduler. Current burns/operations remain static; route intent is deferred.
Prior periodic/topology studies and the recovered Fable consultation are preserved in
docs/design/. M1/M2/M3a acceptance and M4a evidence are history, not current UI gates.

- Keep simulation independent of DOM, rendering, workers, and wall-clock time.
- Prediction/execution use one dynamics/event implementation. View frames never alter a burn.
- Canonical physics steps and event boundaries must not depend on display queries, warp, or scrub frequency.
- No unvalidated gravity softening, singularity traversal, or free capture burns. Automatic route generation may choose routes; retain inspectable programs, costs and provenance.
- Preserve baseline/program JSON, independent calibration, and convergence evidence.
- Keep model caveats/provenance in optional details, not repeated captions or footers.
- Use uv for Python tools; configure ruff format/lint and ty pre-commit checks.
- Keep large/surviving scratch artifacts under this repo with an explicit lifetime; clean temporary services and files.
- Commits use Hiina identity and Assisted-by: Codex:<actual-model-id>; never Signed-off-by.
