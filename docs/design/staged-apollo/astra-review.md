# Staged Apollo architecture review

2026-10-11. Independent senior review of the accepted Beacon context and proposed
finite staged expedition. Production implementation remains with the main agent.

## Recommendation

Admit one separate `staged-apollo-v1` authored domain: an atmospheric launch
booster, a lunar orbiter and a single-piece reusable lander. Compile its fixed
phase graph once using existing atmospheric legs, canonical vacuum Runners,
`paidCapture`, supported surface poses and absolute-epoch entry-v3. Retain the
accepted finite and continuous single-vehicle exhibits unchanged.

The lander separates in lunar parking orbit, lands, ascends to the actual
coasting orbiter, pays its rendezvous residual, docks, and rides home attached.
Both the booster and the returned assembly recover on Aster. This completes a
closed hardware cycle suitable for subsequent authored recurrence. Historical
Apollo fidelity, discarded lunar descent stages, assembly construction, arbitrary
docking graphs, mutual gravity, collision between vessels and general mission
languages are outside this bounded witness.

Finite numerical and browser admission may be followed by a continuous wrapper
under the user's present authorization. This review recommends the architecture;
it does not certify an implementation or claim user visual acceptance.

## Existing seams worth reusing

- `src/model-set/apollo.ts` already passes exact state and remaining fuel between
  atmospheric ascent, all-field vacuum, paid lunar support and absolute entry.
  Its enlarged primary exclusion radius protects entire vacuum phases from air
  entry without altering gravity.
- `src/model-set/staging.ts` already treats reserved child fuel as carried inert
  mass for the active engine, derives child states from a retained split, and
  checks zero-kick mass/momentum conservation. Its three-program topology and
  single-separation view metadata are intentionally too narrow for this mission.
- `src/model-set/atmospheric-mission.ts` proves atmosphere/staging/recovery
  composition but uses a one-primary local-entry clock. Reuse its composition
  pattern, not that clock adapter: the new Moon is moving during booster entry.
- `src/libration/prepare.ts` demonstrates bounded compilation, fuel/resource
  seams, actual-field validation and strict control-family admission. The
  libration station's equilibrium rail is not a lunar parking-orbit provider.
- `src/expedition/engine.ts` and `query.ts` implement indexed symmetry and bounded
  recurrence well, but their public schedule assumes one tank, one dry mass,
  one recovery and one canonical sample function. Reusing those formulas for
  three independently recovered parts would silently lose resource ownership.

A small phase compiler can own a fixed list of segment records and expose
`sample(partId, epoch, side)`, attachment/assembly records, event boundaries,
terminal part inventories and measured work. This is enough. Do not turn the
fixture into a universal event language or add a general fleet scheduler.

## Physical ownership and accounting

Use three immutable hardware identities with their own dry mass, tank capacity,
exhaust velocity and engine. Their mutable fuel belongs to those identities
through every phase. An assembly is an engine owner plus a list of attached
parts, not a fourth independent hardware or fuel inventory.

For an engine owner i, with inert attached parts j:

`nonfuel_i = dry_i + cargo_i + sum(dry_j + cargo_j + fuel_j)`

`totalMass = nonfuel_i + fuel_i`

Only `fuel_i` enters that engine's depletion law. Use this same total mass for
finite thrust, acceleration caps, residual capture burns, entry drag/braking,
impulse accounting and displayed assembly mass. Tank validation still applies
to each attached child independently; ballast must not conceal an invalid tank.

Every ownership change ends the preceding phase and creates a fresh mass-law
anchor. No powered arc may straddle a split, dock, transfer or reassembly. No
fuel transfer is needed for the finite witness: each engine retains its own
remaining fuel. The lander's residual fuel rides home as genuine carried mass.

At every checked epoch, including event-left and event-right:

- Initial fuel equals remaining fuel in the three unique parts plus consumed
  fuel. In recurrence add explicit imported fuel and retain lifetime consumption.
- Assembly mass equals the sum of its parts. Total dry hardware remains constant.
- Each active part belongs to exactly one assembly or free/support owner.
- A retired launch-assembly glyph is excluded from inventory totals.
- A hidden or attached child retains its real tank and mass; visibility is not
  physical ownership and neither `opacity` nor sample-array presence is an owner.

Record finite-thrust propulsive delta-v using the existing anchored mass law,
including partial arcs and terminal braking. With constant attached mass and
one exhaust velocity it is `ve * log(M_before / M_after)` per uninterrupted arc.
Do not use the change in inertial speed, combine burns across a split using one
mass ratio, or count an inherited burn twice in mission totals. Fuel is the
stronger global invariant: exhaust ejection changes vehicle momentum and mass,
so total vehicle momentum is only conserved across a zero-kick split, not burns.

## Exact authored splits and physical rendezvous

The launch split and lunar split both use exact preceding canonical state:
each child inherits the parent's identical position and velocity. No authored
child state, cosmetic gap or arbitrary impulse may enter physics. Record
before/after part masses and momentum. A cosmetic drawn offset must never alter
a trajectory, encounter, camera reference-frame state or target provider.

