# Beacon relay

The accepted Crossings exhibit remains available. **Aster–Selene · Beacon relay**
adds one station beyond Selene and a shorter lunar courier route to the existing
Odyssey, Argosy and Wren activity. The new `libration-service-v1` domain composes
the unchanged expedition fleet with one compiled Kestrel round trip.

## Station provider

Aster is fixed and Selene follows its existing prescribed circle; this field is
not the barycentric circular restricted three-body problem. Beacon is the outer
collinear equilibrium of the actual rotating equations, obtained from

`n²x − μA/x² − μS/(x−R)² = 0`, with `x > R`.

The admitted radius is 6.123129239772423. Its existing circular-rail provider uses
Selene's rate and phase. Gravity supplies the rail acceleration, including while
Kestrel is attached: no station impulses, tank reset, hidden station propulsion or
online controller is needed. Admission checks the actual force residual, field,
basis, rate, phase, support geometry and identities. Ordinary Runner logistics
schemas are unchanged; they do not admit this multi-body circular target.

This is an ideal, unperturbed equilibrium reference, not a simulation of real
stationkeeping or a claim of stability. A reference orbit with drift remains a
separate option. Astra's optional actual-field L1 Lyapunov probe demonstrates a
closed loop and records a candidate for that later slice; it is not the provider
used in this exhibit. [ESA's account of libration orbits](https://www.esa.int/Enabling_Support/Operations/Angelic_halo_orbit_chosen_for_humankind_s_first_lunar_outpost)
describes rotating lunar orbits and stationkeeping. [NASA's orbit API](https://ssd-api.jpl.nasa.gov/doc/periodic_orbits.html)
provides periodic families for its stated CR3BP systems, which cannot be copied
directly into the different field used here.

## Courier witness

Haven is a separate synchronous far-side lunar pad. Kestrel carries 0.15 parcels,
dry mass 1, propellant 6, exhaust velocity 4 and an engine with force cap 16 and
acceleration cap 1.2. The exact authored recurrence period is 32.

| Local epoch | Operation |
| --- | --- |
| 1 | Launch from Haven |
| 11 | Paid capture at Beacon |
| 12 | Unload; relay consumes the 0.15 delivered parcels |
| 14 | Release from Beacon |
| 24 | Paid landing at Haven |
| 30 | Ground imports/debits the measured fuel deficit and 0.15 new parcels |

Four smooth finite-thrust arcs and two coasts use the unchanged canonical Runner
at h=1/2048 under both bodies' actual gravity. The supported release must accelerate
outward. Capture miss and residual velocity plus numerical allowances must fit
the original 2e-6 gates; residual velocity is paid at each capture. The complete
vacuum legs retain the atmospheric exclusion shell and continuous clearance guards.

The offline outbound solve uses independent DOP853 propagation. Its return is
derived by rotating-frame time reversal and reflection about the planet–Moon line.
For constant capped acceleration, inertial return steering is
`θreturn(t) = n(outArrival + returnDeparture) − θout(u)`, where time u runs backward.
This produces a mirrored coast and gentle terminal landing. Different cargo and
fuel masses change force and fuel consumption but preserve capped acceleration.
Production still recompiles and admits both legs; the symmetry is a seed, not a
bypass of safety or capture checks.

The exact period and synchronous pad/station allow global recurrence by rotation
n·index·32. Body rails keep advancing. Indexed event epochs restore canonical
local boundaries without epsilon snapping. Kestrel's own pad and Beacon each have
one berth and one visitor; they do not share the expedition's Tranquility berth.

## Resources and publication

One composition owner advances the existing fleet and courier facts together.
Due courier unload/refill events are preflighted before advancing the underlying
fleet. Imported ground supplies are assigned to Kestrel; each relay delivery is
explicitly exported/consumed. Station/depot stocks remain zero after transactions,
rather than resetting a finite inventory at each loop. The 30-unit turnaround
restores the exact cached departure loadout. Fuel used and import/export counters
remain cumulative through history eviction.

The worker publishes one template per compiled mission and only newly prepared
global courier strips thereafter. Frontend missing-strip access fails; it never
propagates or rebuilds a physical trajectory. Historical endpoints, activity,
mass, captures and resource anchors survive the one pending held-head reply.
The original 128-unit history and 32-unit committed lead, Pause/Play/Live,
physical frames and 0.1× initial viewer speed remain.

The admitted period 32 divides the million-unit calendar. A shared final-cycle
selector excludes the right-hand cycle past that endpoint while retaining the
true after-state at epoch 1,000,000. Old schemas and sets retain their behavior.

## Work and storage

The courier has independent 50,000-node/20 MB physical-cache guards and a 2 MB
drawing-template guard. Combined physical ownership is capped at 165,000 nodes
and 60 MB, including live Wren chunks. A courier strip is at most2 MB/4,000 samples;
each worker/frontend courier owner is bounded to 12 MB/24,000 samples and at most
seven retained strips including a held pending reply. Each combined drawing owner
has an 84 MB ceiling; frontend assembly also checks its sample bounds. Resource
anchors are bounded to 22 in the worker and 24 while held in the frontend.

Initial packets are capped at 36 MB, warm packets at 16 MB. The underlying fleet's
guards remain active. Counters measure serialized structures, not heap size:
both processes' templates, separate strip caches, assembled views and a pending
structured clone coexist. No new live targeting or correction loop is introduced.

[Review](astra-review.md) and [evidence](../../evidence/libration.md) retain the
numerical, source, rollout and browser gates.
