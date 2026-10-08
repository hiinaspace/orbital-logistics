# Repeated episode feasibility probe

The retained paid Kestrel powered legs are rotated/time-translated to12 departures:
for each direction, synodic index0/1/3/10/1000/100000. Each candidate starts from its
source's analytical local rail, uses the retained cargo/fuel/engine regime and
rotated headings, and ends in a paid dock. Its finite horizon is rounded up to a
canonical grid endpoint; the actual arrival retains its exact earlier timestamp.
No physics/schema changes were needed. Both legacy and local grids use h1/2048.

`node --import tsx docs/design/continuous-traffic/template-probe.ts` reproduces
[results](template-probe.json). All12 pass safety/horizon/capture, residual+1e-8<1e-7,
including departures past1.07m time units. This establishes the restricted template
strategy, not a runtime scheduler, independent calibration or long-run memory proof.
Full continuous implementation still needs conservation/partition/isolation/soak
checks and independent later-voyage comparison.
