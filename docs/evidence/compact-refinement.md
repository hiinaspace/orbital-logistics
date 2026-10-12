# Compact cycler morphology refinement — 2026-10-12

The user rejected the v1 viewing gate: its taxis used continuous powered curves and
Wayfarer's eight-unit Beacon burns felt substantial. The field's masses, radii and
separation were actually identical to the expedition set. This refinement changes
orbit/timing/control morphology, without needing a field change. Human acceptance of
the revised aesthetics remains open.

Wayfarer now passes within2.171 Aster radii and coasts64 of74 units (86.5%). Departure
and Beacon arrival each take4 units. Every Pipit leg has literal unpowered coasting,
and the ground longitude/earlier boarding bring the Aster connections closer.
The label is simply **Wayfarer**.

| Direction | Independent flight | Aboard carrier | Encounter geometry |
| --- | ---: | ---: | --- |
| Haven → Cairn |6.5|7|Moon boarding distance1.122; Aster release radius2.997|
| Cairn → Haven |7.5|40|Aster boarding radius3.198; Moon release distance2.245|

This is directional evidence, not just an aggregate aboard-time score. The first
refinement boarded at radius4.81; Astra flagged that as still spanning much of the
system, prompting the tighter candidate. These are still schematic ground connections,
not proofs of minimum cost or a carrier's mathematical necessity.

Pipit launches6→9, rides9→16, lands16→19.5; unloads/refills19.75/20;
launches21.5→25, rides25→65 and lands65→69. It delivers two .15 parcels per cycle.
Taxi coasts last1.5,2,2,2 units. New profile-v2 groups fifteen contiguous native
segments into the same seven ownership stages. Each segment continues from the actual
previous endpoint; capture/release targets remain exact canonical carrier nodes.

Restore the original exhaust velocity4, with unchanged tanks/dry/cargo and reserves.
Half-trip delta-v3.1266/3.3672 replaces5.7359/5.1067; final shuttle fuel.749/.638
exceeds.3. Carrier fuel2.787 exceeds.6. Shorter burns use stronger caps: carrier.6/6
acceleration/force instead.15/1.5; shuttle4/16.6 instead3/12.45. Actual shuttle
Bernstein acceleration bounds≤3.614. This is an explicit engine revision, not hidden
free propulsion. Carrier delta-v1.5504 is **higher** than v1's1.0718: maintenance
is shorter, not proven cheaper. Paid Beacon support/resupply still closes the loop.

## Verification

- Fresh coupled independent DOP853 replay of all fifteen frozen controls agrees with
  the production canonical execution; Native44052 nodes/44072 enclosure checks,
  ~799KB template and430824-byte source profile.
- Maximum oracle position disagreement5.12e-12, velocity5.61e-9, both below1e-8.
  Three-resolution endpoint disagreement7.72e-12; late absolute epoch error2.46e-10.
  Exact canonical nodes, paid capture margins, continuous body clearance, force/
  acceleration caps and fuel reserves pass.
- Nine compact tests include directional geometry, four literal zero-thrust/fuel-flat
  coasts, two-cycle resource closure,2048-unit rollouts, pause-boundary retention,
  faults and actual legacy-profile compatibility. Camera/attitude/Solar regressions
  bring the retained run to22 passing tests.
- Production Chrome finite whole cycle and continuous16× at3840×2160, held scrub,
  reverse/Live and switching among fixed/service/Solar/full-Aster sets: both browser
  tests pass without page exceptions. Own review inspected five key screenshots
  in inertial and rotating frames. No human taste acceptance claimed.
- Final profile: draw p95 8.2ms, frame-gap p95 16.8ms/max50ms, worker turnaround
  p95 17.4ms/max130.3ms. Three carrier returns/seven deliveries in the bounded
  browser sample;3 retained drawing cycles/13926 samples/~6.63MB. Largest numerical
  warm packet2.22MB; unchanged16MB publication/12MB registry/128-time budgets.

[Native/regression log](compact-refinement-sim.log),
[browser log](compact-refinement-browser.log),
[profile](compact-refinement-browser.json),
[fresh independent replay](../design/compact-cycler/refinement/replay.log).

[Moon connection](compact-refinement-launch.png),
[carrier coast](compact-refinement-coast.png),
[Aster landing](compact-refinement-aster-landing.png),
[Aster launch coast](compact-refinement-aster-launch.png),
[Moon return](compact-refinement-moon-return.png).

## Search and reviews

Bounded full-field coast screening found the closer branch. A two-pulse attempt that
intersected Aster and colliding/over-cap local candidates were rejected. A nine-stage
homotopy from paid forward full-thrust controls to literal zero middle controls found
usable local transfers; endpoint controls were corrected at every stage. Only the
final frozen controls feed the independent replay and native safety admission.
Source/inverse curves are not physical trajectories or safety certificates.

Astra first identified a v1 protocol leak and insufficient directional evidence.
V1 now retains its exact seven singleton/control-presence/zero-phase contract; the
real original profile is retained as a byte-identical regression fixture. Expanded
segments require v2. Tighter handoffs and explicit geometry assertions address the
second finding. Follow-up reproduced both fixes and the independent replay, with
no remaining blocker in scope. [Disposition](../design/compact-cycler/refinement/disposition.md).

The field remains a fixed primary/prescribed moon, airless synchronous supports and
paid schematic captures; it is a powered serviced loop, not a demonstrated optimal
natural Aldrin cycler. Runtime cache symmetry, ownership, accounting, fault/publication
and rolling playback semantics remain unchanged. [Current contract](../design/compact-cycler/README.md).
