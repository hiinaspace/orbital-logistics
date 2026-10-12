# Compact powered cycler

Aster–Selene · Cycler and Aster–Selene · Cycler service are a fictional orrery with
spaceships: one long-coasting carrier and a reusable parcel shuttle. The finite
witness passed the numerical and own-viewing gate before continuous reuse was enabled.
The scale keeps both surface journeys visible in the same overview as the carrier.

## Choreography and field

The 74-unit cycle has64 carrier coast units, two four-unit powered arcs and two
supported units. Wayfarer departs Beacon at1, coasts5→69, joins Beacon at73,
and resupplies at73.5. Pipit launches Haven6→9, rides9→16, lands Cairn16→19.5,
unloads/refills19.75/20, launches21.5→25, rides25→65, lands Haven65→69,
and unloads/refills69.25/69.5. Each half-trip delivers one .15 parcel; deliveries
are consumed and subsequent parcels/fuel are explicit capped imports. Separate tanks
remain visible. While Pipit rides, its full mass loads Wayfarer; carrier burns never
overlap attachment. Its hidden glyph avoids drawing overlapping ships, while the
individual timeline/inspection remains available.

Every taxi leg includes a literal coast between finite steering bursts. Per-direction
independent/aboard time is6.5/7 inbound and7.5/40 outbound. Aster release/boarding
radii2.997/3.198, Selene-relative boarding/release distances1.122/2.245; these are
measured encounter geometry, not a direct-route optimality or necessity proof.

Aster has GM1/radius1; Selene GM.03/radius.2 on a radius5 prescribed circle at
sqrt(1.03/125). There is no indirect acceleration on this fixed-primary field.
Beacon is the actual-field outer rotating equilibrium, checked algebraically.
Both airless pads spin at the moon's orbital rate, with COM support height1e-5;
Cairn's fixed longitude is1.2 radians, Haven's0.
These are explicit per-set fictional synchronous spins, leaving other sets untouched.
No atmosphere, mutual ship gravity, general targeting or real Aldrin trajectory is claimed.

V1's fully powered taxis failed at exhaust4 and temporarily used8. The refined
coast-based witness restores4 with the same tanks/dry/cargo/reserves. Shorter burns
use stronger engines: carrier acceleration/force.6/6 and shuttle4/16.6. Shuttle
half costs3.1266/3.3672 and fuels.749/.638 exceed.3 reserve; carrier fuel2.787
exceeds.6. Carrier delta-v1.5504 is higher than v1's1.0718: the Beacon burns are
shorter, not proven cheaper. [Refinement evidence](../../evidence/compact-refinement.md).

## Numerical authority

`compact-cycler-profile-v2` groups fifteen contiguous native segments into seven
ownership stages, including explicit unpowered taxi middles. Each powered segment freezes 129 acceleration keys and128 inertial cubic pieces
per powered segment. An inverse quintic is only the designer's starting guess;
shooting corrects a forward solution. Production TypeScript canonical RK4 at1/512
executes the exact frozen controls in six-state dynamics. Every knot is a step boundary.
Cubic key consistency/C1 joins and Bernstein convex hulls bound acceleration between
keys. Thrust is mass times acceleration; mass follows exp(-∫|a|/exhaustVelocity),
re-anchored after cargo and fuel events. Force is conservatively bounded using the
interval's starting wet mass. No authored departure/arrival impulses are used.

Full coupled DOP853 is the independent oracle; h/2 andh/4 replay calibrate native
error. Position and velocity residual plus1e-8 numerical allowance must each be
below1e-7 at every capture; velocity matching including allowance is paid. Carrier
boarding/release targets are private exact native canonical nodes. Drawing interpolation
never feeds a target or resumes physics. Positive supported clearance is preserved
through the entire launch/landing interval, not just at sampled points: a bounded
bootstrap enclosure combines both sources' acceleration bounds, moving-body curvature,
control cap and linear-relative closest approach. Refusal bisects the canonical interval
with depth/work/node limits; inside-body derivatives reject. A geometric snap cannot
cross a body surface. Private native traces are admitted once and retained boundedly.

Legacy profile-v1 retains exactly seven singleton routes, original control presence
and zero pad phases; the actual original fixture is regression-tested. Old readers
reject v2 before propagation. The separately versioned acceleration-commanded contract does not change Runner's
fixed-thrust law, Solar's field or old fixtures. JSON authoring remains inspectable:
`uv run --project spikes/numerics python spikes/numerics/compact_cycler.py` regenerates
the frozen controls and oracle. Retained bounded coast studies are seed provenance,
not the safety certificate or production simulation.

## Exact reuse and playback

`compact-cycler-v1` only reuses an admitted immutable cycle in its original field.
Time shift plus constant rotation transforms positions, velocities and commands;
synchronous pads and Beacon are transformed by the same law. Physical paid captures,
support and funded resupply establish next-cycle initial loadouts. Free flight is
never reset to a desired endpoint. Integer occurrence indices compute phase directly;
there is no repeated phase accumulation. The private engine instance owns its exact
admitted profile, resolution, field/spins, hardware and tolerance policy; no global,
disk or cross-definition cache is exposed. A new engine admits its own profile.
Additional independent solar/Jupiter phases would invalidate this reuse assumption.

The worker owns the actual frontier and publishes only complete, preflighted packets.
Resource counters accrue at actual flow epochs, once; repeated predictions/scrubs do
nothing to them. Indexed cycles are assembled in the worker, with a one-time cold
template. The frontend clips drawing rows and samples the bounded immutable display
law. Pause/rewind hold retained actual history; Return to live resumes its current
head. History spans96 past +32 forecast units,128 total. A pending reply may carry
one future row beyond a held drawing window; retain it inside the same explicit row
budget until Live. Resource anchors retain actual events and window anchors, not every
worker reply. One outstanding request prevents an unbounded held backlog.

Initial admission advances32 units; subsequent requests advance at most8 (UI at most1).
Calendar ends at1e6. Template≤8MB; admission≤240k native nodes/400k checks; per trace
≤180k nodes/240k enclosure checks/depth24. Each worker/frontend row registry≤5 cycles,
40k drawing samples/12MB, each row≤12k samples/6MB, complete packet≤16MB.
The bounded transient envelope includes worker registry12MB + frontend backing12MB
+ at most one16MB pending packet, plus the bounded native traces/template and
browser-owned SceneView drawing lists. Worker rejection leaves the previous published
frontier intact. Import/capture failure halts this dependent pair before the event;
future cached support/success samples are excluded. No rescue or online replanning.
Fault injection is an internal test seam, not a user configuration feature.

[Refinement Astra disposition](refinement/disposition.md) and
[current evidence](../../evidence/compact-refinement.md). Original
[architecture disposition](disposition.md) and [v1 evidence](../../evidence/compact-cycler.md)
remain historical; the owner rejected that first morphology.
