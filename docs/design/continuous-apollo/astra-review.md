# Continuous Aster–Selene expedition: architecture review

Reviewed 2026-10-10 against finite Apollo, lunar engine/store, shared worker and
viewer sampling. Approved for the narrow authored timetable below, subject to
admission and evidence gates. This review is not completed runtime evidence.

## Decision

Use a separate versioned continuous-Apollo runtime, one stable ship identity,
one immutable compiled expedition and one global clock/resource owner. Reuse
canonical physics through exact time/rotation symmetry of this fixture. Keep the
accepted finite set unchanged. Do not add an optimizer or flight integrator.

Worker current-state queries call prepared.sample(localEpoch) and rotate the
physical result. Main-thread queries may interpolate the canonical display
template and rotate that disposable result. Display samples never initialize
physical flights or certify capture. Compile/admit the entire template before
publishing ready; immutable strict symmetry needs no later flight search.

## Admission

With Moon rate w = 0.09077444574328174 and home/air spin s = 0.03,
T = 2*pi/(w-s) = 103.38531648187275. Cycle k starts at k*T with constant rotation
k*s*T about physical positive Z. Rotate both position and inertial velocity.
There is no rotating-frame velocity correction for this constant rotation.

Require world(k*T+tau) = R world(tau) for bodies, pads, gravity, atmosphere,
steering and entry/recovery. Derive origins/angles independently from integer k,
not accumulated periods or repeated rotation. Identity is cycle index plus
canonical event identity, not a floating-point timestamp.

Strictly admit fixed-origin primary, concentric planar circular Moon, compatible
equatorial pad frames/rates, synchronous lunar pad and axisymmetric atmosphere
with admitted spin axis. Reject arbitrary world edits, incompatible axes/rates
and absolute directional/time forcing. Require finite usable T and enough gap
for recovery, transport, refill and next launch. Include all hardware, controls,
policy, atmosphere, guidance, recovery, geometry and initial fuel in the frozen
compilation identity; a scene ID or matching scalar rates is insufficient.

Reported body/pad/gravity covariance near 1e-14 is promising preliminary evidence,
not a complete certificate. Test force/guidance/recovery and seams. Establish
and test a finite supported calendar: one million units is a reasonable target,
but large epochs eventually lose phase/event precision. Reduce the range if
numeric margins cannot support it.

## Recovery and replenishment

Keep all finite physical seams and paid lunar capture. Entry retains its actual
dissipative recovery impulse. Never correct an airborne endpoint for recurrence.
Use exact recovery time/pose, not finite display end 87, as the operation origin.

The proposed turnaround is acceptable: ocean support, short visible dwell/fade,
explicit positive-duration supported ground transport while hidden, arrival
at actual home pad, and later refuel. Carry identical dry mass and residual
fuel throughout. Ground transport is externally supplied schematic logistics,
not spacecraft thrust or ballistic flight; record start/end and duration.

Fade requires availability/presence semantics wherever relevant: selection,
labels, follow/frame origins and trails. Keep pre/post boundaries and suppress
Hermite/path interpolation across transport. Merely hiding the glyph is
insufficient. Do not keep the old recovery provider active through transport
or next launch. Supported destination is the exact global pad state.

An atomic transaction at k*T-2 importing the exact shortfall, crediting/debiting
home stock and topping the tank up to 6 is valid. Declare max import per turn
(proposed 4), reject templates exceeding it, and retain initial seeded tank fuel
separately from imports. Net-zero depot inventory is fine when import/transfer
are explicit. Validate transport/service completion before refill and launch.

The standing replenishment contract makes future timetable occurrences known;
it does not make their payments actual. Publish imports/refuels only when the
head crosses their operation epoch. Future resource anchors must not leak into
actual stock reads. No shortage/retry scheduler is needed for this guaranteed
contract. If scarcity is added later, remain at the pad and skip whole recurrence
windows; do not launch the cache with different mass/fuel or move world phases.

Maintain initial fuel + imports - exports = ship tank + depot stock + cumulative
propellant consumed within stated tolerance. Water dissipation is not propellant
use; refill never resets cumulative use. k*spent + localSpent is valid only with
the correct completed-flight count and phase; retain completed usage through
transport/wait. Skipped windows would require count separate from window index.

## Runtime, delta and history

