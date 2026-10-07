# Primary-source comparison notes

Research date: 2026-10-07. Bounded design consultation; no implementation or
playtest claim. Read the current charter and tactical plan. This study examines
what players author and what automation subsequently executes. **Design
inference** labels identify interpretation or proposals for Orbital Logistics.
Developer descriptions establish mechanics and intent, not proof that any new
combination will be enjoyable. OpenTTD is being studied separately.

## 1. Opus Magnum: the program belongs to an invented physical machine

**Source-backed facts.** Zachtronics describes mechanical components programmed
through a symbol system to manipulate and reconfigure molecules. Its own Steam
description identifies programmable arms and customizable tracks. The product
page emphasizes multiple solutions and improvement toward simpler, faster, or
more compact machines, with animated exports. Sources:
[Zachademics](https://www.zachtronics.com/zachademics/),
[developer Steam description](https://store.steampowered.com/app/558990/),
[Opus Magnum](https://www.zachtronics.com/opus-magnum/).

**Design inference.** The structural choice is which apparatus should exist,
where its parts sit, and how they share work. The timeline choreographs that
apparatus. Choosing another arrangement changes which movements and timings
are useful. The machine carries out the repeated instructions after the player
has built the mechanism. This is a stronger relationship than presenting a
fixed mechanism with several editable departure times.

For Orbital Logistics, “trajectories are moving machine parts” becomes concrete
only if players choose something comparable to the apparatus: a direct route
versus a relay, allocation of vehicles to stages, or a reusable intermediate
orbit. These are candidate interpretations, not existing mechanics. A timeline
could expose their consequences; it cannot provide those choices by itself.

## 2. SpaceChem and Infinifactory: transformation gives transport a shape

**Source-backed facts.** Zachtronics' educator guide describes machines that
assemble and transform compounds, later joined into pipelines. The local
program has two simultaneous threads and includes synchronization. It explicitly
distinguishes the game's direct atom manipulation from real chemistry.
[SpaceChem educator guide, page 1](https://www.zachtronics.com/images/SpaceChem%20-%20A%20Guide%20for%20Educators.pdf).

The developer's Infinifactory description names conveyors, welders, sensors, and
actuators that convert block inputs into more complex outputs. Its product page
invites designing, running, and then optimizing factories.
[Zachademics](https://www.zachtronics.com/zachademics/),
[Infinifactory](https://www.zachtronics.com/infinifactory/).

**Design inference.** Both games give movement a purpose beyond reaching a
destination: the output must acquire a particular internal structure. Component
placement and sequencing determine how that transformation is achieved.
SpaceChem also supplies a second compositional scale: already-working reactors
must cooperate in a pipeline. Routine execution runs the local mechanisms;
player responsibility lies in their design and composition.

The transferable lesson is not necessarily “add factories.” Orbital Logistics
could obtain comparable coupling from a required cargo handoff, a vehicle that
cannot serve every leg, or a propellant depot whose inventory depends on another
service. Each makes one route's outcome an input to another decision. Simply
renaming identical cargo at a station would add an objective dependency, but
would not reproduce the local construction problem of these games.

## 3. Factorio trains: automation operates inside player-built constraints

**Source-backed facts.** In its chain-signal explanation, Wube states that
trains already know their destinations. Signals govern whether they may enter
track sections; chain signals also consider whether an exit is free. The post
illustrates preventing a waiting train from obstructing another route and
avoiding deadlock on shared bidirectional track.
[Friday Facts #81](https://www.factorio.com/blog/post/fff-81).

Wube's train-control redesign calls repeated refueling arrangements boring and
repetitive. Schedule interrupts automate conditional diversions. It describes
shared trains carrying different cargo, destination-full handling through
depots, and station reservations preventing excessive arrivals at one stop.
The subsequent generic-interrupt post removes per-item rules in favor of a
wildcard whose cargo determines a consistently named destination.
[Friday Facts #389](https://www.factorio.com/blog/post/fff-389),
[Friday Facts #395](https://www.factorio.com/blog/post/fff-395).

**Design inference.** Player-owned structure includes track connectivity,
passing/holding space, station capacity, signaling, and the allocation of trains
to services. The interesting coupling is physical occupancy plus demand: adding
a train to improve one delivery can worsen another by consuming shared space.
Automatic travel, stop handling, and conditional dispatch execute the configured
system. A repeated stop list is one ingredient inside this larger construction
problem.

For Orbital Logistics, port occupancy, vehicle reuse, transfer windows, and
finite service inventories are plausible coupling points. Crossing two drawn
orbital arcs is not itself equivalent to sharing a railway block. A railway
analogy needs an actual shared resource or dependency in the simulation. Preserve
the distinction between visually overlapping trajectories and genuinely
interacting services.

## 4. Mini Metro: network design survives very simple vehicle control

**Source-backed facts.** Dinosaur Polo Club describes drawing lines between
stations, running trains, redrawing routes as new stations open, and assigning
limited resources. Its developer-authored Steam description adds that commuters
travel along the lines and station waiting space is limited. The presskit
emphasizes changing demand and managing upgrades.
[Game page](https://dinopoloclub.com/games/mini-metro/),
[developer Steam description](https://store.steampowered.com/app/287980/Mini_Metro/),
[presskit](https://dinopoloclub.com/press/mini-metro/).

**Design inference.** The structural choice is which stations each service
connects and where scarce capacity is committed. Vehicles execute that choice.
Serving another station changes the service that existing stations receive;
limited waiting space makes delay matter. Network composition supplies the
problem even with little instruction-level vehicle programming.

This is a useful counterexample to “more scheduler expressiveness means more
depth.” Orbital Logistics might need a small route vocabulary and consequential
connections more than a large event language. Mini Metro's growing city also
provides an external reason to revise the network. A fixed orbital puzzle must
supply its own reason through requirements and tradeoffs; it should not inherit
an endless survival loop accidentally.

## 5. Rail Route: automate dispatch, retain capacity and circulation design

**Source-backed facts.** In its 2020 redesign, the developer reports that
per-train automation was hard to understand and maintain. It moved automation
onto network elements: sensors read passing trains' destinations and configure
signals through player-defined routing tables. One regional setup can then serve
many trains.
[The New Automation](https://railroute.eu/2020/10/05/the-new-automation/).

A 2023 developer proposal introduces multi-stage regional services, with waiting
or transfer between stages. It explicitly identifies storing vehicles and
calling them back for their next stage as challenges, and proposes stabling and
dispatcher sensors to automate the resulting behavior. This is evidence of
design intent at that date, not an audit of today's shipped implementation.
[Rail Log #13](https://railroute.eu/2023/05/06/rail-log-13-contracts-overhaul-regional-trains-update/).

**Design inference.** This is the closest comparison to reusable spacecraft
circulation. The interesting question is where a vehicle should be between
jobs, and whether that positioning consumes capacity or delays its next duty.
Automating the recall avoids routine dispatch clicks while preserving the
underlying allocation problem. For an orbital game, waiting itself can have
physical consequences; it must not be implemented as a generic stationary
parking action unless the vehicle is actually attached to something.

## Consequence for the proposed recipe/timeline slice

**Design inference.** Compiling and showing two voyages is a useful authoring
and diagnostic experiment. It establishes neither a network-construction loop
nor a sustained-throughput puzzle. A repeat feature adds execution capability;
it becomes a new design problem when repeated uses compete or require a
different organization of the service.

Before treating that slice as product evidence, ask for two structurally
different solutions to one concrete objective, with a visible causal tradeoff.
Candidate contrasts are direct versus relay service, one circulating tug versus
vehicles dedicated to different legs, or shared depot versus separate fueling.
These require fixture validation and might prove unnecessary; they are probes,
not a feature backlog.

The decisive observation would be a player revising how the transport machine
is organized because execution reveals a bottleneck, while the authoring tools
remove arithmetic and repetitive command entry. If the only revision is to shift
the same two transfers along a timeline until a requirement turns green, the
slice may still be a worthwhile orbital scheduling puzzle, but the stronger
Zachtronics/transport-network hypothesis remains untested.
