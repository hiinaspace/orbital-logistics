# Orbital Logistics

Published hobby identity: Hiina <hiina@hiina.space>.

Read docs/charter.md and docs/plan.md. The charter is design intent; evidence in
 docs/evidence/ describes what was actually tested. M0 and the M1 manual editor
are implemented and M1 is user-accepted. M2 and its encounter follow-up are implemented; the user reviewed the helper
and authorized M3 on 2026-10-06. Initial M3a is implemented; see docs/evidence/m3.md.
Review its one-tug service/return flow before joint M3b. docs/route-intent.md records
the user-requested dynamic command direction; current burns/operations remain static.

- Keep simulation independent of DOM, rendering, workers, and wall-clock time.
- Prediction/execution use one dynamics/event implementation. View frames never alter a burn.
- Canonical physics steps and event boundaries must not depend on display queries, warp, or scrub frequency.
- No unvalidated gravity softening, singularity traversal, free capture burns, or hidden route selection.
- Preserve baseline/program JSON, independent calibration, and convergence evidence.
- Stop at the manual-editor human gate before building local targeting.
- Use uv for Python tools; configure ruff format/lint and ty pre-commit checks.
- Keep large/surviving scratch artifacts under this repo with an explicit lifetime; clean temporary services and files.
- Commits use Hiina identity and Assisted-by: Codex:<actual-model-id>; never Signed-off-by.
