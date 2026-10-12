# Later-pass cycler fleet

Accepted design direction implemented as **Aster–Selene · Cycler fleet**. This is
a finite four-vehicle exhibit, separate from the accepted single-carrier set.
Pipit rides Wayfarer out and Nomad back; Wren makes the reverse exchange. Both
carriers remain unpowered throughout all 224.014027 time units.

Pipit lands at Haven at 73.5, waits until 120.252338, reaches lunar parking at
121.502338, coasts to 132.252338 and boards Nomad at 136.252338. It leaves Nomad
at 143.752338 and lands at Cairn at 163.011689. Wren's corresponding phases are
60.252338 later. The lunar surface dwell is 46.752338 units; parking lasts 10.75
units, about 1.6 retrograde laps. The earlier Aster parking choreography remains.
Haven never has overlapping occupants; Cairn explicitly has two ground berths.

A twelve-candidate bounded search selected the lower-cost successful connection.
The original ascent was 0.842684 Δv, not the early brief's approximate 0.736.
Ascent remains 0.842684, but the new two-pulse connection costs 0.318923 rather
than 0.861004. Complete lunar departure therefore falls from 1.703688 to
1.161607 Δv (about 32%). This is a witnessed aesthetic improvement, not a claim
of optimality or carrier necessity. Full outbound/return costs and every landing
reserve are admitted, not just the final connection. Native/independent reserves
are about 0.491105 at Haven and 0.550452 at Cairn.

## Numerical gates

- Independently replayed DOP853 source SHA256:
  `958951f03901533c9243f283beb88b8ad73e45deaba6ba8f5e351b5dac88c749`; 1,225,675 bytes.
- Independent fixture replay was byte-identical. Native STEP=1/512; 329,508 advances / 329,516 enclosure checks
  within pre-reserved 360k/600k production allowances. Every free-flight interval
  uses the unchanged moving-body safety enclosures.
- Independent agreement: position 1.17e-09, velocity
  1.41e-09, each below 1e-8. h/2 and h/4 full-horizon
  calibrations agree in final physical states and fuel accounting below 1e-8.
- Eight paid captures: actual target queries use exact native carrier nodes;
  position and velocity errors each plus 1e-8 allowance remain below 1e-7.
  All four landings retain at least 0.3 fuel.
- Four deliveries consume 0.6 cargo; explicit imports provide 0.6 cargo and
  9.916886436 fuel. Final rider tanks are 3 each,
  carrier tanks 6 each; Replay queries rewind the same anchored ledger.
- Native quarter-probe drawing refinement retains event sides/control knots;
  independent drawing comparison gives maximum position 3.4e-07,
  velocity 9.18e-06. Probe gates are 1e-6 / 1e-5. This does not
  promise arbitrarily magnified interpolation accuracy.
- Drawing sample counts: 9,197; conservative JSON reply
  12,644,763 bytes, below the unchanged 16MB ceiling.
- Negative fixtures reject unknown/wrong carriers, same-carrier return,
  unsupported versions/fields, carrier thrust and unfunded ground reloads.

## Browser / visual gates

Production Chrome at 3840×2160 played the complete finite mission at 16× with
no page exceptions. Draw p95 10.6ms, maximum
18.2ms; frame-gap p95
16.8ms, maximum
33.5ms. These are this machine's observed
figures, not a general performance guarantee. Scrubbing both carrier exchanges,
reverse playback, Top/3D, inertial/lunar/rotating frames and switching back through
the original cycler and full system all passed. Original cycler browser regressions
also passed. Reviewed captured overview and close lunar parking images.

Browser harness correction: HTML range step=.001 rejects arbitrary sub-step
`fill()` values; boarding checks now choose the next millisecond. This was a test
input failure, not a physics or viewer failure.

All 33 targeted simulation/regression tests passed; the new browser test and both
original cycler browser regressions passed. Build, Ruff and ty checks passed.

Raw evidence: [numeric](cycler-fleet-numeric.json),
[drawing](cycler-fleet-drawing.json), [browser](cycler-fleet-browser.json).
Design/review: [README](../design/cycler-fleet/README.md),
[Astra disposition](../design/cycler-fleet/disposition.md).

Finite stability is certified only through the admitted horizon. No indefinite
free-carrier repetition, continuous dispatch, state resets or scene-level modulo
replay were introduced.