Keep definition/admission, physical engine, compact delta and disposable view
store separate. Engine owns one prepared cache, head, integer operation cursor,
actual anchors/counters and bounded occurrence records. Delta has a distinct
domain, frontier/oldest, current/left-anchor states, operation/resource rows,
descriptors, stats and halt reason. Send canonical SceneView once at startup.

Reuse worker generation/sequence handling and shared Pause/Play/Live behavior.
No lunar shooting loop is needed. A standing timetable may forecast through the
current mission end or frontier+32, but forecast rows are distinct from actuals.

Retain 128-unit history with a left state/resource anchor and right interpolation/
event-left brackets. A pending reply may extend head after Pause without moving
the held cursor or deleting its brackets. Release held retention through existing
Play/Live behavior. Engine accepts simulation targets, never wall time. Restart
reseeds; historical playback does not.

Use delivery watermarks or prune posted-ID bookkeeping; never grow sets forever.
Bound resource anchors too. A 32-unit lead is a presentation/performance choice,
not a physics requirement; cache lookup may make no-lead viable as well.

## Viewer blocker and adapter

model.ts currently applies recoveredState in stateAt for every epoch after the
singular entry recovery before trajectory dispatch. sampleVessel also treats
entry as active forever after activeFrom. Both assumptions block recurrence.

The proposed VesselView.recurrence adapter before both generic paths is the right
fix. Resolve cycle/phase per queried epoch. Per-cursor top-level entry metadata
alone is insufficient: timeline, trails, paths and frames query other epochs.

The adapter may sample the canonical drawing template locally and rotate every
vector output: state, axis, thrust direction and aerodynamic vectors. Shift
event/boundary epochs and cumulative fuel consistently. Visible global arcs need
rotated directions/steering keys; key offsets remain local. Global provider
metadata also needs shifted entry scenario epoch, activeFrom, entry/braking/
recovery epochs, rotated recovery pose/center/spin/impulse and initial states.

Per-cursor entry metadata is acceptable for current UI readouts only. Audit helpers
using it at other epochs: main.ts synthesizes future terminal-braking paths from
the entry object, so that path must resolve its occurrence. Global world bodies
and pads stay on unchanged analytical rails; rotating them again double-counts
phase. Docked sampling must resolve the actual global pad.

Transport/refill must suppress stale recovery/aero/thrust overrides. Recovery
summary metadata belongs to the inspected occurrence. Keep stable ship identity.

## Work and storage

Retain one physical template within current Apollo 100,000-node/40 MB ceilings,
one display template within 40,000 samples/12 MB, and compact descriptors.
Reported roughly 8 MB display template should be sent only once.

For 128 history +32 lead +87 forecast +one-unit pending reply, conservative cycle
descriptor bound ceil((128+32+87+1)/T)+1 is four. Derive it from admitted values,
not a hardcoded coincidence. Count held rows and brackets separately. Clip dense
materialization to required intervals instead of cloning four entire missions.

A practical initial materialization ceiling is 120,000 samples/36 MB serialized
rows, conditional on measuring actual representation; shared-template sampling
avoids raising it. Account for template, materialized strips, held state, pending
reply, brackets and initialization copies in their respective ownership measures.
Serialized bytes are not a browser heap guarantee.

Bound canonical operations per advance request and large direct jumps. Sampling
must not loop from cycle zero. Expose compilation count, physical nodes/bytes,
drawing bytes/sample count, descriptor/event/anchor counts and peak reply bytes.
After warm-up these retained counts must plateau.

If later-epoch certification creates a second full physical owner, account for
combined transient peak or run certification as a separate evidence process.
Unexpected errors preserve the last complete published epoch and reason.

## Evidence gates

1. Finite parity and negative symmetry admission fixtures; provider covariance
   including forces, steering, supported states, recovery and nontrivial phases.
2. Independently integrated later occurrence at absolute epoch with rotated
   controls and unchanged global world. Compare seams, paid lunar capture,
   entry/recovery epoch, fuel and load maxima. Preserve finite landing margins
   and whole-mission envelope. Display-sample comparison is not this certificate.
3. Late-calendar phase/event probes, no accumulated period/rotation drift, and
   explicit calendar-end refusal.
4. At least two full expeditions with transport/refill/import conservation,
   event-left/right states and partial-flight fuel totals. Coarse/fine advancement
   and arbitrary display queries produce identical committed operations/resources.