Require all participants' engines quiet at each topology boundary. A burn may
begin at the child's birth immediately on event-right after the split. Keep
separation state/event-left state distinct from a just-started thrust report.
Reject a split during service, contact, a failed prefix or unsupported air/vacuum
ownership rather than constructing plausible-looking descendants.

The lunar orbiter is a dedicated canonical coast, starting at the actual split
state and certified through docking. It must not be replaced by a prescribed
Kepler circle, nearest displayed point, or the old single-vehicle return orbit.
The authoring optimizer can target a bounded fixed rendezvous epoch, but runtime
compilation verifies all four planar residual components against the actual
orbiter provider. Propagate both gravitational sources throughout.

At docking:

1. Resolve both incoming states and fuel at exactly the same global epoch.
2. Check position and velocity residuals with explicit independent numerical
   allowance. The finite rendezvous burns must already do the substantial work.
3. Run `paidCapture` on the lander alone to match orbiter velocity. Debit its
   fuel; record the actual residual delta-v and small position snap.
4. Attach the resulting lander mass to the orbiter. Orbiter velocity/fuel do not
   jump; after velocity matching the composite momentum is their mass-weighted
   sum without a further unexplained kick.
5. Start a new return segment from that state with the orbiter engine and actual
   lander remaining fuel carried as inert mass.

Every step is prepared privately; an unaffordable or invalid capture publishes
no partial dock or return. Return targeting may be reauthored from the actual
rendezvous endpoint. Reusing old controls is valid only when the new dynamics
and state satisfy them; a milestone called 'parking orbit' is not a state reset.

## Bounded authoring approach and feasibility evidence

The existing ascent/insertion/TLI/LOI controls mostly operate at an acceleration
cap of 3. If the new active engines retain that cap and sufficient force
headroom, unchanged direction/time controls can preserve those state paths
while the true per-tank fuel is recomputed. Verify force headroom over every arc;
post-split mass/fuel is never inferred from the old single-vehicle fuel curve.
Atmospheric drag depends on mass, so any changed launch mass or area requires
its own ascent verification even if the thrust cap remains identical.

A useful descent seed is a physically scaled old lander: multiply its old dry
mass, incoming fuel and engine force by the same positive factor. In vacuum
this preserves acceleration history for the same control times and directions.
The required scaled fuel must be reserved and carried from launch, never minted
at lunar split. After descent, target a real coasting orbiter with fresh finite
ascent/phasing/braking arcs; regaining only radius and tangential speed is not a
rendezvous.

`parking-probe.py` independently integrates the existing offline witness's
LOI state with DOP853, both unsoftened gravity sources and the actual prescribed
Moon rail (`mu_Aster=1`, `mu_Selene=.03`, `R=5`,
`n=.09077444574328174`). `parking-probe.json` records:

| Coast interval from t=29.92377953 | Sampled lunar-radius range |
| --- | --- |
| through 45 | .32820763 to .38681894 |
| through 48 | .29823702 to .38681894 |
| through 51.71585081 | .29823704 to .41043364 |

The lunar surface radius is .2. No lunar collision event occurred on these
intervals. This is enough to recommend a passive finite parking target and a
rendezvous around t=42–48. It is a feasibility probe from an offline witness,
not the new canonical split state, a conservative clearance certificate, or a
rendezvous solution. Minima above are dense sampled minima. Production Runner
admission and the independent full mission oracle remain required.

At t=41.57545106 the passive orbiter state is approximately
`[4.14572210,-3.30107664,.55264497,.46886992]` in planar x/y/vx/vy.
The old surface-ascent endpoint differs substantially. Copying its existing
return parking milestone into the orbiter would be a free state teleport.

## Child visibility, selection and histories

Use persistent part identities and explicit attachment/presence intervals.
Current `VesselView.lifetime` describes only one birth/retirement; it cannot by
itself describe a lander attached at launch, free during descent/ascent, attached
again for return, then available after turnaround, across repeated trips.

A compact optional phase/attachment record is sufficient. Determine glyph/hit
presence from those records; let the inspector still expose attached part
hardware and tank state. At dock, the lander disappears as an independent
moving glyph on event-right and the assembly label can show both parts. Its
last flight endpoint remains in history. At separation, the parent assembly
retires and both children become independently selectable on event-right.

Part trails must break at hidden transport and at any discontinuous ownership
handoff. Never join the booster recovery to lunar descent, or the pre-dock lander
path to an unrelated new cycle. Child selection and Follow/Chase should resolve
to its current carrier when attached, or a clearly defined fallback, without
becoming an extra physical body. Test scrubbing both sides of all transitions.

## Continuous cache seam

Do not immediately generalize `ExpeditionSchedule` into a graph interpreter.
Add a separate staged recurrence wrapper that consumes the compiled mission's
part-specific samples, lifecycles, canonical boundaries and terminal inventories.
Reuse low-level rotation/indexing helpers and rolling-view budget patterns.

