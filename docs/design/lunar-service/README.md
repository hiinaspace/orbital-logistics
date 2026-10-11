# Continuous moving-Selene ground service

Northhaven at 20° north and the inclined ballistic Crescent depot share the existing
moving Selene binary. Tern repeatedly launches, delivers 0.05 supplies, takes fuel
from the depot, and lands. Each new occurrence is solved against the current depot
trajectory; no rotation of an old flight or orbital seam substitutes for dynamics.

## Physical ownership and targeting

LunarWorld owns bounded half-unit canonical depot chunks on the absolute 1/8192
grid. Episode epochs are exact checkpoints on that same global grid. The episode's
v6 target provider starts from an owned checkpoint and uses the same field, clearance
and policy. Admission verifies bitwise agreement at every checkpoint in the lease,
off-grid probes and chunk boundaries. Drawing strips never restart physics.

The narrow trial solver uses a translating, unrotated Moon frame with full binary
gravity and the Moon rail's analytic acceleration. It fits five continuous spherical
steering keys and duration to six terminal coordinates. A phase root, offset by
−0.0005, provides a departure seed; it is not a physical acceptance test.
Finite-difference damped least squares has hard 720-probe and 3-million-stage caps,
including unsuccessful line searches, and yields between probes. Previous accepted
controls provide the next seed.

Every entire trip then runs through the inertial canonical Runner. Collision
clearance, actual mass flow, adjacent steering-turn constraints, finite inventories,
six-state captures, paid correction fuel, landing and the 0.1 return reserve must pass
before the occurrence becomes visible. Failed solves wait for another window.
Invariant/lease/domain failures stop explicitly instead of silently retrying.

Admission pins the binary phases, field, pad geometry, grid, propulsion law and
resource-flow directions required by this narrow solver. This is one curated ship,
not a general lunar route planner.

## Scheduling, resources and history

Planning starts at deterministic ready−0.1 or retry boundaries. A yielded job holds
its simulation epoch; request size and worker budget cannot create retrospective
departures. A 0.1-unit presentation buffer lets the viewer play while this boundary
is being solved. Completed facts enter cumulative counters before history pruning.

Port flows replenish/consume stocks explicitly. Northhaven supplies cargo and fuel;
Crescent consumes delivered cargo and receives external propellant. Capacity clamps
account for exports. The service's departure tank is six and orbital top-up aims at
four; these are service settings, separate from the accepted finite exhibit's top-up.
No occurrence resets shared stocks or accumulated fuel use. A compact completed-ground
checkpoint persists after its trajectory is evicted.

History retains 0.75 units. The view receives immutable depot chunks, admitted trips,
resource anchors and exact event sides. It keeps interpolation brackets and a held
head through one pending reply; Resume releases that retained history. Presentation
uses 65,536 flight samples per unit and 4,096 coast samples per unit. The physical
engines do not consume those interpolated samples.

The validated calendar ends at 64 units (about 107 minutes at the default 0.01×).
The final admitted trip finishes; insufficient remaining planning space closes
admission and leaves the ship attached until the explicit calendar stop. Maximum
viewer speed is 0.02×.

## Budgets

Per-candidate physical allowance: 32 MB and 65,536 owned nodes. The measured aggregate
physical allowance is 40 MB, including a yielded outbound provider and final candidate
before admission. Rejected candidates still enter preparation-peak accounting.
Owned depot allocation is checked before expanding beyond three units.

Retained trips allow at most 60,000 drawing samples. The held view allows 36 MB,
five trips and eight depot chunks. Bytes use UTF-8 serialization of diagnostic
ownership, not JavaScript heap. These are admission/storage gates, separate from
the solver's work caps and from wall-clock performance.

See [Astra review](astra-review.md) and [validation](../../evidence/lunar-service.md).
