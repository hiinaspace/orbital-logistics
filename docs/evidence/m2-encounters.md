# M2 encounter actions — 2026-10-06

User review confirmed the initial helper worked and requested assistance after
manual replanning, selected-node hover scrubbing, orbit/intercept markers and
explicit selection among overlapping icons. The user subsequently authorized
continuing into M3; this iteration closes the reported M2 friction first.

The Target helper now adjusts the selected last departure before the fixed
arrival epoch. Its authored epoch may move; earlier burns are preserved. A burn
already at arrival is explicitly replaced in the proposal. Later burns are
preserved. Component/branch/work/fuel/convergence constraints still apply;
unavailable selections show a reason instead of silently requiring the starter.

Canonical continuous coast segments identify geometric crossings and tangencies
with the circular target orbit, plus simultaneous close approaches. **Match orbit**
uses target velocity at the crossing's target occurrence; it does not imply the
target is there at the ship's epoch. **Intercept** requires simultaneous position
within the fixture tolerance. Clicking either menu action computes and verifies a
paid correction, adding it to the draft as one undo operation. It never executes,
changes the departure or teleports the ship. Stale, unaffordable or unconverged
requests leave the plan unchanged. Saved burns retain optional assistance provenance;
manual changes clear it and later upstream changes recompute actual diagnostics.

Geometric crossing discovery currently covers a circular target about the fixed
primary. Simultaneous closest-approach discovery also follows the integrated
target coast. These are local opportunities within the explicit horizon, not a
search for other revolutions or arbitrary orbit families.

Selected-node hover now updates the preview and other bodies without changing
node epoch or execution. Overlapping handles/nodes/apsides/encounters/bodies open
a menu at the pointer, including manual placement at encounter epochs. Menus
support keyboard selection and Escape, and are invalidated by edits/view changes.

Build/typecheck, **50 simulation tests**, and **14 production Chrome browser tests**
pass with no page/console errors. The tests include moved/recreated departures,
preserved prefixes, arrival replacement, manual tangent interception, phase-offset
orbit matching, fuel and stale-event rejection, convergence, atomic undo/replay,
hover isolation and actual overlap-menu choices. Screenshots were inspected.

Reproduce numerical evidence with:

```sh
npx tsx scripts/m2-encounter-evidence.ts
uv run --project spikes/numerics python spikes/numerics/m2_encounter_oracle.py
```

The script retains manually authored tangent and phase-offset plans plus a moved
departure proposal, including all solver trials and h/h2/h4 samples. Independent
SciPy DOP853 checks impulse axes, target/ship trajectories, fuel and matching.
Maximum sampled position error is 2.17e-12; velocity error 1.14e-12, versus the
1e-6 accuracy gate. The phase-offset geometric root differs from an independent
Brent solve by 2.59e-11. Its same-time miss remains outside capture tolerance.
Ruff format/lint and ty pass for the new oracle.

[Raw cases/programs/trials](m2-encounter-oracle-input.json),
[independent report](m2-encounter-oracle-report.json),
[overlap menu](m2-encounter-menu.png), [orbit matched](m2-orbit-matched.png).
