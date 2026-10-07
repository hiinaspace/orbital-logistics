# Consultant recommendation: what should the player build?

2026-10-07. Independent design consultation for the current Orbital Logistics
prototype, at the user's request. This is a research and content-design study,
not authorization or a plan to implement all the mechanics mentioned below.
The reviewed periodic-service proposal is context rather than a constraint on
the recommendation. App code has not been changed by this consultation.

## Recommendation

Pause the recipe/timeline implementation **as the next game-validation step**.
Its command ownership and diagnostic ideas are sound, but they mainly make an
already chosen route easier to author. They do not establish what interesting
transport system the player gets to invent.

Test a finite **orbital courier circuit** first: three ports, cargo for two
destinations, a small fleet allowance, and an obligation to bring the vehicles
home. Let a player compare a multi-stop circuit, separate shuttles, and vehicles
dedicated to different destinations. Use real departure opportunities, paid
arrival matching, and cargo-dependent fuel use. This creates a modest but real
choice of service organization without manufacturing chains, imaginary orbital
traffic lanes, a general scheduler, or an infinite-running world.

If that is promising, develop **a fixed-objective transport-network puzzle with
orbital geography**. The player designs cargo paths and reusable vehicle
circulation; local astrogation makes those choices executable. A horizontal
timeline then explains their interaction. Treat the existing editor as a valuable
lower-level capability, rather than the reason to force every design decision
through burn handles.

Keep the alternative explicit: if the player mainly enjoys inventing and refining
individual journeys, make a finite orbital mission-design game. The implemented
work is already much closer to that product. It can stand on its own without
claiming the player is building a Zachtronics machine.

## The qualitative difference is about the object being designed

These genres overlap along several axes; they do not form a single line from
"more programming" to "more transport."

| Design family | What the player constructs | Where choices interact | What routine automation executes |
| --- | --- | --- | --- |
| Opus Magnum / SpaceChem / Infinifactory | A procedure embodied in an apparatus that changes material structure | Placement, reach, occupied volume, assembly shape, operation order, shared manipulators | Repeated local instructions and material movement |
| Factorio | A production and transport plant | Material dependencies, capacity, spatial layout, shared infrastructure, inventories | Machine recipes, vehicle movement, configured dispatch rules |
| OpenTTD / Mini Metro | A network of services and the capacity assigned to it | Connectivity, demand, transfers, journey time, vehicle use; physical infrastructure where applicable | Movement, loading, pathfinding, and varying amounts of dispatch |
| An orbital mission-design puzzle | A physically feasible journey or collection of journeys | Position and velocity at a particular time, mass, fuel, encounter order, return obligations | Execution of the accepted maneuvers |
| The proposed two-port repeating slice | A parameterized service on a mostly fixed connection | Departure phase, duration, readiness, fuel, and selected cadence | Repeated resolution/execution of the chosen transfer contract |

The first three rows summarize source-described mechanics; the comparison and
last two rows are design analysis. See [primary-source notes](reference-notes.md).

For Zachtronics, transport normally changes or enables the *structure of the
output*. An assembly occupies particular places and can obstruct or change the
usefulness of another operation. An open board does not remove this coupling:
reach, rigid shapes, and shared working space still matter. A clever arrangement
can eliminate a manipulator or an entire intermediate operation. The timeline
belongs to that invented arrangement.

For transport games, cargo usually retains its identity. The constructed object
is the service network that gets it to destinations at useful cost and rate.
Adding a stop can improve connectivity while degrading existing passengers'
service. A hub may consolidate flows but introduce a transfer and waiting.
Additional vehicles can increase capacity while consuming money or shared
infrastructure. This is sufficient construction depth without molecular
transformation.

