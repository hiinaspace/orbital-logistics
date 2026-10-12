# Finite pass-through service — 2026-10-12

The owner accepted the zero-thrust carrier research plot and requested real parking/
phasing coasts for Pipit. **Aster–Selene · Cycler** now uses `pass-through-set-v1` /
`pass-through-profile-v1`. It replaces the Beacon-stop finite set in the chooser;
the rejected continuous Beacon shuttle is retired from the chooser. Historical
compact contracts/fixtures/rolling runtime remain regression-tested.

## Physical story

The accepted carrier starts already in flight, at the research orbit's phase50,
rotated into the unchanged lunar phase0 field. Wayfarer coasts through **two complete
120.504676-unit circuits**, continuously propagated to241.009353. No departure,
turnaround, Beacon capture, refuel, thrust or period reset is introduced.

Pipit makes one Cairn–Haven–Cairn parcel round trip in each circuit. It launches early
into radius1.4 Aster parking, completes more than four real orbital laps, then uses
an economical finite departure/coast/rendezvous connection. Parking is free flight
in the full field, not an analytical orbit rail. The final connection's departure
and rendezvous costs are approximately.0729/.2853, total.3582. This is a targeted
finite transfer seeded by a Hohmann-like geometry, not a proven global minimum.

| First-circuit phase | Epochs |
| --- | --- |
| Cairn ascent |1→3|
| Aster parking/phasing coast |3→49|
| Small departure / transfer coast / rendezvous |49→49.75 /49.75→55.25 /55.25→56|
| Ride Wayfarer |56→66|
| Lunar braking / coast / insertion |66→66.5 /66.5→68.5 /68.5→69|
| Lunar orbital coast / Haven descent |69→71 /71→73.5|
| Deliver / funded refill and reload |73.75 /74|
| Haven ascent |74.5→75.75|
| Lunar connection: departure / coast / rendezvous |75.75→76.25 /76.25→79 /79→79.5|
| Ride Wayfarer |79.5→83.5|
| Aster braking / coast / insertion |83.5→84 /84→86 /86→86.5|
| Aster return parking / separately phased descent |86.5→101.259351 /101.259351→102.759351|
| Deliver / funded refill and reload |103.009351 /103.259351|

The second mission is freshly replayed and admitted at actual absolute epochs one
carrier period later. Shifted/rotated controls are authoring seeds; the actual native
carrier is the handoff target. Ground longitude/landing time decouple surface phasing
from rendezvous. Separate orbital braking and terminal descent replace direct long
curves from the carrier to the pad.

Field remains fixed Aster GM1/radius1 plus prescribed Selene GM.03/radius.2 on radius5
at√(1.03/125); no indirect acceleration or massive-body self-consistent dynamics.
Both pads are airless/synchronous, COM support height1e-5. Cairn/Haven longitudes are
-2.8556824581/-1.6821961871. Hardware stays separate: carrier dry4/fuel6, no engine;
Pipit dry1/fuel3/cargo.15, exhaust4, acceleration4/force16.6 caps. All command bounds
are below those caps. Ground burns were shortened/rephased to meet the original
reserve, rather than enlarging tanks or weakening admission.

## Authority and ownership

One private finite admission propagates the carrier from actual preceding endpoints.
All board/release epochs are carrier trace boundaries and must resolve to **exact
canonical nodes**. Shuttle parts likewise continue their actual endpoints; intermediate
parking targets never cause a snap or free velocity change. Body/ship captures pay
residual velocity plus1e-8 allowance, with position and speed each below1e-7 including
allowance. Native exclusion enclosures cover whole moving-body intervals.

Each capture preserves the event-left flight state/fuel and event-right attachment.
Pipit retains its separate tank/cargo while riding; Wayfarer's displayed carried mass
includes it exactly. Gravity is mass-independent in this prescribed field and the
carrier never burns. Commands require129 keys/128 C1 cubic spans; actual Bernstein
bounds certify acceleration and starting-wet-mass force, independently of metadata.
Fuel follows anchored exponential consumption; every landing retains≥.3.

Each .15 delivery is consumed at the destination. Every reload explicitly funds a
new .15 parcel and at most2.8 imported fuel; insufficient funds or missing cargo refuse
the whole private admission. Four deliveries export.6 parcels, with ending Pipit
fuel3/cargo.15. Imports equal consumed fuel; carrier fuel remains6.

Only disposable bounded drawing samples and frozen controls/resources leave the
worker. Finite sampling uses absolute epochs, never period modulo; queries beyond
the admitted horizon reject. View/frame/camera changes and interpolation never target
or resume physics. Replay rewinds this finite history and its resources.

## Budgets and review

Source≤2MB; baseline≤240k native advances/400k enclosure checks; trace≤64 units,
≤180k advances/240k checks. Each trace receives the remaining aggregate allowances
before propagation, and stops before an overspending advance/check. The old helper's
default allowances and successful numerical trajectories are unchanged. Calibration
runs explicitly scale their separate aggregate allowance with resolution. Template≤6MB,
phase rows≤32k, complete displayed samples≤32k, serialized scene≤16MB. Output guards
are admission bounds; JSON serialization itself needs temporary memory. Native traces
are absent from the published template and become collectible after preparation.

Astra design review required full two-trip feasibility, field/control validation,
four-landing reserves/funding and explicit attached mass. Follow-up confirmed the
supplied witness and identified the post-propagation budget check; remaining-allowance
integration plus known-bad and exact-bound tests fix that. See [disposition](disposition.md).

## Reproduction

`controls.json` is the final frozen input. Run from the repository root:

1. `uv run --project spikes/numerics python spikes/numerics/pass_through.py`
2. `npx tsx docs/design/compact-cycler/redesign/native.ts` for three-resolution evidence.
3. `npx tsx docs/design/compact-cycler/redesign/summary.ts` for current finite metrics.
4. Run `tests/sim/pass-through.test.ts` and the production-preview browser spec.

The independent producer freshly replays the entire coupled journey, pays captures,
checks reserves and atomically replaces the public artifact. Byte-identical regeneration
is recorded in reproduction.log/profile.sha256. Geometry.py derives the shifted initial
carrier; author.py is a bounded offline shooting tool, not online guidance. It keeps
literal zero-control coast intervals and freezes only completed targeting results.
Native admission remains the safety authority, rather than authoring sample checks.
Final controls/catalogues/reviews/evidence are permanent; no large native trace scratch
or temporary browser service is retained.

## Next gate

Watch the new finite service before extending its free carrier online. Continuous
reuse needs physically bounded/corrected drift, real mass/fuel accounting and an
explicit canonical-period boundary; an arbitrary period and tiny numerical closure
do not license the old modulo reset cache. L1/halo/Lissajous stations remain separate.

[Validation and screenshots](../../../evidence/pass-through.md).
