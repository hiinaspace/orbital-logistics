# Orbital Logistics

A trajectory-programming logistics puzzle experiment by Hiina. Browser-first,
2D, visual maneuver editing; later cargo and synchronized reusable services.

**Current checkpoint: planning + feasibility spikes.** This is not yet M0/M1.
The browser currently shows retained before/after encounter samples, selectable
nonrotating frames and a preview slider. It does not run live physics or edit burns.

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
npm run test:browser
npm run spike:numerics
npm run spike:oracle
node spikes/browser-benchmark.mjs
```

Browser checks use installed Google Chrome through Playwright; no downloaded
browser was needed on `natto`. The last two commands regenerate numerical evidence
and retained sample JSON. The oracle uses uv and locked Python dependencies in
`spikes/numerics`; it is offline analysis, not a gameplay dependency.

Python checks and hook setup:

```sh
uv sync --project spikes/numerics
uv run --project spikes/numerics ruff format --check spikes/numerics/oracle.py
uv run --project spikes/numerics ruff check spikes/numerics/oracle.py
uv run --project spikes/numerics ty check spikes/numerics/oracle.py
uv run --project spikes/numerics pre-commit install --config spikes/numerics/.pre-commit-config.yaml
uv run --project spikes/numerics pre-commit run --config spikes/numerics/.pre-commit-config.yaml --all-files
```

## Next

Build the manual prefix of a 2D **Children of a Dead Earth astrogation-tutorial
adaptation**, based on the installed tutorial resource study. Match selection,
future hover/pin, maneuver-handle and reference-frame semantics before adding
local targeting. Stop for hands-on editor review before M2.

- [Tactical plan](docs/plan.md): build slices, temporal/interaction contract, M2–M6 gates.
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
