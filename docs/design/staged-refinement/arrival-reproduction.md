# Lunar insertion search reproduction

`arrival-baseline.json` freezes the pre-refinement fixture, canonical cutoff
states, and samples. The live production fixture has since changed; use this
snapshot as the search input. `arrival_search.py` tests a fixed old handoff, while
`arrival_coherent_search.py` tests a later handoff to the **same** downstream
ballistic state. Importing either module does not start a sweep.

From the repository root, to regenerate the two saved search result files:

```sh
uv run --with numpy --with scipy python docs/design/staged-refinement/arrival_search.py
uv run --with numpy --with scipy python docs/design/staged-refinement/arrival_coherent_search.py
```

Retained candidate JSONs omit the private adaptive-solver trace arrays; the search
commands also regenerate those arrays. Canonical before/after samples are retained
in `shape-traces.json`.

These commands overwrite `arrival-candidates.json` and
`arrival-coherent-candidates.json`; they were **not** rerun during the script
cleanup. Index **2** of the coherent results is the selected arrival: thrust
from **29.391392** to **30.35**, minimum inertial speed **0.152158**, propulsive
delta-v **0.196608**, fuel **0.121515**, and total thrust turn **25.35°**. Its
independent DOP853 endpoint residual is below **6.3e-10** per state component.
`arrival-admitted-2.json` is the frozen canonical mission candidate.

The selected arrival and [Eagle's selected ascent](lander/README.md) were
assembled in `combined-candidate.json`. To recompile that exact frozen mission
with the canonical Runner and refresh the saved admission record:

```sh
./node_modules/.bin/tsx docs/design/staged-refinement/check-combined.ts
```

The retained `combined-admission.json` reports paid landing position/speed
errors **6.08e-8 / 1.35e-7**, paid docking errors **4.98e-9 / 5.23e-9**, Eagle
fuel after docking **0.3944298431**, and orbiter recovery **79.507471**. The
full mission's aggregate node and byte budgets also pass. This compiler result
does not replace independent whole-graph oracle or visual inspection.
