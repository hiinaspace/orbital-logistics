# Orbital Logistics

A schematic orbital model-set viewer: watch fictional spacecraft carry freight between
stations, scrub their history, and explore the same motion in different reference frames.

## Run

```sh
npm ci
npm run dev
```

The sets are **Orison · orbital freight** (four stations, four freighters),
**Selene · lunar loop** (a distant retrograde orbit), and **Selene · lunar freight**
(three freighters supplying a lunar depot and returning). Playback starts
immediately. Click a ship or station to inspect it; overlapping objects open a chooser.
Use the shared time slider or a ship's activity lane to scrub. Drag the view to pan,
scroll to zoom, and use Frame or View from here to change reference frames. Space
pauses; F fits. Layers includes a clear view. Replay explicitly rewinds the finite set.

Cargo, propellant, docking and burns come from the simulation ledger. The model details
are available under About this set. These scenes use normalized fictional systems,
impulsive test ships, and prescribed massive bodies; they are not real mission replays.

## Verify and author sets

```sh
npm run build
npm run test:sim
PLAYWRIGHT_PREVIEW=1 npm run test:browser
npm run evidence:model-set
npm run evidence:spatial
npm run evidence:lunar
npx tsx scripts/model-set-fixtures.ts --check
uv run --project spikes/numerics --group dev --group plots pre-commit run --config spikes/numerics/.pre-commit-config.yaml --all-files
```

[Current direction and architecture](docs/model-set.md) records the viewer contract
and accepted scope. [Spatial evidence](docs/evidence/spatial-foundation.md) covers
the 3D engine with 2D presentation; [lunar freight evidence](docs/evidence/lunar-freight.md)
covers the new set. [Prototype evidence](docs/evidence/model-set.md) records the original
viewer checks. [Tactical plan](docs/plan.md) preserves the earlier
editor/puzzle milestones as history. The main application now opens the viewer;
the previous CoaDE-style editor is recoverable at `c61325a` in Git history. Its pure
simulation/planning helpers and regression checks remain available for fixture authoring.

The [recovered Fable consultation](docs/design/orbital-model-set/README.md) and
[Codex synthesis](docs/design/orbital-model-set/synthesis.md) explain the change in
product direction. Earlier [topology](docs/design/topology-study/proposal.md) and
[periodic-service](docs/design/periodic-transfer/proposal.md) studies remain reference
material. No remote repository or deployment is configured.

Published hobby identity: Hiina <hiina@hiina.space>.
