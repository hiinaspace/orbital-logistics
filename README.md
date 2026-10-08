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
(three freighters supplying a lunar depot and returning). **Selene · powered freight**
and **Orison · powered transfer** add finite-thrust departure and braking with continuous
fuel use. **Orison · continuous service** runs two freighters repeatedly with finite
station buffers and explicit supply/export flows. Pause/scrub holds history; Play
catches up, Live resumes the head, and Restart run starts a fresh session. The speed slider adjusts smoothly from 2^-12× to 16×. **Selene · Surface freight**
adds an airless ascent from Cairn to Lantern. **Selene · Surface round trip** adds
orbital refueling, return freight, finite braking, touchdown and unloading at Cairn.
**Selene · continuous surface service** repeats the flights with finite shared stocks
and explicit supply/export flows. **Orison · crossing planes** adds two ships making
paid changes between inclined circular orbits around different node axes.
**Surface view** shows the close scale; choose a slower rate for launch or landing,
then Fit or a ship frame to follow the orbit. Playback starts
immediately. Click a ship or station to inspect it; overlapping objects open a chooser.
Use the shared time slider or a ship's activity lane to scrub. View selects Top, 3D,
Front or Side. In 3D, drag to orbit and Shift-drag (or right/middle-drag) to pan; the
Orbit/Pan button changes the default gesture. Top drags pan. Scroll zooms at the
pointer. Frame or View from here changes the physical reference frame while keeping
the camera orientation. Space pauses; F fits; T returns overhead. Focus the canvas
and use arrow keys to orbit, Shift-arrows to pan. Layers includes a clear view. Replay explicitly rewinds the finite set.

Cargo, propellant, docking and burns come from the simulation ledger. The model details
are available under About this set. These scenes use normalized fictional systems,
impulsive or finite-thrust test ships, and prescribed massive bodies; they are not real mission replays.

## Verify and author sets

```sh
npm run build
npm run test:sim
PLAYWRIGHT_PREVIEW=1 npm run test:browser
npm run evidence:model-set
npm run evidence:spatial
npm run evidence:lunar
npm run evidence:propulsion
npm run evidence:traffic
npm run evidence:surface
npm run evidence:landing
npm run evidence:surface-traffic
npm run evidence:spatial-viewer
npx tsx scripts/spatial-viewer-fixture.ts --check
npx tsx scripts/model-set-fixtures.ts --check
uv run --project spikes/numerics --group dev --group plots pre-commit run --config spikes/numerics/.pre-commit-config.yaml --all-files
```

[3D viewer evidence](docs/evidence/spatial-viewer.md) and its
[camera contract](docs/design/spatial-viewer.md) cover orthographic controls, body
occlusion, unchanged physical frames and independent noncoplanar maneuver checks.

[Continuous surface evidence](docs/evidence/continuous-surface.md) and its
[reviewed contract](docs/design/surface-service/README.md) cover recurring launch/landing,
shared resources, rolling close-view history and measured bounds.

[Surface ascent evidence](docs/evidence/surface-ascent.md) and its
[Astra-reviewed contract](docs/design/surface-ascent/README.md) cover supported pads,
atomic powered launch, finite-thrust insertion and orbital cargo handoff.
[Surface round-trip evidence](docs/evidence/surface-landing.md) and its
[Astra review/disposition](docs/design/surface-landing/README.md) cover paid landing,
return service, backward scrubbing and close drawing accuracy.

[Continuous traffic evidence](docs/evidence/continuous-traffic.md) and its
[Astra-reviewed architecture](docs/design/continuous-traffic/README.md) cover the rolling runtime.

[Current direction and architecture](docs/model-set.md) records the viewer contract
and accepted scope. [Spatial evidence](docs/evidence/spatial-foundation.md) covers
the 3D engine; [lunar freight evidence](docs/evidence/lunar-freight.md)
covers the initial lunar set; [bounded propulsion evidence](docs/evidence/bounded-propulsion.md)
covers the powered trips, acceleration caps and deterministic fuel/depletion model. [Prototype evidence](docs/evidence/model-set.md) records the original
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
