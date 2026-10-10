# Low-orbit shuttle comparison

Owner feedback on the direct surface flight identifies a set-design issue:
radius-three routing with an acceleration cap of three produces a short departure,
a long coast, and a sharp rendezvous trim. Full-field propagation does not by itself
make that choreography attractive. The previous cache diagnosis therefore remains
an open comparison, rather than evidence that caching was numerically wrong.

**Orison · Low-orbit shuttle** isolates a different flight family. Crown is a
circular analytical depot at radius 1.4, and Tern's acceleration cap is 1.2
surface gravities. One smooth five-key burn spans each complete flight. Initial
net outward acceleration is about .2 rather than two; gravity stays significant
throughout the climb. Both flights take 1.95176669 time units, with no intermediate
circular interface or coast between departure and capture.

The offline primary-only study compares four radius/cap pairs. All fit the
existing dry mass 1, cargo .05, fuel 6, exhaust velocity 3 and force ceiling 32.
Increasing fuel is unnecessary for this comparison. The selected pair spends
2.34212 delta-v per flight and returns with .42937 fuel. At an acceleration cap,
additional fuel would mainly increase thrust and burn endurance; orbit radius
and acceleration are the useful direct controls on this shape.

The seed is a steering law, not cached flight geometry. Worker preparation
adjusts four steering angles in the full Orison–Mote field, integrating every
trial from its own launch/departure state with normal fuel-dependent thrust.
Final programs replay with the real surface collision boundary and normal
Runner certification. Six-state paid residuals are below 2e-8 and the reserve
must exceed .05. Trial support relaxation is private and never admitted.

The finite surface-shuttle-v1 adapter uses supported pad and analytical depot
attachment between flights. It intentionally does not broaden the maintained
radius-three controller. Its narrow hardware/geometry/calendar contract,
80-evaluation shooting limit and aggregate physical/view limits reject invalid
or excessive preparations. One tank and cargo load persist through both flights;
there is no refuelling. The return family waits for a compatible surface/depot
phase, giving an approximately 11.30-unit dwell. This is a visual flight
comparison, not a new continuous-service scheduler.

Schematic rockets now turn during the last .6 time units of an available coast
(shortened to the actual gap). A deterministic great-circle smoothstep reaches
the next thrust direction at ignition, including exact 180-degree reversals.
Powered orientation and exhaust remain the actual thrust direction; explicit
attitude metadata and surface support remain authoritative. Queries depend only
on mission time, so rewind and paused scrubbing reproduce the same attitude.

Playback starts just before launch at .1x. The original direct and cached service
sets remain selectable. Independent numerical and browser evidence is recorded
[here](../../evidence/surface-shuttle.md). Human burn-shape acceptance remains
pending. No new outside architecture review was run for this bounded comparison.
