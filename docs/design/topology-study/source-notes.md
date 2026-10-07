# OpenTTD source study — 2026-10-07

Scope: official documentation, developer explanations, and a shallow sparse source
checkout. No OpenTTD build or gameplay session was performed. UI findings below
come from widget/drawing definitions, not a hands-on usability test.

Source snapshot: OpenTTD master
[`eb15dc514ad48fdc3d80ef6f2005aadfde499b67`](https://github.com/OpenTTD/OpenTTD/tree/eb15dc514ad48fdc3d80ef6f2005aadfde499b67),
dated 2026-10-07, subject “Codechange: use ScreenToAnimationBuffer in the 40bpp
blitter as well”. This is a development snapshot, not a claim about released 15.3.
The temporary checkout under `.scratch/openttd-design/source` was removed after
inspection; these pinned links preserve provenance without vendoring source.

## Separate three networks and two authoring views

| Layer | Verified implementation / UI | Gameplay interpretation for this project |
| --- | --- | --- |
| Physical infrastructure | Rail paths reserve track pieces and station platforms; airports also reserve blocks for landing and ground movement. | Players can create or provision bottlenecks. Aircraft avoid constructed corridors, but do not eliminate endpoint capacity. |
| Vehicle services | Orders name stations, loading/unloading behavior, depot actions and conditions. Vehicles can share an order list. | A service is an authored itinerary and operating policy, not just an individually drawn path. |
| Cargo flow | CargoDist derives candidate service links/capacities from vehicle orders and routes demand over those links. | The player offers a network; cargo assignment can be automated without automating network design. |
| Orders window | A directive list, with separate load/unload/depot controls and a button opening the timetable. | Itinerary/policy can remain understandable without an exact global clock program. |
| Timetable window | Travel and waiting durations, measured autofill, lateness, optional scheduled/expected arrival/departure display. | A diagnostic and regularity layer over services. It is not the source of all transport gameplay. |

Pinned implementation references:

- [Orders UI](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/order_gui.cpp#L1297):
  timetable is a related window; shared orders and the order drawing logic are in
  the same source. [Order commands](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/order_cmd.cpp#L1248)
  validate loading/depot policies, including incompatible unbunching combinations.
- [Timetable update](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/timetable_cmd.cpp#L467):
  records actual elapsed order duration, supports autofill and updates lateness
  against scheduled duration. [Arrival/departure table](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/timetable_gui.cpp#L127)
  accumulates known travel/wait times; later UI chooses scheduled versus expected.
- [Link refresh](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/linkgraph/refresh.cpp#L181):
  visits order-linked stations, capacity, loading restrictions and estimated travel
  time. This is not exclusively a graph learned from completed trips.
  [Cargo path search](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/linkgraph/mcf.cpp#L265)
  considers capacity/saturation and distance or time.
- [Station cargo view](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/station_gui.cpp#L1296):
  groups by source, next hop, estimated destination and cargo, and distinguishes
  waiting cargo from planned flows. This is a cargo-centric complement to a
  vehicle's order list.
- [Rail reservations](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/pathfinder/yapf/yapf_rail.cpp#L75)
  and [aircraft landing blocks](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/aircraft_cmd.cpp#L1674)
  provide concrete shared-space constraints.

## Why operate a good service?

OpenTTD has an economic/demand context beyond completing a stop list:

- [Transport income](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/economy.cpp#L955)
  depends on cargo quantity, distance, age and cargo-specific rules. NewGRF
  callbacks can override behavior; this snapshot's exact formula is not a design
  recommendation for Orbital Logistics.
- [Station rating](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/station_cmd.cpp#L3964)
  incorporates pickup delay and waiting goods among other factors; allocation near
  line 4578 uses ratings. Service quality affects more than an arrival label.
- The [official CargoDist manual](https://wiki.openttd.org/en/Manual/Passenger%20and%20cargo%20distribution)
  describes cargo destinations and connections within the offered services.

**Inference:** routes, capacity and regularity have consequences because they
serve demand and compete for vehicles, infrastructure and operating resources.
Transplanting the orders window without those consequences would transplant the
control panel rather than the game.

## Developers deliberately remove some scheduling work

The [unbunching diary](https://www.openttd.org/news/2024/02/10/unbunching) describes
manual spacing as burdensome. Depot-based spacing estimates a departure interval
from shared vehicles' measured round trips; it requires no manual timetable.
Depots were chosen to avoid holding vehicles on occupied roads/rails. This is an
important counterweight to treating every scheduling complication as desirable
depth. Orbital waiting still has to occur on a valid orbit or attached to a port.

The [signals UI diary](https://www.openttd.org/news/2021/11/06/explaining-signals-ui-change)
explains simplifying the presented signal vocabulary while retaining old behavior
for compatibility. The [timekeeping diary](https://www.openttd.org/news/2024/03/23/timekeeping)
separates economy/calendar presentation. Borrow clarity, not independent physical
clocks: our canonical orbital time cannot change with a display setting.

## Contrasts from other primary sources

The consultant's [reference notes](consultant/reference-notes.md) cover Zachtronics,
Factorio train automation, Mini Metro and Rail Route, with sources and inference
separated. Two additional Wube explanations are particularly revealing:

- [Space platforms](https://www.factorio.com/blog/post/fff-381): train-like
  schedules operate a constructed factory. Robots and chests are restricted to
  preserve the local belt/buffering puzzle; repetitive inventory chores were
  simplified. Its depth cannot be attributed to the planet schedule alone.
- [Logistic groups](https://www.factorio.com/blog/post/fff-382): one landing pad
  per planet deliberately creates a logistics junction. Constraints may be
  authored for gameplay, but should earn their place through a useful problem.
  We need not invent orbital traffic lanes simply to copy railway congestion.

For an analytical vocabulary, [Boland et al., The price of discretizing time](https://www.sciencedirect.com/science/article/pii/S2192437620300327)
models service-network design with location/time nodes and transport/waiting arcs.
This suggests a useful *explanatory* diagram: a connection is available at a time,
with capacity and cost. It does not justify discretizing our authoritative
physics or implementing a global optimizer. Orbital edges additionally depend on
velocity, cargo mass, fuel and the chosen transfer family.

## What to borrow

Borrow separate service and execution representations, shared reusable intent,
cargo next-hop visibility, automatic routine operation and bottleneck diagnostics.
Keep numerical astrogation locally assisted while players choose consequential
connections and vehicle use. Do not assume timetabling, repetition, traffic,
manufacturing or open-ended economics is necessary merely because a reference
game contains it. Their value must be demonstrated in a small orbital objective.
