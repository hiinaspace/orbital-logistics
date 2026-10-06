# Orbital Logistics

A trajectory-programming logistics puzzle experiment by Hiina. Browser-first,
2D, visual maneuver editing; later cargo and synchronized reusable services.

**Current checkpoint: M0 executable numerical sketch.** The browser runs one
ship around a fixed primary using the shared headless simulation. Choose a
circular coast or prepared transverse impulse; play/pause, advance, change
playback speed, seek/reset, and save/load scenario/program/snapshot JSON.
The forecast and execution share the same dynamics and event runner.
Manual maneuver editing remains M1.

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
```

`evidence:m0` regenerates the production-core analytic/convergence and independent
SciPy DOP853 comparisons under `docs/evidence/m0-*`. The moving-body fixture is a
headless regression, while the opening scene is two-body. See
[M0 evidence and limits](docs/evidence/m0.md).

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

Build M1, the manual prefix of a 2D **Children of a Dead Earth astrogation-tutorial
adaptation**, based on the installed tutorial resource study. Match selection,
future hover/pin, maneuver-handle and reference-frame semantics before adding
local targeting. Stop for hands-on editor review before M2.

- [Tactical plan](docs/plan.md): build slices, temporal/interaction contract, M2–M6 gates.
- [M0 evidence](docs/evidence/m0.md): simulation contract, measured accuracy, and supported limits.
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
