# Moving Selene ground sortie

Scene: **Selene · Northern ground service** (`fixtures/model-sets/selene-ground.json`). The actual moving Moon supports Northhaven at 20° north. Tern launches to a 20° inclined ballistic Crescent depot, delivers 0.05 supplies, takes a finite fuel top-up and lands back at the pad. Full binary gravity and smooth bounded thrust act throughout. This is a finite prepared scene with optional Replay, not continuous scheduling.

## Numerical and storage evidence

`npm run evidence:moving-selene` records production source bundles, exact event sides, flight samples and independently propagated target comparisons in `moving-selene-input.json`. Inertial DOP853 independently executes both fields, moving pad kinematics, target coasting, thrust and mass flow, inventory operations and paid capture corrections.

| RK4 step | Maximum ship position error | Maximum velocity error | Maximum fuel error | Physical tree nodes | Diagnostic bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
|1/8192|1.83e-12|7.60e-11|4.08e-11|20,067|21,248,470|
|1/16384|1.03e-13|4.87e-12|2.45e-12|28,072|25,012,546|
|1/32768|3.56e-14|1.27e-12|1.42e-12|44,132|32,653,511|

Viewer admission uses the frozen 1/8192 grid and fits the 24 MB preparation ceiling. The finer two runs are offline numerical diagnostics through Runner; they are not admitted viewer scenes at this ceiling. Bytes serialize owned physical data and child ephemerides; they do not measure JavaScript heap.

Production dock/land position errors: 3.17e-13 /3.15e-12; residual velocity corrections 3.55e-11 /4.56e-11 are charged. Return fuel 0.57039098 exceeds 0.1 reserve. Independent replay clearance remains positive, with minimum 1e-6 at supported endpoints. Cargo and total fuel including consumption conserve to numerical tolerance. The ship is exactly carried by the canonical depot during dwell and by the moving pad after landing.

Prepared packet 8.92 MB, 9,876 ship samples. Off-grid drawing errors at the maximum camera scale 1e6 were 0.119 px; Astra's additional midpoint probes found 0.127 px. Canonical physical state is independent of these drawing samples. Baseline preparation and display-accuracy sampling together took about 0.95 s on natto in the recorded run.

## Viewer and regressions

The isolated production browser verifies spatial launch thrust, owning-body local camera scale/normal, inertial/rotating/body/ship frame changes without state changes, actual Crescent delivery, landing with reserve, playback through landing, prepared Replay and switches to the prior lunar exhibit and continuous district. It records no page errors. Screenshots cover full binary overview, local lunar flight, launch and landing.

**220 simulation tests and three production browser tests passed.** Simulation tests cover derived provider rails, analytic derivatives, malformed/version inputs, support overlap rejection, corrected launch threshold, complete cargo/fuel balance, parent+child ownership, immutable fixture data, arbitrary query order and restored snapshots at exact events. The old standalone surface shuttle has a negative provider regression.

Human aesthetic acceptance remains the next gate; screenshots and automated checks establish behavior rather than the owner's viewing preference.
