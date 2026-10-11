# Aster–Selene expedition

One finite Apollo-style sortie joins rotating-air launch, a planet parking revolution, translunar injection and lunar orbit insertion, a lunar coast revolution, airless landing and supported stay, lunar ascent and a timing orbit, transearth injection, home parking and atmospheric recovery. The reusable schematic vehicle carries its entire fuel supply. There is no refuelling, staging, artificial orbital depot or intermediate orbit capture.

## Physical ownership

`apollo-v1` owns one global clock, a fixed-origin planet and a prescribed circular Moon. Both gravity sources act on every free-flight phase. Atmospheric ascent uses `prepareAtmosphericLeg`; two vacuum owners use `Runner`; absolute-epoch `entry-rk4-v3` handles return. Every seam passes the exact preceding state and fuel. Lunar capture uses `paidCapture`; launches require outward acceleration. Supported ports are normalized to actual body rails and certified separated throughout their rail envelope.

Vacuum owners enlarge only the planet's exclusion radius to atmospheric top. Gravity has no radius dependence. This certifies complete vacuum intervals against air entry without switching gravity or relying on clear endpoints. Every burn must belong to exactly one flight phase. Ascent and entry enforce load limits.

Entry-v3 allows a fixed atmospheric primary, one circular gravity source and an absolute epoch. It does not add a moving atmospheric planet or moving recovery center. Its enclosure includes all-source gravity, other-body clearance and conservative circular travel. Legacy v1/v2 clocks and domains remain unchanged.

Admission ceilings: 128 time units, 16 burns, 20 milestones, 100,000 physical nodes, 40 MB serialized physical owners, 40,000 drawing samples and a 12 MB display packet. These are ownership/serialization measures, not browser heap limits. Preparation runs in the existing worker; playback and scrubbing never solve again.

## Authoring

The first candidate's lunar descent passed through the Moon and its return struck the Moon. Neither was admitted; `initial-candidate.json` retains that diagnostic. A lower fixed-force lunar descent/ascent, radial terminal landing key and longer return timing orbit produce the accepted flight. The timing orbit places the ship on the planet-facing side for departure.

Frozen controls assemble without search:

```sh
uv run --project spikes/numerics python docs/design/apollo/assemble.py
npm run evidence:apollo
npm run test:sim
npm run build
PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/apollo.spec.ts
```

For bounded cold reauthoring, run `author.py` (outbound), `refine.py` (intermediate insertion keys), `lunar-author.py` (surface/return), then `assemble.py`. Optimizer trials continue gravity inside bodies only to keep rejected trials finite. Production and the independent oracle do not. Runtime clearance admission is mandatory.

## Viewer and numerical gate

The set reuses frames, follow/chase, layers, speed, timeline schedule and Replay. Default speed is 0.1×. Mission milestones are distinct from physical handoffs. Surface view picks the closest pad or selected pad. Multiple surface owners use the strongest local gravity source for readouts/chase. Inactive air telemetry is hidden in vacuum.

See [evidence](../../evidence/apollo.md). Independent DOP853 replay uses all gravity and independently pays lunar capture. The frozen witness reserves position 5e-7 and velocity 1e-6 numerical allowance inside 2e-6 landing limits. Whole-mission state/recovery-epoch envelope is 1e-3: the tiny independent capture fuel difference alters the later force-limited launch and accumulates return phase difference. This is not a general guarantee for arbitrary edits. Online recurrence or changed hardware/world requires a new numerical and visual witness.
