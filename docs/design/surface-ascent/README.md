# Airless ascent — reviewed contract, 2026-10-08

The first surface set is a finite freight ascent on fictional Selene, in the XY plane:
load at Cairn, release under thrust, insert into Lantern's circular orbit, unload,
then remain attached. No player steering or runtime ascent optimizer is required.

[Verified brief](brief.md), [Astra review](astra-review.md),
[transport](astra-transport.json), and the disposition below preserve the design call.
The reviewer actually ran `gpt-6-astra`, `xhigh`, CLI 0.153.4, read-only, session
`01a11ce4-98b6-78b2-8c08-3c333eba0628`, exit 0. Header and exit were verified before
reading its final report. Subscription run; marginal cash cost and metered bill unavailable.
The report verifies code and boundary probes; full ascent admission was the owner's
subsequent work, recorded in [evidence](../../evidence/surface-ascent.md).

| Decision | Disposition | Implementation / reason |
|---|---|---|
| Support versus general contact | Adopt supported point COM | Fixed primary, physical XY spin, positive vehicle COM height; unchanged free-flight collision and clearance guards. No singular start, free speed or clearance exemption. |
| Release and first burn | Adapt to atomic launch | `launch` names `thrustArcId`. Validate post-service mass, capped thrust, fuel and outward radial acceleration before releasing support and activating that exact law. Failure retains support and launch cursors; prior completed service stays completed. |
| Initial attachment | Adopt narrow dock branch | Exact shared analytical pad state at scenario epoch only. Ordinary surface undock and later surface docking reject. No orbital capture tolerance used to place a ship on the pad. |
| Wire compatibility | Adopt logistics discriminator only | `surface-ports-v3` admits surface/circular ports; canonical schema/model/snapshots remain v3. Legacy surface fields reject before conversion. Before-change retained snapshots replay identically. |
| Authoring | Adopt circular insertion before depot phase | Eight fixed inertial full-throttle arcs authored with bounded offline SciPy. Depot phase chosen once from insertion, saved, then the entire frozen program replayed from start. No runtime relocation, hidden steering or optimality claim. |
| Step budget | Adapt to measured grid | Full witness at 1/512, 1/1024, 1/2048; production 1/1024 uses 6,177 nodes. Near-surface certificate subdivisions remain deterministic. |
| Launch readability | Adopt expanded bounded work | Explicit Launch view, existing ship follow/rotating/orbit views, zoom up to 1 million px/R, playback down to 2^-12 units/s, dense disposable launch samples, fixed schematic pad/ship glyphs and scale indicator. No automatic camera/speed switch during flight. |
| Staging seam | Adopt documentation, defer hierarchy | Launch preserves ship ID and masses. Future separation must transfer child dry mass/cargo/reserved propellant without duplication; reserved child fuel cannot feed parent engine. Colocated zero-impulse children inherit velocity. Paid separation impulses must conserve momentum and specify energy/resources. |

Owner spot-checks confirmed the review's highest-leverage findings: `Runner` previously
released in the departure phase before finite-thrust startup; `stockAt` only counted
undock departures; uniform whole-scene display sampling could smear a close launch;
logistics parsing explicitly selected homogeneous rail families. The implemented
contract directly addresses these findings. The successful free-flight study was not
accepted as a supported launch until the full service/release/delivery gates passed.

## Physical and event semantics

A surface rail names its body, COM height, physical spin and longitude. Validation
derives its radius/center/XY basis from the fixed body; supplied derived geometry is
not authoritative. `R + height` must be representably greater than R, spin must remain
below the unpowered circular rate, and pads on a body share one spin. Analytical pad
velocity is inherited on release. View-frame rotation never changes physical spin.

Surface dock is allowed only at the initial epoch with exact six-state equality to
the pad helper. Loading and refueling use existing finite service semantics. Launch
must follow initial attachment and reference its next finite arc at the same epoch;
other operations/impulses at that epoch are rejected during schema validation.
Service completion precedes launch. A successful event emits `launch`, then
`thrust-start`; it changes neither position, velocity nor fuel instantaneously.
Berth accounting counts launch exactly once.

With radius r, pad spin ω, outward unit n, thrust direction d, mass m and effective
capped force F, release requires `F/m * dot(d,n) - μ/r² + ω²*r` to exceed
`1e-12 * max(1, μ/r², outwardThrustAcceleration)`. This is radial-distance
acceleration from inherited motion, not an added centrifugal force in inertial
propagation. Positive fuel and force are required. Free-flight safety certificates
then govern every interval; a later bad heading/depletion still has a paid prefix.

The content uses COM height 1e-6 R and spin .003 in normalized units. This is a
supported point outside a spherical boundary, not a hull/leg contact model.
[NASA lunar data](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)
informed the slow-spin scale; this is a fictional set, not a lunar mission replay.
Changing COM height changes the physical launch geometry and final intercept; the
retained half/double-height probes establish smooth, safe sensitivity, not unchanged
capture at a fixed depot.

`ascent-study.py/json` retain bounded authoring, `assemble.ts` freezes the admitted
set, and the boundary/free-flight/height probes retain the pre-implementation studies.
`legacy-snapshots.json` was generated before changing the simulation, at HEAD
`2cd91af`, from legacy freight and powered sets. Its regression checks are not merely
new-code round trips. Reports and snapshots are durable; transient review transcript
was trimmed after its original SHA256 was recorded.

Landing, launch recurrence, aeros, terrain, staging/recovery, live ascent solving,
3D camera and simultaneous inset remain separate slices. The future staging ownership
contract does not require adding unused vehicle hierarchy to this implementation.