5. Long-run eviction, bounded IDs/anchors/rows/physical owners and initialization/
   pending/held reply sizes. Repeated restart does not retain old template owners.
6. Browser second-cycle launch/landing/entry, recovery/transport/refill/next launch,
   old-cycle queries with later metadata, non-grid Pause during pending reply,
   Play/Live, frames/follow, close zoom, no transport trail bridge and no stale
   entry telemetry or recovery override.

These gates establish the bounded numerical/runtime/viewer witness. User viewing
remains experience assessment, without adding a gameplay or authoring gate.

## Implementation review follow-up

Reviewed initial implementation in src/expedition/{engine,query,view}.ts and
model/main/worker adapters after the reported 100-cycle test. The one-cache
physical ownership, per-query recurrence dispatch, global analytical rails,
atomic explicit fuel import and bounded resource/event retention follow the
approved architecture. The following findings were sent to the implementation
owner for correction before delivery; this list records the reviewed snapshot,
not a claim that subsequent fixes are absent.

- Calendar endpoint: view's outer max(cursor+.1, ...) can exceed maxEpoch.
  Eager full-cycle construction also queries the final partial cycle after
  maxEpoch. Clip construction and view bounds and publish a terminal halt at the
  admitted calendar limit. Exercise both near-limit and exact-limit views.
- Transport visibility: opacity alone does not suppress ship-centered reference
  frames or camera follow. The hidden recovered-to-pad state jump is still a
  camera/world jump unless unavailable-origin or equivalent explicit handling
  covers the transport discontinuity. Paths need breaks as well as hidden icons.
- Event boundaries: returning boundaries:[] loses exact capture/refill jumps
  from fuelGraph, which reads rows/boundaries independently of sampleVessel.
  Transform canonical boundaries and supply explicit refill left/right states.
- Ground milestone identities must include their cycle index, as ordinary
  mission event identities already do.
- Retained-byte/sample guards must count cached complete cycle rows plus the
  shared template and held/pending overhead, not only the clipped arrays returned
  by view(). At most four descriptor rows does not alone bound serialized bytes.
- Later-entry whiskers now enumerate cycles rather than relying on singular
  current-cursor metadata. Preserve that per-epoch treatment for other helpers.

The parent subsequently reported tightened independent DOP853 results for cycles
0 and 17 within original numerical envelopes after a loose-tolerance comparison
failed its recovery-epoch bound. Record both passes as convergence evidence;
do not silently omit the failed loose pass. Cycle 2 rerun and browser evidence
remain the implementation owner's validation work.

### Follow-up verification of corrections

The revised calendar implementation was exercised directly: view(999999)
returned window [999871,1000000], view(1000000) returned
[999872,1000000], and the engine published "Exhibit calendar ended".
Final-cycle clipping and endpoint handling are therefore verified for these
cases. Source inspection also confirms atomic pending import transactions,
cycle-qualified ground IDs, retained complete-row guards and restored boundaries.

Two follow-up corrections were requested:

- The new frameOrigin blend is valid camera presentation data, but must not replace
  actual state in the shared physical frames.transform. Its held position even
  retains a nonzero water velocity, so using it there changes physical relative
  coordinates/velocity. Keep blending in tracking/pivot only and handle unavailable
  ship-centered origins explicitly.
- Insert exact boundary.after rows at every boundary epoch. Refuel samples built
  as k*T+(T-2) can differ from engine/boundary epochs (k+1)*T-2. At k=6 the values
  are 721.6972153731093 and 721.6972153731092 respectively; exact-key fuel graph
  handling would miss the boundary. Use one indexed operation epoch formula and
  retain the exact sample/boundary pair, including transport completion.

### Final source disposition

The final follow-up source resolves the two remaining findings. frames.ts has
no diff from the physical-state implementation; frameOrigin is consumed only
by camera tracking/pivot and explicit hidden-frame fallback in main.ts.
Ship-centered display falls back to inertial during hidden transport while
physical stateAt and frame transformations retain their original meaning.

Cycle rows now insert every exact boundary.after after other drawing samples,
with exact-epoch deduplication. Transport provider/boundary formulas agree and
refill boundaries use the engine's indexed epoch. The regression checks every
retained boundary has a matching drawing sample.

No further architecture or source-correctness blocker was identified in this
review. Final browser/full regression outcomes remain the implementation owner's
delivery checks; this source disposition does not claim those pending checks pass.
