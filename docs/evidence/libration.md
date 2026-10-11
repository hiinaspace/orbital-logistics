# Beacon relay evidence

Fixture: `fixtures/model-sets/aster-selene-beacon.json`.

Commands:
`npm run evidence:libration`,
`npm run test:sim`,
`npm run build`, and
`PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/libration.spec.ts tests/browser/crossings.spec.ts tests/browser/continuous-apollo.spec.ts tests/browser/apollo.spec.ts`.

## Physics and recurrence

The actual-field outer equilibrium radius is 6.123129239772423. Astra's independent
analytical probe measures scalar force residual 3.47e-18 and vector residual at most
7.08e-17 across 100,007 epochs through 1,000,000. This is an ideal prescribed-field
equilibrium, not recovery from perturbations or a claim of stable free flight.
Short canonical passive replays agree with the analytical provider within 1e-8.
Independent DOP853 station replays agree to 6.22e-15 at epoch 0 and 2.17e-11 at
epoch 288,000; see [station replay](libration-station-oracle.json).

The single compiled Kestrel round trip uses both gravity sources and four smooth
finite-thrust arcs at h=1/2048. Constant acceleration is capped at 1.2; force remains
below 16. The outbound and return controls give canonical Beacon miss 1.92e-12 and
Haven miss 1.67e-12, with residual velocities below 4e-12. Captures debit residual
fuel under the unchanged 2e-6 gates. The first release accelerates outward; both
vacuum legs retain canonical continuous clearance and planetary air exclusion.

The independent DOP853 courier replay covers first, cycle 17 and cycle 9000 at their
actual global epochs. Maximum state-component errors are 1.85e-12,2.16e-12 and
1.94e-9 respectively; fuel errors stay below 7.83e-10. Both independently propagated
arrival residuals remain below 2e-7, and sampled solid/air clearances stay positive.
The smallest clearance is the authored 1e-5 support height. Production interval
guards provide the continuous clearance certificate. Halving the canonical step
stays within 1e-8 at both arrivals.
See [replay](libration-oracle.json) and [rollout/witnesses](libration.json).

## Resources, ownership and storage

The 640-unit rollout completes 20 courier trips/refills, consumes 3 parcels, and
completes 11 overlapping expeditions. Each courier turnaround imports 2.32121659298
fuel and 0.15 parcels, restoring its exact cached loadout. Beacon explicitly
consumes delivered parcels at the unload epoch. No periodic finite-depot reset is
used. Maximum aggregate fuel imbalance is 1.43e-14 and cargo imbalance 4.45e-16.

The additional physical cache owns 46,817 nodes and 16,981,084 serialized bytes.
Combined physical ownership peaks at 149,215 nodes and 49.45 MB. Combined worker
drawing ownership peaks at 57.31 MB/165,020 samples. Courier retention peaks at six
strips, about 4.50 MB/10,254 samples; ownership remains bounded as old history evicts.
The initial packet is about 28.95 MB; the measured largest warm packet is 8.87 MB.
Worker/frontend drawing owners and the one pending structured clone are distinct;
these counters are not browser heap measurements.

The rollout prepared in 4.48 seconds and finished in 35.07 seconds, including
serialization and periodic frontend assembly. Maximum worker advance/packet time
was 301 ms and frontend view assembly 51 ms under concurrent validation load.
Expensive global strip preparation occurs in the background worker. These Node
figures are supporting work measurements; browser playback is measured separately.

All 240 simulation tests passed. Focused checks were rerun after private-input
ownership changes, and the final provider test passed after explicit ground-stock
admission and short station replay checks. New coverage includes exact indexed
cargo/refill/capture boundaries, late covariance, whole-fleet conservation, berth
occupancy, held-oldest resource/pose preservation, rejected advance without
frontier mutation, unsupported provider/stock rejection, source mutation isolation
and numerical convergence. TypeScript build, Ruff formatting/lint and ty pass.

## Source review and terminal calendar

[Astra review](../design/libration-service/astra-review.md) found no remaining
source blocker after the coordinated terminal-cycle fix. Independent probes
passed 80 exact boundary assertions and 70 terminal-range assertions across 42,725
sample queries. The admitted 32-unit period divides the calendar; the last strip
ends at 1,000,000 without trying to prepare a right-hand out-of-calendar cycle.
Terminal supported state differs across the seam by only 5.15e-11; tank, cargo and
cumulative use match. The bounded source probe does not simulate a million units
of live traffic.

## Browser and visual gate

All four production-browser scenarios passed: finite Apollo, single continuous
expedition, Crossings, and Beacon relay. The new scenario checks Haven launch,
Beacon capture/parcel consumption, landing/refill, repeated trips, selecting the
station frame, 3D/rotating views, held pause, Return to live and switching/reset.

Final measured 16× playback averaged 15.71×, with 425 frames, one 52 ms main-thread
long task and an 83.3 ms maximum RAF gap. No browser exception or simulation fault
was recorded. The earlier run concurrent with simulation tests averaged 15.66×
with one 51 ms long task and the same maximum gap. Both reports are retained:
[final](libration-browser.json), [concurrent](libration-browser-loaded.json).
These are bounded headless-Chrome/host measurements, not an arbitrary-fleet
performance guarantee.

[Launch](libration-launch.png), [docked](libration-docked.png) and
[overview](libration-overview.png) were visually inspected. The user accepted
Crossings before this slice; Beacon's aesthetic evaluation is the next gate.
