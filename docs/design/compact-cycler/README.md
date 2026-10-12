# Compact powered cycler

Aster–Selene · Cycler and Aster–Selene · Cycler service are a fictional orrery with
spaceships: one long-coasting carrier and a reusable parcel shuttle. The finite
witness passed the numerical and own-viewing gate before continuous reuse was enabled.
The scale keeps both surface journeys visible in the same overview as the carrier.

## Choreography and field

The 72-unit cycle has 54 carrier coast units, two eight-unit powered arcs and two
supported units. Wayfarer departs Beacon at1, coasts from9 to63, joins Beacon at71,
and imports replacement propellant at71.5. Pipit launches from Haven at8, boards at13,
rides to26, lands at Cairn at32, unloads/refills, launches at38, boards at44,
leaves at54 and lands at Haven at59. Each half-trip delivers one .15 parcel;
deliveries are consumed and subsequent parcels/fuel are explicit capped imports.
Separate tanks remain visible. While Pipit rides, its full mass is carried by
Wayfarer; carrier burns never overlap attachment. Its hidden glyph avoids drawing
two ships on top of each other; its timeline and inspection remain available.

Aster has GM1/radius1; Selene GM.03/radius.2 on a radius5 prescribed circle at
sqrt(1.03/125). There is no indirect acceleration on this fixed-primary field.
Beacon is the actual-field outer rotating equilibrium, checked algebraically.
Both airless pads spin at the moon's orbital rate, with COM support height1e-5.
These are explicit per-set fictional synchronous spins, leaving other sets untouched.
No atmosphere, mutual ship gravity, general targeting or real Aldrin trajectory is claimed.

The lower-exhaust-velocity trial failed the shuttle reserve; see
[hardware revision](hardware-revision.md). Final exhaust velocity8, unchanged wet/dry
masses, tanks and caps, and 10% post-half-trip reserves are part of this witness.

## Numerical authority

`compact-cycler-profile-v1` freezes 129 acceleration keys and128 inertial cubic pieces
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

The separately versioned acceleration-commanded contract does not change Runner's
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

[Astra disposition](disposition.md) and [evidence](../../evidence/compact-cycler.md).
