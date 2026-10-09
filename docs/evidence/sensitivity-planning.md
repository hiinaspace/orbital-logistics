# Sensitivity planning and bounded playback speed

2026-10-09. User accepted focus stability and1× buffered service and requested
faster planning with a measured speed envelope. This follow-up uses numerical
sensitivities for adaptive controls/visitor legs,32-unit committed lead and a4×
maximum for Orison · flexible service. Other sets retain their16× range.

## Result

Production installed headless Chrome154.0.8037.97 on natto (Ryzen7 7840U) played through
512 units at a measured3.9975×, with zero observed buffer-empty frames, minimum
5.1855 units of remaining lead and a116.8ms maximum gap between published cursor
updates. Seven returns and seven unsuccessful planning windows were committed at
the physics head, with zero station-control failures. Startup was2.895s; retained
view data was4.49MB. Published state has a100ms UI cadence, so this measures
multi-second holds/throughput, not pixel-to-pixel presentation latency.

The preliminary16-unit experiment through256 shows why a cap/buffer combination
is useful:

| Requested rate | Actual rate | Longest published-clock gap | Buffer empty |
|---|---:|---:|---:|
|4×|3.834×|2.133s|yes|
|8×|5.977×|3.100s|yes|
|16×|8.287×|3.650s|yes|
|4×, final32-unit buffer, through512|3.998×|0.117s|no|

These are host/browser witnesses, not a universal hardware guarantee or a proof
of all future station phases/fuel states. The supported4× performance witness
requires≥95% requested throughput, no empty-buffer frames and gaps below600ms.
Lower rates remain selectable; arbitrary spatial services remain outside this
bounded online family. No controller objective, capture gate, fuel budget or
physical integration step was loosened.

## Numerical evidence

The512-unit numerical replay admits the same seven schedules as the preceding
finite-difference witness, with six journeys completed at its actual head and
the seventh already frozen. Generated forces change at small floating-point
scales; this is not a claim of bit-identical programs. Trial numerical-work
counts fall from8876 to3000 (66.2% fewer): controller5010→1826 and
visitor3866→1174. Counts include charged sensitivity attempts as well as physical
rollouts. Four candidate trials and shared work/storage bounds still apply.
The recorded74.80s Node wall time overlaps browser regression work and is
not an isolated comparison with the old100.58s run.

From the original station/depot/visitor anchors, a fresh independent22-state
DOP853 replay covers all seven admitted episodes through528, all14 captures,
seven donor-funded transfers, early/late dense visitor paths and all episode
base anchors. Maximum errors: station position2.06e-12, visitor position4.10e-11,
visitor velocity1.46e-11, visitor fuel9.65e-12; tightened-oracle difference3.38e-10.
Fuel transfer preserves total attached mass, and runtime fuel balance stays within9e-16.

The five sensitivity checks cover spatial moving-body gravity, both fuel-linked
pulses, zero-force initialization, off-grid events, actual safety subdivisions,
force-sphere edges, acceleration-cap fallback and shared work exhaustion.
Canonical arrival tolerance remains2e-11 and coupled captures retain their
1e-7 paid position/velocity gates.

## Reproduction and retained artifacts

```sh
npm run build
node --import tsx docs/design/sensitivity-planning/probe.ts 512
node --import tsx docs/design/sensitivity-planning/replay-evidence.ts
uv run --project spikes/numerics python spikes/numerics/flexible_online_oracle.py \
  --input docs/design/sensitivity-planning/oracle-input.json \
  --output docs/design/sensitivity-planning/oracle.json
PLANNING_RATES=4 PLANNING_THROUGH=512 PLAYWRIGHT_PREVIEW=1 \
  npx playwright test tests/browser/planning-throughput.spec.ts
npm run test:sim
PLAYWRIGHT_PREVIEW=1 npx playwright test
uv run --project spikes/numerics --group plots pre-commit run \
  --config spikes/numerics/.pre-commit-config.yaml --all-files
```

Raw timings, generated controls, original-anchor oracle input/results and test
logs live in [the slice directory](../design/sensitivity-planning/README.md).
`browser-256.json` belongs to the preliminary sensitivity-only/16-unit build;
rerunning it on the final capped32-unit build cannot reproduce the higher-rate
experiment. `browser-512.json` is the final performance gate. Existing earlier
artifacts remain baselines. Human acceptance of this new4× presentation remains open.

Final validation: all163 simulation checks pass. The full production browser run
passed32 checks and skipped the two optional profiler/performance tests; its
remaining fault test hit the old5s harness timeout because32 units take8s to drain
at4×. The corrected15s fault/rewind wait passes separately with unchanged assertions,
covering all33 regular browser checks. The additional opt-in512-unit performance
gate passes, along with set-cap switching. Build/typecheck and configured all-file
Ruff-format/lint/ty hooks pass. Historical generated screenshots/performance JSON
were restored; owned temporary test artifacts were removed and4178 retained.
