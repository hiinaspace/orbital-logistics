# Orbital Logistics

A schematic orbital model-set viewer: watch fictional spacecraft carry freight between
stations, scrub their history, and explore the same motion in different reference frames.

## Run

```sh
npm ci
npm run dev
```

The library groups eleven exhibits into Aster–Selene, Orison, Helion–Orison and Sol:
continuous freight networks, staged expeditions, cycler fleets, atmospheric launch,
a quiet lunar loop, inclined transfer, halo insertion and maintained Lissajous motion.
Superseded studies remain in Git rather than the public library.

The root page introduces the project; `/viewer/` opens the workspace and
`/build-log/` contains the owner messages and condensed implementation history.
All three are static Vite multi-page entries. `npm run dev` watches local edits.

## License and publication

Original project code is released under the [Unlicense](LICENSE). Third-party
fonts retain their SIL Open Font License notices; Vite's generated browser helper
retains its MIT notice. The deployed notices are in
[THIRD-PARTY-NOTICES.txt](public/THIRD-PARTY-NOTICES.txt). Build/test dependencies
retain their individual licenses and are installed from the lockfiles.

See the [publication review](docs/publication-review.md) before exposing the
development repository's history. Raw review bodies have been removed from the
current tree, but older commits contain unrelated private context. A clean source
snapshot can be released while retaining that development history privately.

Choose one or two views from the header. Overview + Chase, Inertial + Rotating, and
Top + Front share one simulation clock. Each pane has independent selection,
reference frame, camera and Display settings; click or focus a pane to make it active.
The object inspector and timeline selection follow the active pane. Follow/Chase locks
its target until Track selected is chosen again. Wheel zoom does not change which
pane owns the inspector. Drag the divider, stack the panes, or maximize either view.

The bottom ruler and activity lanes seek the same time. Play/pause, textual time,
bipolar playback speed, Live and finite Replay are in that player. Collapse the lanes
to keep just the ruler; drag its top edge to resize them. Continuous scenes hold
history while paused/scrubbed; Live returns to the head. Restart starts a fresh run.
The speed range and recommended starting speed depend on the exhibit.

In 3D, drag to orbit and Shift/right/middle-drag to pan. Top drags pan. Scroll zooms
at the pointer. Space pauses, F fits and releases tracking, T returns overhead;
focused-canvas arrows orbit and Shift-arrows pan. Camera contains the deliberate
Surface/Entry preset. Display groups paths and trail length, labels/occlusion and
supported field/relief/atmosphere options. Cargo, fuel, docking and burns come from
the simulation ledger; optional About contains the set's model and provenance.

See [workspace architecture and validation](docs/evidence/viewer-workspace.md).

Atmospheric entry [model](docs/design/entry/model.md) and [validation](docs/evidence/entry.md) document the finite exhibit.

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
npm run evidence:steering
npm run evidence:stationkeeping
npm run evidence:maintained-service
npm run evidence:lunar-service
npx tsx scripts/stationkeeping-fixture.ts --check
npx tsx scripts/steering-fixture.ts --check
npx tsx scripts/spatial-viewer-fixture.ts --check
npx tsx scripts/model-set-fixtures.ts --check
uv run --project spikes/numerics --group dev --group plots pre-commit run --config spikes/numerics/.pre-commit-config.yaml --all-files
```

[Continuous lunar ground-service evidence](docs/evidence/lunar-service.md) and its
[Astra-reviewed contract](docs/design/lunar-service/README.md) cover moving-body launches,
actual ballistic targets, online six-state solves, paid returns and bounded rewind.

[Continuous maintained-service evidence](docs/evidence/maintained-service.md) and its
[Astra-reviewed contract](docs/design/maintained-service/README.md) cover online
corrections, actual-target paired visits, retries, paid fuel and bounded history.

[Stationkeeping evidence](docs/evidence/stationkeeping.md), the
[Astra-reviewed contract](docs/design/stationkeeping/README.md) and
[tracking camera contract](docs/design/camera-tracking.md) cover paid relay corrections,
actual-target rendezvous, Follow/Chase and selected-object orbiting.

[Smooth steering evidence](docs/evidence/smooth-steering.md) and its
[command/authoring contract](docs/design/smooth-steering/README.md) cover continuous
physical heading, finite spatial transfer and optional see-through bodies.

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
editor/puzzle milestones as history. The root now introduces the project and
`/viewer/` opens the workspace. The previous CoaDE-style editor is retained in the
private development history. Its pure
simulation/planning helpers and regression checks remain available for fixture authoring.

The [recovered Fable consultation](docs/design/orbital-model-set/README.md) and
[Codex synthesis](docs/design/orbital-model-set/synthesis.md) explain the change in
product direction. Earlier [topology](docs/design/topology-study/proposal.md) and
[periodic-service](docs/design/periodic-transfer/proposal.md) studies remain reference
material. The upstream repository remains private; production deployment is pending.

Published hobby identity: Hiina <hiina@hiina.space>.
