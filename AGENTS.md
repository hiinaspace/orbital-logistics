# Orbital Logistics

Published hobby identity: Hiina <hiina@hiina.space>.

Read docs/charter.md and docs/plan.md. The charter is design intent; evidence in
 docs/evidence/ describes what was actually tested. M0 and the M1 manual editor
are implemented and M1 is user-accepted. M2/M3a were accepted on 2026-10-06;
the user chose to proceed to an initial M4a puzzle slice with absolute maneuvers.
See docs/evidence/m4.md for fixed-rule return puzzles, port targeting, time/fuel
alternatives, saved solutions/replay and display layers. M3b joint handoffs,
hardware alternatives, beneficial gravity assists and human optimization remain
open; do not claim the full M4 gate passed. docs/route-intent.md preserves dynamic
commands as later work; current burns/operations remain static.
The 2026-10-07 periodic-service proposal is retained in
docs/design/periodic-transfer/proposal.md. The user's subsequent core-loop concern
prompted independent Astra consultation and OpenTTD source research; read
docs/design/topology-study/proposal.md first. It recommends testing finite
three-port courier organization before recipe/timeline implementation. This is
an analytical witness and proposed gate, not an app level or accepted product
direction; await the user's design review. Runtime scheduling remains deferred.

- Keep simulation independent of DOM, rendering, workers, and wall-clock time.
- Prediction/execution use one dynamics/event implementation. View frames never alter a burn.
- Canonical physics steps and event boundaries must not depend on display queries, warp, or scrub frequency.
- No unvalidated gravity softening, singularity traversal, free capture burns, or hidden route selection.
- Preserve baseline/program JSON, independent calibration, and convergence evidence.
- Stop at the manual-editor human gate before building local targeting.
- Use uv for Python tools; configure ruff format/lint and ty pre-commit checks.
- Keep large/surviving scratch artifacts under this repo with an explicit lifetime; clean temporary services and files.
- Commits use Hiina identity and Assisted-by: Codex:<actual-model-id>; never Signed-off-by.
