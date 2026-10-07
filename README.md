# Orbital Logistics

A trajectory-programming logistics puzzle experiment by Hiina. Browser-first,
2D, visual maneuver editing; later cargo and synchronized reusable services.

**Current checkpoint: M3a accepted; initial M4a puzzles implemented.** Choose
Orbit shaping, Moon encounter or Rendezvous. Plan a trajectory, click its path to place a
maneuver, click R or T, move the pointer, then click to commit (Escape cancels).
Precision controls, ordered maneuvers, apsis snaps, undo/redo, synchronized frames,
execution and JSON replay use the shared headless simulation.
Apsis dots place snapped maneuvers; clicking a node engages horizontal time editing.

In Rendezvous, select the departure maneuver and click **Target**. The purple
proposal previews the meeting time and lists departure/arrival cost. **Accept**
puts both burns into the draft; **Reject** leaves it unchanged. **Execute plan**
runs the accepted draft. The helper adjusts the selected last departure before the fixed arrival, preserving
its authored epoch and earlier maneuvers inside the CCW, zero-revolution branch.
Hover the path while a node is selected to scrub other bodies. Click M/I encounter
markers for a paid orbit-match/intercept correction or a manual maneuver.
Overlapping icons open a selection menu at the pointer.

Choose **Delivery** for the one-tug logistics scene. The initial outbound program
still needs a return; **Example round trip** adds a complete authored return to the
draft. Edit Dock / Transfer / Undock in **Port operations**, then execute. Cargo,
finite refueling stocks, service durations and the empty/fueled return requirement
are part of prediction and replay. Home/Depot frames and inventories follow preview.

Choose **1 · Return ticket** or **2 · Express return** for the first puzzles.
The outbound delivery is provided; choose a return window and bring the tug home.
In Rendezvous, choose a port and departure/arrival epochs, **Place departure**,
then **Target → Accept → Execute plan**. Saved successful solutions compare time,
fuel and hardware separately, with Replay and JSON download. **New attempt**
restores the starter while retaining solutions. Express return adds a deadline.

**Layers** toggles plan, orbits, markers and execution trail; **Bodies only** restores
your previous combination on its second click. Followed plan segments turn grey,
while the cyan execution trail fades further into the past.

## Run

Node 22.12+ on the Node 22 line (verified with 22.22.1); npm lockfile included.

```sh
npm ci
npm run dev
```

Open the localhost URL Vite prints. The dev server binds only to loopback.

```sh
npm run typecheck
npm run build
npm run test:sim
npm run test:browser
npm run evidence:m0
npm run evidence:m1
npm run evidence:m2
npm run evidence:m2-encounters
npm run evidence:m3
npm run evidence:m4
```

`evidence:m0` regenerates the production-core analytic/convergence and independent
SciPy DOP853 comparisons under `docs/evidence/m0-*`. The moving-body fixture is a
headless regression. `evidence:m1` checks the bounded edit fixtures at three step
sizes against SciPy, retaining authored before/after plans. See
[M0 evidence](docs/evidence/m0.md) and [M1 evidence](docs/evidence/m1.md).
`evidence:m2` compares three rendezvous seeds, both charged burns and the target
coast against analytic Hohmann values and independent SciPy propagation.

Browser tests run a temporary server on loopback 4179, separate from the retained
review preview on 4178. To check production assets and record interaction metrics:

```sh
npm run build
PLAYWRIGHT_PREVIEW=1 npm run test:browser
npm run preview -- --port 4178 --strictPort
# In another terminal, with the preview running:
node scripts/m1-browser-evidence.mjs
node scripts/m2-browser-evidence.mjs
node scripts/m3-browser-evidence.mjs
node scripts/m4-browser-evidence.mjs
```

Retained planning spikes can still be reproduced separately:

```sh
npm run spike:numerics
npm run spike:oracle
node spikes/browser-benchmark.mjs
```

Browser checks use installed Google Chrome through Playwright; no downloaded
browser was needed on `natto`. The spike commands regenerate historical numerical
evidence and retained sample JSON. The oracle uses uv and locked Python dependencies in
`spikes/numerics`; it is offline analysis, not a gameplay dependency.

Python checks and hook setup:

```sh
uv sync --project spikes/numerics
uv run --project spikes/numerics ruff format --check spikes/numerics
uv run --project spikes/numerics ruff check spikes/numerics
uv run --project spikes/numerics ty check spikes/numerics
uv run --project spikes/numerics pre-commit install --config spikes/numerics/.pre-commit-config.yaml
uv run --project spikes/numerics pre-commit run --config spikes/numerics/.pre-commit-config.yaml --all-files
```

## Next

Try improving a valid return's time or fuel voluntarily. The first puzzle slice
has two independently validated tradeoffs; this still needs human optimization
feedback. M3b joint handoffs, hardware alternatives and beneficial gravity assists
remain later gates. [Reusable route intent](docs/route-intent.md) preserves the
dynamic direction; current burns and port operations remain absolute.

- [M4a evidence](docs/evidence/m4.md): return puzzles, port targeting, time/fuel alternatives, saved solutions and replay.
- [Tactical plan](docs/plan.md): build slices, temporal/interaction contract, M2–M6 gates.
- [M0 evidence](docs/evidence/m0.md): simulation contract, measured accuracy, and supported limits.
- [M1 evidence](docs/evidence/m1.md): manual editor, calibration, replay and interaction measurements.
- [M3a evidence](docs/evidence/m3.md): finite delivery/return, service ledger, independent oracle and replay.
- [M2 encounter follow-up](docs/evidence/m2-encounters.md): manual corrections, hover and overlap menu.
- [M2 evidence](docs/evidence/m2.md): bounded local rendezvous, costs, independent oracle and browser replay.
- [Captured charter](docs/charter.md): product baseline copied from the org vault.
- [CoaDE reference](docs/evidence/coade-reference.md): installed tutorial observations and remaining UI unknowns.
- [KSP/mod references](docs/evidence/ksp-reference.md): precision controls and encounter feedback.
- [Numerical evidence](docs/evidence/numerics.md): independent checks, parameters and limits.
- [Ecosystem comparison](docs/evidence/ecosystems.md) and [environment](docs/evidence/environment.md).
- [Astra review](docs/evidence/astra-review.md) and [disposition](docs/evidence/review-disposition.md).

The charter snapshot retains its original capture date and historical proposal.
Current implementation decisions/evidence live here; tracker pickup lives at
`/home/s/org/projects/orbital-logistics.md`. No remote repository or deployment
is configured. Game assets and tutorial prose are not copied into this repository.
