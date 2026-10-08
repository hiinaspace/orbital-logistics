# Orbital model set — independent Fable consultation (2026-10-07)

Artifacts of a cross-model product/design consultation requested by the user after their
2026-10-07 message that the desired experience has drifted toward "a virtual model train
set but for spaceships". Everything here is research, design and bounded offline
experiment; no app code, settings, dependencies or git state were changed, and nothing
here is an accepted product direction until the user reviews it.

Start with [recommendation.md](recommendation.md).

| File | What it is | Produced by |
| --- | --- | --- |
| `recommendation.md` | Product framing, key choices, smallest experience test, falsifiers, what changes versus the earlier proposals | Root consultant (Claude Fable 5.1) |
| `viewer-sources.md` | NASA's Eyes, other viewers, model-railroad operations vs continuous running, JMRI automation, published track plans; each fact tagged sourced/inference | Sonnet research subagent |
| `mission-sources.md` | Aldrin cycler facts; NRHO/DRO parameters; Artemis/Gateway status as of 2026-10-07; what a planar toy can and cannot represent | Sonnet research subagent |
| `experiments/shuttle/` | Two tugs on the existing Home/Depot service, staggered by one synodic period, run through the app's unchanged `Runner`; offline shared-stock check | Root consultant |
| `experiments/cycler/` | Synthetic 2:1 ballistic cycler with two ports; boarding/alighting cost versus Hohmann; DOP853 re-encounter verification | Sonnet experiment subagent |
| `experiments/dro/` | Planar distant-retrograde-orbit family in the moon fixture (SciPy shooting), then the chosen member executed by the app's own `Runner` | Opus experiment subagent, root consultant for the app check |

## Reproduce (repo root)

```
npx tsx docs/design/orbital-model-set/consultant/experiments/shuttle/fleet-overlay.ts
uv run --project spikes/numerics --group plots python -I docs/design/orbital-model-set/consultant/experiments/cycler/cycler.py
uv run --project spikes/numerics --group plots python docs/design/orbital-model-set/consultant/experiments/dro/dro.py
npx tsx docs/design/orbital-model-set/consultant/experiments/dro/app-runner-check.ts
```

Each experiment README states its model limits. None of them is app UI, a playtest, or
evidence of fun. The two PNGs are evidence diagrams, not proposed UI.

## Model and transport

Root consultant requested as `claude -p --model fable --effort high`; the parent
session's transport probe (`../transport-probe.json`) verified `claude-fable-5-1`.
Subagents were spawned with explicit `model` parameters (sonnet, sonnet, opus, sonnet);
the Agent tool's `.meta.json` records the requested model only, so their actual model
is verifiable from the subagent transcripts' `message.model` fields if needed.
