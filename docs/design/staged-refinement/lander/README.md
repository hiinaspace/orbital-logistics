# Eagle ascent refinement: bounded offline search

2026-10-11. The production fixture remains the input to the viewer. This folder
contains an offline, reproducible search, the frozen pre-refinement
`baseline-mission.json`, and two complete candidate mission JSONs;
the selected shorter-turn candidate is `exact-mission.json`. The arrival authoring
branch separately preserved the lunar split state and can be combined with it.

## Result

The selected ascent starts at **42.183892**, docks at **45.370203**, and uses the
real moving Odyssey parking trajectory in the unchanged two-body prescribed field.
It leaves the landing/descent and outbound prefix untouched. Both ascent burns have
three smoothstep keys; the first key is exactly outward from Tranquility. It burns,
coasts prograde around Selene, and makes one paid rendezvous correction.

| Metric | Accepted baseline | Selected candidate | Later-dock alternative |
| --- | ---: | ---: | ---: |
| Liftoff / dock epoch | 40.664405 / 44.5 | 42.183892 / 45.370203 | 42.592930 / 45.979038 |
| Maximum Selene radius | 0.505938 | 0.454417 | 0.448642 |
| Maximum radius excess over simultaneous Odyssey | 0.140332 | 0.067610 | 0.066327 |
| Minimum lunar angular momentum during coast | -0.024171 | +0.018724 | +0.039791 |
| Minimum lunar angular momentum over whole ascent | -0.034404 | +0.002784 | +0.002769 |
| Propulsive delta-v | 2.060579 | 0.916700 | 0.906723 |
| Propulsive fuel | 0.138636 | 0.066100 | 0.065420 |
| Fuel after paid docking, independent DOP853 | 0.321894 | 0.394430 | 0.395109 |
| First/final burn total heading turn | 301.6° / 346.0° | 26.45° / 124.66° | 59.65° / 144.17° |
| First/final burn peak heading rate | 1178 / 1939° per unit | 155 / 1120° per unit | 336 / 1534° per unit |
| Peak engine acceleration | 1.526 | 1.322 | 1.321 |

The selected candidate has the smaller total turn and peak turn rate. The later
dock alternative reduces radius excess by only 0.00128 while making a longer
terminal turn. Both remain above Astra's **proposed**, unproven 0.03 radius excess
guide. The selected final turn exceeds its proposed 120° guide by 4.66°. Both
meet the adjacent-key 60° guide, have positive lunar angular momentum at every
dense trace sample, and avoid the baseline's reverse-direction coast. These shape limits were
kept as penalties during exact endpoint polishing; the final comparison uses the
measured values and canonical physical gates rather than treating proposed taste
numbers as capture tolerances.

## Physical checks

`search.py` integrates Aster plus Selene gravity at absolute epochs with DOP853,
moving surface pose, exact fixed thrust and mass flow, and the spherical smoothstep
heading law used by the runtime. Exploratory calls use the older author's softened
interior field only to traverse bad trial trajectories; both finalists were polished
and traced with the unsoftened field. Their dense sampled minimum lunar clearance
is 0.00001 at the launch center height. Sample traces in `baseline.json`,
`exact-candidate.json`, and `exact-candidate-5.json` include epoch, Eagle radius,
Odyssey radius, radius difference, fuel, and lunar angular momentum. Since the
sampled minimum occurs exactly at liftoff, the canonical Runner is the final
collision/interval authority.

`canonical-check.ts` independently propagates the two exported missions with the
canonical Runner and calls the full staged mission compiler. For the selected
candidate, outward launch acceleration is **+0.427689**, exact dock position/speed
errors are **1.02e-10 / 1.59e-10**, and paid capture fuel is **1.09e-11**. The full
mission admits, including return and both recoveries (orbiter at 79.510692). The
later-dock alternative also admits: dock position/speed errors **6.36e-9 /
6.67e-9**, paid capture fuel **4.55e-10**, orbiter recovery **79.507443**. Both are
well inside the unchanged 2e-6 capture tolerances and numerical margins.

The selected candidate combined with the separately authored arrival has also
passed the complete compiler: [combined-admission.json](../combined-admission.json)
records landing position/speed **6.08e-8 / 1.35e-7**, docking position/speed
**4.98e-9 / 5.23e-9**, Eagle dock fuel **0.3944298431**, orbiter recovery
**79.507471**, and the aggregate work limits. Changed Eagle fuel changes attached
return mass; this full compilation, rather than the local rendezvous alone, is the
admission evidence. It does not replace a new independent whole-graph oracle or
visual judgment of the motion.

## Search scope and reproduction

The first pass used 12 fixed-liftoff starts in a three-key ascent/brake family.
That exposed a reachable prograde coast at later dock epochs but initially made
radial overshoot worse. After Astra's review, six targeted surface-dwell/dock seeds
were tried. The best three branches received constrained endpoint polishing, and
the two useful ones received exact unsoftened refinement. A single lower-force,
longer-brake probe (`soft_brake.py`) missed the target by 0.0114 and was not
admitted. No open-ended heading grid, gravity change, fuel reset, free capture,
or display-path adjustment was used.

From the repo root:

```sh
uv run --with numpy --with scipy docs/design/staged-refinement/lander/search.py --search
uv run --with numpy --with scipy docs/design/staged-refinement/lander/phase_sweep.py
uv run --with numpy --with scipy docs/design/staged-refinement/lander/polish.py
uv run --with numpy --with scipy docs/design/staged-refinement/lander/exact.py
uv run --with numpy --with scipy docs/design/staged-refinement/lander/export.py
./node_modules/.bin/tsx docs/design/staged-refinement/lander/canonical-check.ts
```

Pass `5` to `exact.py`, `export.py`, and `canonical-check.ts` to reproduce the
later-dock alternative. The CSV-like `samples` arrays in the two exact candidate
JSONs are suitable for plotting radius and angular momentum versus epoch. Large
intermediate candidate files omit samples; scratch bytecode caches were removed.
