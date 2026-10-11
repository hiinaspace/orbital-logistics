# Staged Apollo numerical accuracy

The initial witness measurements below are historical. The current fixture and
JSON reports include the [2026-10-11 refinement](../../evidence/staged-refinement.md),
with new lunar controls, inventories and measured numerical checks.

The admitted fixture retains canonical step 1/1024. Its independently measured
full-mission allowance is 1e-4 in state components and recovery epoch. Landing
and orbiter docking remain separate, much tighter 2e-6 position/velocity gates,
including their unchanged independent numerical allowances. The full-mission
allowance does not authorize an uncharged capture or a state/fuel reset.

## Why the initial independent replay failed

The first DOP853 replay used rtol=3e-13, atol=3e-14 and max step .02 for launch and
all finite burns. Despite these small local tolerances, its launch split velocity
was 3.74e-10 away from the canonical result. The full lunar encounter amplified
this to approximately 1.09e-7 at lunar separation. The return contact then differed
by .0003494015 in epoch, with maximum sampled replay state error .0001646862.
That result alone did not justify loosening admission: the reference itself
needed a precision check.

`convergence-probe.ts` independently assembles the same fixed phase graph with
canonical components at h, h/2 and h/4. It splits long vacuum segments only at
nodes on their original dyadic grid, moving any boundary that would cross a burn
to the first grid point after that burn. Each short Runner stays inside unchanged
production node limits. Entry uses a seven-unit coverage horizon, still beyond
actual contact; the contact prefix is unchanged. There are no trajectory resets
or modified dynamics, fuel, captures or controls. Its h result reproduces the
production compiler's contact epoch exactly.

| Canonical step | Landing position residual | Landing velocity residual | Return contact epoch |
| --- | ---: | ---: | ---: |
| 1/1024 | 5.8548224e-8 | 1.2899292e-7 | 79.51386183280101 |
| 1/2048 | 3.8964715e-9 | 5.7696721e-9 | 79.51381028882551 |
| 1/4096 | 1.5290977e-9 | 1.6613039e-8 | 79.51380605683339 |

The return contact differences are 5.1543976e-5 (h to h/2) and 4.2319921e-6
(h/2 to h/4). The entry-initial state differences likewise reduce from
1.9561556e-5 to 1.6063272e-6. Event residuals are not expected to decrease
monotonically to zero: controls were authored against the original canonical
prefix, while every refined run independently pays its own landing and docking.

## Tightened independent reference

The reference now uses rtol=3e-14 and atol=3e-15, max step .0005 during atmospheric
ascent/boostback, .001 during finite vacuum burns, .02 during coasts and .002
during atmospheric recovery. It still splits at every authored steering key and
arc boundary, propagates both unsoftened gravity sources, begins at the launch
pad, and independently derives every split/capture/attached mass. It receives no
TypeScript flight-state restart at a downstream seam.

The tightened independent return contact is 79.51380588679628, only 1.70e-7 from
the h/4 run. Against the admitted h run its measured errors are:

- Maximum sampled whole-mission state/fuel component: 2.6361512e-5.
- Return contact state component: 1.5151591e-5.
- Return contact epoch: 5.5946005e-5.
- Independent landing residuals: position 1.6338428e-9, velocity 1.7056900e-8.
- Independent docking residuals: position 1.3318367e-7, velocity 1.3529906e-7.

The 1e-4 global allowance is therefore supported by both convergence and a
refined independent reference, with retained error margins. This is a bounded
fixture result, not a guarantee for edited controls/hardware or arbitrary close
zoom. The physical capture limits and numerical allowances remain unchanged.

## Reproduction and retained evidence

```sh
node --import tsx scripts/staged-apollo-evidence.ts
node --import tsx docs/design/staged-apollo/convergence-probe.ts 1024
node --import tsx docs/design/staged-apollo/convergence-probe.ts 2048
node --import tsx docs/design/staged-apollo/convergence-probe.ts 4096
uv run --project spikes/numerics python spikes/numerics/staged_apollo_oracle.py 0
uv run --project spikes/numerics python spikes/numerics/staged_apollo_oracle.py 17
uv run --project spikes/numerics python spikes/numerics/staged_apollo_oracle.py 9000
```

`convergence-{1024,2048,4096}.json` retain every physical phase endpoint, paid
capture and both recoveries. `oracle-trace.log` records the original loose
reference and `oracle-trace-tight.log` records the tightened phase trace.
The authoritative production-oracle results are
`docs/evidence/staged-apollo-oracle-{0,17,9000}.json`.

## Late absolute-calendar replay

Cycle 9000 begins at absolute epoch 930467.8483368547. Directly feeding this large
clock to a very tight adaptive solver introduces stage/subtraction roundoff near
1e-10, exceeding the requested local integration tolerance; the first direct-clock
trial missed the lunar velocity tolerance. The independent oracle therefore
rebases only its numerical integration clock. Moon and pad phases advance to
the actual global epoch, controls and comparison states rotate to that epoch,
and reported recovery timestamps retain the global shift. Every trajectory still
integrates from the phase-advanced launch pad; no finite trajectory cache, state
restart or relative-field approximation is used by the oracle.

The rebased cycle 9000 replay passes: maximum state/fuel error 2.2730675e-5,
return epoch error 4.7204074e-5, landing position/velocity residuals
8.1088376e-9/5.3371487e-9 and docking residuals 1.4197453e-7/1.4177875e-7.
This checks the frozen physical recurrence near the admitted calendar end. Exact
indexed event boundaries and bounded history/resources are separate runtime tests.