For the unchanged planar world and synchronous lunar support, the same relative
Moon/pad period permits complete mission rotation. Validate the symmetry against
all world rails, atmosphere spin, support frames and authored vector controls.
Rotate each part, each recovery pose, all thrust/attitude/aero vectors and exact
event-side states together; do not rotate global rails twice. Use indexed epochs
rather than accumulated period additions and query absolute-calendar boundary
values directly when subtraction loses low bits near t=1,000,000.

Each part's recovery is separate. Booster recovery occurs much earlier than the
lunar assembly's recovery. Ground transport may be hidden and kinematic as in
the accepted exhibit, but it changes support ownership at an explicit epoch.
There must be enough turnaround for the latest arrival before reassembly.
Restore each tank by its measured deficit via supported, explicit ground import
and debit transactions; refill must fit its own tank and the ground supply cap.
Reassembly preserves part dry mass and remaining/refilled fuel. No fuel usage
reset or dry hardware recreation is allowed at a cycle boundary.

If the mission instead abandons hardware, recurrence requires explicit hardware
imports/replacements plus an admitted fate for the abandoned mass. Bringing the
single-piece lander home avoids this second model domain.

The first continuous implementation should retain one immutable finite physical
context and bounded rotated drawing strips, not compile a new mission every
cycle or allocate an unbounded actor per trip. Keep cycle-qualified event IDs
and distinguish template/part identity from occurrence identity. One engine
publishes frontier/resources/events atomically and preserves terminal-calendar,
held-cursor, one-outstanding-request and last-known-fault semantics.

Count all atmospheric, vacuum, parking and entry owners when enforcing work and
storage budgets. Shared immutable contexts count once; copied drawing rows count
for each copy. Three part histories and multiple lifecycles mean that old
single-vessel sample/packet limits cannot be assumed to fit without measurement.

## Admission and evidence checklist

1. Strict version, unknown physical-field rejection, finite metadata/hardware,
   exact phase ordering, fixed named topology, unique identities and arc ownership.
2. Canonical all-field whole-interval clearance; atmosphere loads and correct
   absolute clocks for booster and return entry. No softened production gravity.
3. Exact seam-state/fuel continuity, zero-kick splits, unique tank ownership,
   attached mass in thrust/capture/entry, finite positive fuel throughout.
4. Independent DOP853 full mission with the same physical events but independently
   computed mass/fuel, and step refinement at lunar surface/dock/entry boundaries.
   Repeatability alone is not independent accuracy evidence.
5. Paid landing and docking, explicit pre-snap residual plus numerical allowance,
   and negative tests for depleted lander, missed target, invalid phase crossing,
   early child controls, duplicate ownership and insufficient booster recovery fuel.
6. Query-order/partition invariance and event-left/right tests for all assembly
   boundaries. A display query must never initialize a physical segment.
7. Browser tests in inertial, lunar and object-centered views, close zoom at
   splits/dock, inspector mass/fuel, part selection, rewind/replay and layer toggles.
   Inspect actual screenshots/video for simultaneous co-located glyph legibility.
8. Then continuous resource audits through 1,000,000, exact near-boundary queries,
   independent absolute-epoch replay of representative rotated episodes, cache
   counts/storage, pause across reply, held-history eviction and final halt.

Do not claim the finite lunar rendezvous works until both numerical admission
and the browser path demonstrate the actual event. Do not claim recurrence from
finite Replay: continuous ground supply and hardware restoration need their own
accounting and bounded-history evidence.

## Implementation and authored-witness follow-up

The implemented finite compiler now follows the recommended fixed domain. The
mass audit checked `hardwareShip`, both separations, reserved lander fuel,
canonical passive parking, paid lander-only docking and attached return/entry.
No additional free mass or delta-v transition was found. Hardware validation's
initial whole-mission duration was corrected to use a short validation interval;
physical flight intervals remain separately admitted.

The frozen fixture uses Atlas dry .2 / initial fuel 2.5, Odyssey dry .85 and
protected Eagle dry .15 / fuel .5711591635501457. The upper launch payload mass
is 7 exp(-.18); its reserved fuel and increased stack drag area preserve the
accepted upper prefix physically. Booster recovery is at t≈2.87285; Eagle docks
at 44.5; the returned assembly recovers near 79.51386. `author.py` assembles the
frozen controls without optimizing; optional `--ascent` and `--return` perform
bounded offline solves. `witness.json` retains authoring inputs and results.

The initial oracle disagreement was investigated before adjusting its gate.
See [measured accuracy and convergence](oracle-accuracy.md). The resulting 1e-4
whole-mission allowance is independently supported; the existing 2e-6 physical
capture rules were retained.

The staged recurrence source audit confirms per-tank deficits, carried lander
mass, two separate recoveries, explicit ground support/reassembly and refill,
absolute indexed symmetry and bounded cached drawing. Its display adapter clears
hidden children's `dockedPortId`, avoiding duplicate berth claims. The hidden lander fade override was corrected by limiting recovery fades to
the two actual recovery glyphs, and a negative visibility assertion now covers
that interval. Runtime stress/browser evidence remains
owned by the implementation agent and must accompany this source review.
