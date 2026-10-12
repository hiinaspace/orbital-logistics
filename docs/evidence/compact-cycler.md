# Historical compact cycler v1 evidence — 2026-10-11

Implemented finite **Aster–Selene · Cycler** and continuous **Aster–Selene · Cycler
service**, alongside the unchanged Solar-scale witness. Own finite viewing/numerical
gate passed before continuous acceptance. The owner subsequently rejected this morphology;
[current refinement evidence](compact-refinement.md) supersedes this viewing gate.

The display shares one overview for the carrier's wide free flight and the parcel
shuttle's four local powered legs. Default.5×; a72-unit cycle takes144 wall seconds.
The carrier is ballistic for75% of the whole cycle. Other speeds, inertial/rotating/
body/ship frames, 3D controls, signed playback, trails, fuel/freight timelines and
surface zoom remain available. Two deliveries per cycle, plus an explicit Beacon
turnaround, provide actual recurring operations.

## Independent and canonical gates

- Production native RK4 full coupled cycle:47,121 nodes/47,138 enclosure checks;
  approximately904KB drawing/control template. Whole profile252,231 bytes.
- Independent DOP853 oracle comparison: maximum native position1.7994e-11 and
  velocity4.7674e-12. Three-resolution endpoint difference1.4215e-11.
  Delta-v primitive also compared within1e-8; using scalar Hermite rates avoids a
  false discrepancy from linear interpolation of the primitive.
- Early and near-epoch1e6 controls replayed in absolute field time, with all inertial
  vectors rotated once. Worst late six-state difference1.4808e-10, below1e-8 allowance.
  The final partial calendar cycle is clipped before1e6.
- Five captures pass separate position/velocity residual+1e-8<1e-7; residual speed
  plus allowance is paid. Canonical event targets never use drawing interpolation.
- Complete powered clearance enclosure, acceleration/force Bernstein bounds, C1
  cubic joins and supported launch/landing margins admitted; malformed control,
  field, model and oracle fixtures reject.
- Final carrier fuel4.7461; shuttle first/second half-trip fuel.8761/1.0419, exceeding
  .6/.3 reserves. Total fuel expenditure per cycle1.253896 carrier +4.081985 shuttle.
  Half-trip delta-v5.7359/5.1067. Explicit exhaust8 revision follows rejected exhaust4
  candidate, with unchanged masses/tanks/caps.
- Two-cycle fuel and cargo conservation, rotated six-state/support/tank closure,
  carried mass and paid event sides pass.2048-unit rollout retains≤3 observed drawing
  cycles, cumulative counters and≤128 total time units. Largest warm publication
 3,716,148 bytes, below16MB. Resource retention is event/window based, independent
  of the number of fractional requests.
- Import shortage and failed capture stop before the operation, exclude future
  supported success and halt the dependent pair. Oversized publication leaves the
  prior published head/resources/drawing intact and refuses further work. Malformed
  frontend admission similarly leaves prior visible backing intact.
- Astra reproduced held reply111→112 dropping the row starting144. Fixed retention
  preserves that bounded incoming row; exact regression verifies both Live and the
  subsequent reply, alongside ordinary held history and reverse queries.

Reproduce numerical tests with
`node --import tsx --test tests/sim/compact-cycler.test.ts`.
[Final numerical/regression log](compact-sim.log),
[independent producer output](../design/compact-cycler/compile.log).
Ruff format/lint and ty configured pre-commit hooks pass for the producer and retained
bounded authoring studies. Build/typecheck and source diff checks pass.

## Production browser

Headless production Chrome on natto,3840×2160, continuous16×, through at least three completed
carrier circuits/eight deliveries (final rerun). No page exceptions, halt or worker error.
Held scrub, reverse, Return to live, fixed/service/Solar/full-Aster set switching pass.
Finite full-cycle playback and five key epochs pass in inertial and rotating views;
main inspected the generated screenshots. Three browser tests pass, with the separate
Solar performance opt-in skipped; this new set's performance was measured directly.

| Bounded measurement | p95 | maximum |
| --- | ---: | ---: |
| Draw |9.6ms|19.6ms|
| Worker turnaround |18.5ms|224.6ms|
| Ingestion |.2ms|32ms|
| Frame gap |33.3ms|83.3ms|
| Drawing-history refresh |6.4ms|10.8ms|

[Profile and counters](compact-browser.json), [browser log](compact-browser.log).
This is one desktop measurement, not a universal16× throughput guarantee.
The normal overview speed is intentionally slower to keep the local trips visible.

[Haven launch](compact-launch.png), [carrier coast](compact-coast.png),
[Cairn landing](compact-aster-landing.png), [Cairn launch](compact-aster-launch.png),
[Haven return](compact-moon-return.png).

## Limits

Fictional fixed-primary/prescribed circular moon, synchronous airless pads,
acceleration-commanded finite controls and schematic paid capture. It is not an
unpowered Aldrin cycler, optimal mission, generic online scheduler, self-consistent
massive-body N-body, rigid-body lander or atmospheric scene. Prepared display
interpolation is disposable. Explicit supply/consumption supports this exhibit's
recurrence, not a manufacturing economy. Continuous replay is admitted only for
this field/profile's exact symmetry, with bounded calendar1e6 and96 past +32 lead.
Sun/Mars/Jupiter analog remains the next separate model/content gate.

[Contract](../design/compact-cycler/README.md),
[Astra dispositions](../design/compact-cycler/disposition.md).
