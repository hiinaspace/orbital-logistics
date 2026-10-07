# Orbital Logistics

A trajectory-programming logistics puzzle experiment by Hiina. Browser-first,
2D, visual maneuver editing; later cargo and synchronized reusable services.

**Current checkpoint: M1 manual editor accepted; M2 is next.** Choose
Orbit shaping or Moon encounter. Plan a trajectory, click its path to place a
maneuver, click R or T, move the pointer, then click to commit (Escape cancels).
Precision controls, ordered maneuvers, apsis snaps, undo/redo, synchronized frames,
execution and JSON replay use the shared headless simulation. The user accepted the manual editor and frame switching and authorized M2.
Apsis dots place snapped maneuvers; clicking a node engages horizontal time editing.

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
```

`evidence:m0` regenerates the production-core analytic/convergence and independent
SciPy DOP853 comparisons under `docs/evidence/m0-*`. The moving-body fixture is a
headless regression. `evidence:m1` checks the bounded edit fixtures at three step
sizes against SciPy, retaining authored before/after plans. See
[M0 evidence](docs/evidence/m0.md) and [M1 evidence](docs/evidence/m1.md).

Browser tests run a temporary server on loopback 4179, separate from the retained
review preview on 4178. To check production assets and record interaction metrics:

```sh
npm run build
PLAYWRIGHT_PREVIEW=1 npm run test:browser
npm run preview -- --port 4178 --strictPort
# In another terminal, with the preview running:
node scripts/m1-browser-evidence.mjs
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

Build the bounded M2 rendezvous experiment: fixed departure/arrival epochs, one
editable departure impulse and a charged arrival burn, with explicit proposal
accept/reject and constrained branch/fuel/accuracy checks.

- [Tactical plan](docs/plan.md): build slices, temporal/interaction contract, M2–M6 gates.
- [M0 evidence](docs/evidence/m0.md): simulation contract, measured accuracy, and supported limits.
- [M1 evidence](docs/evidence/m1.md): manual editor, calibration, replay and interaction measurements.
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
