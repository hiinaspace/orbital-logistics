# Finite staged launch and recovery

2026-10-09, natto checkout. Owner authorized a finite airless launch/recovery exhibit
before repeated service. **Selene · Launch & recovery** is available in the model-set
selector at localhost4178. Launch at .3, separation at .7840092895528833, booster
landing at1.7631341277606114, courier arrival at1.9296407559406652, unloading complete
at2.229640755940665; finite display ends at4.

A verified `gpt-6-astra`/`xhigh` read-only CLI architecture review preceded integration.
See [brief](../design/staging/brief.md), [review](../design/staging/astra-review.md)
and [disposition](../design/staging/disposition.md). The primary agent adapted the
suggested grid restriction to an explicitly retained thrust-end checkpoint, checked
against Runner node/event/snapshot behavior and canonical branching assertions.

## Physical evidence

`npm run evidence:staging` replays the complete assembled launch and both children
at h=1/512,1/1024,1/2048. The separate DOP853 replay integrates its own parent state
and derives child seeds/fuel from that result. It never uses production child states
as initial conditions. Tight versus regular DOP853 is also compared. Maximum sampled
6D state error falls from4.17e-10 to1.65e-12; finest fuel difference1.35e-13.
Every retained free-flight interval passes unchanged collision certification.
Production/oracle paid-capture residuals fit the original1e-7 envelope with ample
numerical allowance. No free velocity match or target teleport is introduced.

Initial stack mass2.5 includes booster dry.3, courier dry.25, freight.1, lower-stage
fuel1.55 and reserved upper fuel.3. Separation wet mass1.6933178507451945 conserves
momentum at common velocity. Booster owns the actual.7433178507451944 fuel remainder;
courier keeps.3. End fuel is.14022121197/.13782435714, freight.1 is in Lantern, and
Cairn/Lantern each have one occupied berth. Physical account queries preserve total
freight and all fuel plus consumption before/at/after separation, service and rewind.
Retired assembly histories are not additional resource owners.

[Oracle report](staging-oracle-report.json), [input](staging-oracle-input.json),
[display report](staging-display-report.json), [frozen witness](../design/staging/witness.json)
and authorship scripts are retained. The bounded offline shooting script authors
controls and target phase once. Runtime only executes the admitted witness.

## Viewer and regressions

The three display segments contain about14,800 samples total. At quarter/mid/three-
quarter points of every free-flight display interval,16,077 checks give maximum
position interpolation error1.09e-7 R, or.109px at the allowed1e6px/R zoom. Packet
size is about6.62MB, under the12MB bound. Canonical physical nodes are separately
bounded at40k; display samples at40k aggregate and20k per segment.

Production Chrome checks cover one assembled glyph before separation/two after,
absent reference options and inspectors, exact event jump, Follow/Chase retirement,
path clipping in a newborn-centered frame, visible future whiskers, delivery/landing,
rewind and fixed/continuous/fixed switches without browser errors. All176 simulation tests and17 distinct production Chrome checks pass, including
existing viewer, tracking and stationkeeping checks. The final staging checks were
repeated after manifest validation and inherited booster usage were tightened. Numerical tests cover strict tank/
manifest/version/conflict rejection, failed-child admission, inherited seed parity,
mission resource accounting and canonical snapshots/query partitions.

Commands: `npm run build`; `npm run test:sim`; `PLAYWRIGHT_PREVIEW=1 npx playwright test
 tests/browser/staging.spec.ts tests/browser/viewer.spec.ts tests/browser/tracking.spec.ts
 tests/browser/stationkeeping.spec.ts`; `npm run evidence:staging`; configured numerics
Ruff-format/lint/ty hooks. [Launch screenshot](staging-launch.png),
[recovery screenshot](staging-recovery.png). Screenshots/headless probes establish
runtime/readability evidence; the owner's subjective viewing gate remains.

This slice does not implement repeated launches, turnaround refuelling, atmosphere,
contact geometry, attitude dynamics, separation kicks, multibody surface operations
or station-network handoffs.
