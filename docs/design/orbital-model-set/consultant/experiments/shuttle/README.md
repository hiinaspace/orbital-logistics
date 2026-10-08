# Two-tug shuttle overlay through the app's own Runner (consultant witness, 2026-10-07)

**Question.** If a "model set" is shown as an *overlay* of independent single-ship
runs (the cheapest multi-ship viewer), is that honest for a staggered shuttle service?

**Setup.** The accepted M4 "patient" program (`fixtures/m4-patient-solution.json`,
Home r=1 → Depot r=1.4 → Home) is flown by tug 1 unchanged and by tug 2 shifted by one
synodic period S = 15.853883 (same relative geometry). Both run through the unchanged
canonical `Runner` with horizon 64. Each run assumes the full port stock, because the
Runner is single-ship. The script then merges both ledgers in time order against ONE
shared stock per port, which is the check an overlay viewer must do offline before it
may claim the ships share a world.

**Result** (`results.json`). Both tugs complete (`horizon`), each delivers 0.2 and
returns docked at Home with the same fuel use (0.131404). Tug 2 departs 16.354, is home
35.481. No shared-stock contention occurs: Home cargo 1 → 0.6, Depot fuel 0.25 → 0.05.
A third refuel visit would over-draw Depot fuel (0.25 − 3×0.1 < 0), so a three-trip
service on this fixture is **not** honestly representable by independent runs; it needs
either a shared-stock fleet runner or a scene with more stock.

**Not shown.** No joint simulation, berth occupancy, or ship-ship interaction; no new
oracle (reuses the calibrated M4 dynamics). This says nothing about fun.

**Reproduce** (repo root, ~10 s):
`npx tsx docs/design/orbital-model-set/consultant/experiments/shuttle/fleet-overlay.ts`
