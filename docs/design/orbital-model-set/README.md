# Recovered orbital model-set consultation

2026-10-07. Recovered after the chat was accidentally archived during the Claude
consultation. The substantive consultation is available; restarting it is unnecessary.

Start with the [Codex synthesis](synthesis.md), then the original
[Fable recommendation](consultant/recommendation.md). The original report is preserved
as written, including proposals and claims qualified in the synthesis.

## What survived

- Complete recommendation and artifact index.
- Both research notes: viewers/model railroads, and mission/orbit references.
- All three experiments: staggered shuttle service, synthetic cycler, planar DRO.
- Scripts, numerical results, diagrams, and the DRO's additional app Runner check.
- Original Claude session journals; hashes and event counts of the 908-event stream capture.

The process ended before its terminal result and closing response. The final Opus
adversarial read had started, but returned no findings. Do not describe that final
review as completed. There is no final usage/cost total or confirmed normal exit.
The captured stderr is empty; the saved work shows no authentication failure.

## Verified transport

Actual `message.model` fields in the session journals confirm:

| Work | Actual model | Status |
| --- | --- | --- |
| Main consultation | `claude-fable-5-1` | Report saved; closing response interrupted |
| Viewer research | `claude-sonnet-5-5` | Complete |
| Mission research | `claude-sonnet-5-5` | Complete |
| Cycler experiment | `claude-sonnet-5-5` | Complete |
| DRO experiment | `claude-opus-5-5` | Complete |
| Final adversarial read | `claude-opus-5-5` | Interrupted; no findings |

All six journals record effort `high`. This verifies the consultation itself, beyond
the earlier successful transport probe. Journal paths, event counts, and SHA256 hashes
are in [recovery-transport.json](recovery-transport.json). The original journals under
`/home/s/.claude/projects/` were not changed. The duplicate stream and empty stderr capture were cleaned after recovery was verified;
the complete original main/subagent journals remain in Claude's session directory.

## Recovery validation

Codex reran all four commands in the consultant's [reproduction index](consultant/README.md)
successfully after the interruption:

- Shuttle: both tugs returned Home, each delivered 0.2; merged stock never negative.
- Cycler: maximum repeated-encounter error approximately 2.83e-11 over three periods.
- DRO: all five shooting solutions converged; independent integration reached t=24.
- App DRO: unchanged Runner reached t=24 at steps 1/512 and 1/1024. Eight-period
  position closure errors were approximately 1.39e-10 and 1.41e-11 respectively.

These are reproducible numerical witnesses, not implemented viewer features or a
playtest. No application source was changed during recovery.

On 2026-10-08 the user accepted the model-set direction and authorized implementation.
See [current architecture](../../model-set.md) and [viewer evidence](../../evidence/model-set.md).
Recovered Python witnesses were formatted/linted and checked with the project's ty
hooks; the DRO script now asserts that a converged crossing exists before unpacking.
Both Python experiments were rerun successfully after that maintenance.
