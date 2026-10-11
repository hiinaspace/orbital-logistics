# Continuous expedition evidence

Fixture: `fixtures/model-sets/aster-selene-service.json`.
Implementation: `src/expedition/`.
Commands: `npm run evidence:continuous-apollo`, `npm run test:sim`,
`npm run build` and
`PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/continuous-apollo.spec.ts tests/browser/apollo.spec.ts`.

## Recurrence and accounting

The retained 25-trip rollout reaches epoch 2584. Its one compilation retains
92,153 canonical nodes and 30,151,944 serialized physical bytes. It records 25
completed trips and 25 funded refills; maximum fuel-conservation discrepancy is
1.42e-14. Initial transfer is 7,915,302 bytes; a later packet is 2,322 bytes.
No subsequent optimizer or reintegration is required.

This run measured 3.63 seconds for preparation and 11.53 seconds for preparation
plus the instrumented rollout on natto. A warm head advance took at most 0.225 ms;
a display-cache build/assembly took at most 324 ms. The latter includes rotation,
allocation and serialized retention measurement when a new strip enters the
cache; these are Node measurements, not browser frame-time guarantees.

The display cache plateaued at four cycle strips, 103,178 retained samples and
35,004,714 serialized bytes. The assembled view peaked at 59,334 samples.
Raw counters are in [continuous-apollo.json](continuous-apollo.json).
Simulation regression also rolls beyond 100 periods, queries cycle 9000 and reaches
the explicit epoch 1,000,000 calendar end. It checks strict boundary timestamps,
resource ownership, physical/display agreement, supported turnaround, held history,
budget rejection without mutation and rejection of insufficient supply/symmetry.

## Independent numerical witness

The DOP853 oracle integrates the actual global field at shifted epochs with
rotated controls; it does not shift or rotate the world rails. It pays its own
lunar capture correction, then continues to atmospheric recovery.

| Indexed trip | Maximum state difference | Recovery epoch difference | Recovery state difference |
| --- | --- | --- | --- |
|0|5.324e-5|1.069e-4|2.630e-5|
|2|4.167e-5|8.410e-5|2.017e-5|
|17|2.502e-5|5.218e-5|1.081e-5|

All retain the original 1e-3 whole-mission gate, positive solid/atmosphere
clearance and bounded recovery speed. Lunar position/correction residuals remain
within the 2e-6 local gates. Reports:
[baseline](apollo-oracle.json),
[trip 2](apollo-oracle-cycle-2.json) and
[trip 17](apollo-oracle-cycle-17.json).

Near-surface capture is sensitive to the independent integrator's tolerance.
The older DOP853 tolerances 2e-12/2e-13 at trip 17 produce a 1.190e-3 recovery
epoch difference and fail the unchanged mission gate. That rejected run is
retained in [trip 17, loose](apollo-oracle-cycle-17-loose.json).
Tightening to 3e-14/3e-15 reduces the propagated difference and passes all three
witnesses. Gates and production controls were not relaxed.

## Viewer and review

The production build and all 236 simulation tests pass. Both finite and continuous
Playwright scenarios pass. Continuous playback crosses
three launches, lunar service and atmospheric recovery; rewinds to a previous trip
while later metadata is active; holds its camera/pose through worker replies; and
returns to Live. It checks the planet–Moon rotating frame, close surface/entry
views, hidden ground transport, ship-frame fallback, exact refill and switching
between finite/continuous sets without browser errors.
The retained [second-entry screenshot](continuous-apollo-entry.png) was visually
inspected. These automated checks establish behavior; the user's visual pass
remains the aesthetic acceptance.

[Astra review](../design/continuous-apollo/astra-review.md) has no remaining
source or architecture blocker. It prompted fixes for cross-trip entry queries,
virtual braking whiskers, camera-only transport blending, discrete fuel-chart
samples, retained cache accounting, event identity and final-calendar clipping.
Numerics ruff formatting/lint and ty checks pass.