OpenTTD's aircraft and ships are an important check against overlearning the
railway analogy. Its orders UI supports vehicles beyond trains, including
loading/unloading behavior and depot/hangar actions. Its timetable is a related
view with separate travel and waiting values. The source does not imply that
laying track or setting an exact timetable is the essence of every transport
service. Source inspected at commit
[`eb15dc514ad48fdc3d80ef6f2005aadfde499b67`](https://github.com/OpenTTD/OpenTTD/tree/eb15dc514ad48fdc3d80ef6f2005aadfde499b67),
particularly
[`order_gui.cpp`](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/order_gui.cpp)
and
[`timetable_cmd.cpp`](https://github.com/OpenTTD/OpenTTD/blob/eb15dc514ad48fdc3d80ef6f2005aadfde499b67/src/timetable_cmd.cpp).
Airports can still have shared endpoint capacity; the counterexample is to
requiring player-built track corridors, not to the usefulness of capacity limits.
This was source inspection, not an OpenTTD playtest.

For the orbital prototype, the spatial display is excellent evidence of motion,
but it is not automatically a spatial construction puzzle. Two trajectory lines
may cross without interacting. There is no natural need to weave one route around
another as with conveyors or railway blocks. The interesting orbital state is
**place, velocity, time, and carried mass together**. A rendezvous can look close
and still be expensive; a longer geometrical path can reach the useful state more
cheaply. That is the native material from which to build this game.

## Why repeating the current service is a weak next product test

Under a deliberately narrow model—one fixed route, identical independent jobs,
an identical opportunity every `S`, and vehicle occupancy lasting `R`—serving
every opportunity requires at least `ceil(R/S)` vehicles. Reusing one vehicle
uses every `k`th opportunity with `k >= ceil(R/S)`. This is a useful operational
fact, but after discovering it the service may be largely designed.

The retained experiment finds the tug away at the next cheap opportunity and
able to repeat at every second one. That demonstrates a meaningful physical
constraint and a reason to use a second tug. It does not yet show that choosing
between service organizations is interesting. This reduction is **not** a claim
about all periodic logistics: interacting inventories, multiple demands,
different routes, windows, and joint resources can defeat the simplification.

Three kinds of effort should be distinguished:

1. **Finding a feasible physical leg.** A local targeter should remove numerical
   root-finding work while preserving chosen endpoints, timing, and trajectory
   family.
2. **Choosing an organization.** The player decides which journeys exist, which
   cargo travels together, which ship returns where, and where a handoff is worth
   its cost.
3. **Operating that organization.** Re-entering routine load, match, dock, and
   repeat instructions should require progressively less attention.

The current proposal greatly improves the third item and exposes some of the
first. Its strongest unsupported assumption is that doing so will produce enough
of the second. Scheduling puzzles are a legitimate possibility, but a hard
schedule and an expressive construction game are different promises.

Nor is adding more deliveries enough. If each delivery can be solved without
changing another route's best organization, the new problem is mostly several
copies of the old one. A shared fuel cap can create a tradeoff, but a list of
independent fast/slow choices may still feel like allocation bookkeeping.
The test is whether improving one part gives the player a reason to **reorganize
another part**, and whether that reason is legible.

## A more useful schematic for orbital logistics

Think about four related structures:

```text
Demand:        which cargo must reach which destination, and by when?
Cargo paths:   direct, consolidated, relayed, split among services?
Ship routes:   which ship carries each leg, then goes where for its next job?
Trajectories:  which timed physical transfers realize those routes at this mass?

       demand
          |
       cargo paths  <---- handoffs / capacity ---->  ship routes
          |                                      |
          +--------- timed paid trajectories -----+
```

Demand is normally supplied by the puzzle. The middle two structures are the
most promising player-authored objects. The bottom layer supplies orbital
geography and admits local assistance. These layers should constrain one another:
carrying both parcels changes fuel; unloading at the first stop changes the next
leg's mass; visiting that stop changes the next departure opportunity; retaining
a ship for the return can eliminate a possible parallel delivery.

An orbital hub is not merely a dot in a drawing. It is an orbiting location with
a velocity and a phase. A cargo connection exists when the first service can
deliver there and the second can depart afterward, with storage and propellant
accounted for. A line crossing, a shared orbital radius, or a close flyby does not
create a cheap handoff by itself.

This explains both the opportunity and the risk. Orbital geography supplies
time-dependent connections and state-dependent transport cost without invented
traffic lanes. But every extra relay adds paid rendezvous and possible delay.
The designer must demonstrate why at least one relay, consolidation, or vehicle
specialization is useful; its usefulness cannot be assumed from a pretty network
diagram.

## Three viable product directions

| Direction | Central satisfying act | Necessary additional proof | Main risk |
| --- | --- | --- | --- |
| **Finite mission synthesis** | Invent a journey that achieves several goals and gets the equipment home | Multiple understandable physical strategies; player voluntarily improves one | The local optimizer finds most of the interesting answer, or manual work is numerical nursing |
| **Finite service-network synthesis — recommended probe** | Discover a better organization of cargo flows and reusable vehicles | Direct/shuttle/circuit/relay families with causal tradeoffs and readable effects on other services | A routing table disguised as space; all good designs collapse to the same organization |
| **Orbital mechanism construction** | Build reusable infrastructure such as chosen depot orbits, staged carriers, or a recurring carrier accessed by local shuttles | Player-chosen infrastructure genuinely changes what is possible, with deployment/access costs charged | Large physics/content scope before a usable component vocabulary exists |

The third is the closest literal interpretation of “ballistic trajectories are
the moving parts of a machine.” It is also the most speculative. A cycler is not
a free conveyor: reaching and leaving it can be expensive. A tanker supplying a
depot can consume the very advantage the depot was supposed to create. These are
good subjects for future physical witnesses, not decorative features to add now.

A manufacturing recipe is optional in the second direction. It earns its place
when transformation changes a transport decision—for example, reducing shipped
mass, requiring returnable containers, or making one fuel supply depend on
another service. Merely relabeling cargo on arrival adds a precedence constraint;
it does not reproduce the assembly puzzles of Opus Magnum.

## What to automate and what to make visible

The player should own itinerary, consolidation/handoff decisions, vehicle
assignment, and the timing/cost commitments that affect the rest of the plan.
The computer should calculate the numerical burns, execute paid arrival matching,
maintain consistent docking/service timestamps, and expose the consequences of
candidate changes. A failure should point to a decision the player can usefully
change, rather than a solver iteration count.

Start with three linked views, implemented only as far as the chosen experiment
needs:

- **The orbital map:** candidate and accepted transfers; endpoint ghosts and
  relative encounter geometry. This explains the physical opportunity.
- **The service diagram:** which destinations a ship visits and which cargo is
  aboard each leg. This is where a direct service and a circuit look different.
- **The unwrapped timeline:** departures, service, cargo availability, waiting,
  and the next missed or reachable connection. Fuel/mass history supports this
  causal explanation.

A timeline is valuable even for a finite mission. It should not imply that the
world has a short global cycle. More than two circular ports generally introduce
different relative periods; a repeated *route* need not repeat its transfer times
or return to the same full environmental phase. Two-port symmetry should not
quietly define the product's eventual programming language.

Borrow automation's role from transport games. Wube explicitly targeted
repetitive train configuration with interrupts and generic cargo rules
([FFF-389](https://www.factorio.com/blog/post/fff-389),
[FFF-395](https://www.factorio.com/blog/post/fff-395)). Rail Route's developers
describe moving automation from individual trains onto shared network elements
because per-train automation was difficult to maintain
([The New Automation](https://railroute.eu/2020/10/05/the-new-automation/)).
The design inference is to automate a *successful design decision's repetition*,
not require repetitive command entry to make the game feel programmable.

## Propulsion is a modifier of the decision space

Neither conservative impulses nor torchships solve the missing-construction
problem by themselves. A narrow cheap-transfer regime can leave one sensible
route and make the game about waiting. A very generous regime can make nearly
every useful direct transfer available and remove the reason to build relays.
Either can still support a good mission or capacity-planning game; the central
question is which choices remain.

Test propulsion against a concrete service-organization problem. Compare whether
it changes consolidation, vehicle reuse, or the value of a connection—not merely
whether one transfer is faster or looks different. Do not add heat/cooldown/berth
taxes solely to recover difficulty after direct flight becomes good. If generous
propulsion makes every authored network alternative pointless, that result is
useful evidence for choosing a different core or a different regime.

## A retained physical witness

The bounded experiment now supplies an initial reason to try the courier circuit.
[Code](hohmann_routes.py) enumerates **five chosen service organizations** over
72 equally spaced phases of a third circular port. It uses analytical two-body
Hohmann transfers, solves the departure-phase coincidence exactly, and charges
both impulses with the rocket equation at the actual carried mass. These are
separate calculations from the application, with independent numerical endpoint
checks. The phase/timing construction follows the circular coplanar assumptions
described in [a.i. solutions' FreeFlyer guide](https://ai-solutions.com/_freeflyeruniversityguide/interplanetary_hohmann_transfe.htm).

The fixture uses `mu=1`; A has radius 1 and phase 0; B has radius 1.4 and phase
0.8467093134799941, preserving the current Home/Depot geometry. The third port C
has radius 2. Two parcels of mass 0.2 start at A, one destined for B and one for C.
Each active tug has dry mass 1, initial propellant 0.6, and exhaust velocity 3.
Initial/intermediate service lasts 0.25. There is no refueling or port contention;
waiting ships stay attached to the port. Every active ship must return home with
at least 0.05 propellant remaining. Think of the available hardware as a pool of
two identical pre-fueled tugs: an unused tug stays home and is not charged as
active hardware. Propellant is scored by actual consumption, not initial issue.

This **changes the current content assumptions**: initial ship fuel is 0.6 rather
than the existing patient's 0.2, and the combined tours load 0.4 cargo rather than
the patient's 0.2. No payload limit binds in this tiny comparison. The larger
initial tank load avoids introducing refueling as a confound. The result does not
establish that the existing app targeter's bounded component domain accepts the
new legs.

At the selected C phase `1.3962634015954636` (sample 16), four alternatives are
nondominated in completion time, actual fuel consumption, and active hardware
**among the five candidates**:

| Organization | All active tugs home | Propellant consumed | Active tugs |
| --- | ---: | ---: | ---: |
| A → B → C → A | 42.741462 | 0.304632 | 1 |
| A → C → B → A | 35.480640 | 0.320471 | 1 |
| A → B → A → C → A | 33.021888 | 0.429653 | 1 |
| A → B → A and A → C → A in parallel | 19.626757 | 0.458221 | 2 |

The fifth organization, A → C → A → B → A, is dominated at this phase. The
important causal example is that **returning home between deliveries can finish
sooner than continuing onward**. At B, the combined tour waits until 24.599748
for B → C. Returning to A instead catches A → C at 19.895789; the extra flight
finishes the whole mission about 9.72 time units sooner, at appreciably greater
fuel cost. This is an orbital reason to change the organization of the service.

![Analytical comparison of route organizations](route-comparison.png)

Across the chosen 72-phase scan, all 360 candidates satisfy the physical/fuel
constraints; 16 phases have a noticeable nondominated one-tug tradeoff between
combined tours and serial sorties. Those competing one-tug alternatives also fit
the current horizon of 64. The selected phase deliberately maximizes a stated
time/fuel contrast after preferring different one-tug families; it is an authored
content search, not an unbiased estimate of how often good puzzles occur.

The [results](route-results.json) retain the selection rule, every candidate's
scores/delivery times, the complete five-candidate primary ledger, and six
directed-leg DOP853 checks. Maximum independent endpoint position error is
`1.34e-13`; paid arrival impulses also match circular endpoint velocities. The
code passes the existing numerical project's Ruff and ty tools. This verifies
the bounded calculation, **not global optimality, app behavior, sustainable
service, or fun**. Extra transfer families, discretionary holds, different loading
or refueling policies, and different starting fuel can change the frontier.

The witness supports a smaller next question than building a relay economy:
does choosing and improving this sort of circuit feel worth doing? It does not
yet justify a production network, a depot-placement system, or repeat commands.

## Next decision gates

**First: a bounded content experiment, before runtime or loop machinery.** Find
one finite three-port objective with at least two materially different service
organizations. Account for every ship's starting and terminal state, all carried
cargo, and all propellant used. Retain the losing alternatives as well as the
successes. The experiment below is an initial analytical witness, not an app
level or a human acceptance result.

**Second: a small hands-on choice test.** Show the orbital scene and a few
validated candidate transfers. Ask the player to meet the objective, then improve
one chosen metric. The useful observations are whether the player invents or
changes a cargo/vehicle route, can predict the effect on another leg, and wants
to try a different organization after seeing the first result. Numerical success
or the ability to repair a timestamp does not pass this gate by itself.

**Third: build the smallest authoring improvement the test actually needs.** If
route organization is promising but timing is hard to inspect, implement the
recipe compiler and timeline around that finite problem. If the enjoyable work
is entirely in the trajectories, improve finite mission authoring. If neither
produces voluntary revision, stop expanding the scheduler and reconsider the
core before adding more ports, factories, or propulsion systems.

No result here proves a fun game. The intent is to make the next failure cheap
and informative, and the next success identify what the player wants to build.
