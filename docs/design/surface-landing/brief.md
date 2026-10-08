# Airless return and landing — verified brief, 2026-10-08

User accepted surface ascent/close zoom and confirmed set-switch fix. Approved the
sequence airless landing + finite round trip → continuous surface service → later
3D/stationkeeping/staging/atmosphere. Explicitly prefers schematic ship statistics
and bounded position/velocity attachment over exact hull/contact simulation. Main
loop implements the first finite round-trip slice now; do not redesign the whole game.

Review requested: gpt-6-astra/xhigh, read-only, no delegation. Verify load-bearing
claims then prioritize design forks and deep-spec the highest leverage. Keep the
review bounded: inspect cited modules and run small probes if useful; no full suite,
prior consultations, web survey or broad repo archaeology. About 1,500–2,500 words
is ample. Label evidence [verified:how]/[unknown]; distinguish actual code from proposals.

## Verified environment and baseline

| Item | Fact |
|---|---|
| Host/repo | natto, /home/s/code/orbital-logistics |
| Git | codex/model-set-viewer, ca8b843ab02728689534ea00f5326abcb84e25ec, clean before brief, no remote |
| App | TS/Canvas/Vite, pure Runner; inline workers; 2D viewer, validated six-state core |
| Recent gates | 110 sim,15 production-browser, complete ascent three-step DOP853/resource/event replay; retained artifacts under docs/evidence/surface-* |
| Surface set | fixtures/model-sets/selene-ascent.json; fixed mu=R=1, spin .003, pad COM height1e-6, circular depotR1.25 |
| Ship | dry1, outbound cargo.1, fuel1.4 after initial service, ve3, force5, accel cap3 |
| Ascent | launch.3, arrival1.7207514043, eight fixed-heading arcs, fuel.16669451137 before unloading, no authored impulses |
| Preview | existing production4178, test4179 temporary; no browser changes needed for this review |
| Relevant files | src/sim/{schema,runner,logistics,dynamics,propulsion}.ts; src/model-set/model.ts; src/main.ts; tests/sim/surface.test.ts; spikes/numerics/{propulsion_oracle,surface_oracle}.py |
| Authoring | offline bounded SciPy via uv project spikes/numerics; no runtime ascent/landing optimizer |

Code inspected by owner this turn:
- Surface rail is derived from fixed body geometry, XY physical spin and positive COM
  height. Initial surface `dock` requires exact state at scenario epoch. Later surface
  dock rejects. Orbital dock is tolerance-limited with paid residual velocity, then
  snaps position and attaches. `Runner.#performEvents`, around155–178.
- Launch atomically validates post-service mass/thrust/outward acceleration then
  releases and starts its named arc. Free-flight `certifiedCoast` requires positive
  clearance; no ground contact solver. Landing need not touch mathematical radiusR:
  the existing supported COM target remains at R+height.
- Event order: end thrust, completed service, departure, impulse, arrival/service,
  then new thrust. Schema disallows operations strictly inside arcs, but dock + new
  arc at same epoch currently can attach then fail during thrust startup.
- stockAt counts dock as berth arrival and launch/undock as departure. Viewer nextDock
  searches only `dock`; future route length and status depend on that helper.
- Drawing: uniform2049 samples plus4097 launch-window samples from launch through
  next2 time units. A return near t10 would not get these dense samples.
- Snapshots remain canonicalv3, validated by deterministic replay. Old semantics can
  remain exact if landing is an additive explicit operation, not broadening `dock`.

## Proposed bounded content

Retain original ascent fixture unchanged; add a separate surface round-trip set.
Reuse the exact outbound program. Unload, load a small return consignment and refuel
from actual finite orbital stocks, wait for a suitable departure, execute a bounded
coast/brake/final-approach program, land at original rotating Cairn, unload and dwell.
Potential numbers: .05 return cargo, .95 refuel at depot; preserve explicit mass/fuel
ledger. These are authoring candidates, not feasibility claims. Bound total horizon
and step/node count (max65536); solve on coarse steps then admit unchanged program at
three steps plus independent DOP853. Defer runtime scheduling/recurrence to the next
slice so contact semantics and fleet runtime are not changed together.

Main is independently studying bounded landing controls while you review semantics.
No engine/schema implementation before disposition. Authoring may choose departure
and arrival time, coasts, fixed headings and throttle; no atmosphere, attitude/hulls,
terrain, stage graph, general optimizer or extra camera UI.

## Open forks and owner leans

### A. Explicit land versus broaden surface dock

Lean additive `land` operation, same portId/time shape as dock, only surface-v3
logistics and after initial epoch. Initial exact `dock` behavior remains unchanged.
Old readers reject unknown operation; top-level model bump unnecessary if accepted
old snapshots remain exact. Alternative new logistics version merely for adding
operation seems unnecessary, but decide based on semantic compatibility, not naming.
No global auto-contact detector: an authored `land` event attempts capture at its
precise epoch and otherwise rejects safely.

### B. Capture envelope and safety

Lean reuse small explicit position/relative-velocity envelope and existing paid
rocket residual matching, then snap to supported COM. New land input requires
position tolerance <= COMheight/4 (or derived tighter effective bound), so proximity
cannot stand in for crossing the surface or a large last-moment teleport. Keep all
free-flight interval certificates unchanged. Target is COM, not renderer glyph/hull.
Relative speed is norm vs rotating pad, not radial speed only. Finite burn supplies
nearly all braking. Independent pre-snap residuals +1e-8 each <1e-7 for authored set.

Potential subtleties: approach from below supported COM but above actual sphere;
upward arrival versus descent; whether touchdown must require nonpositive radial
relative speed within numerical allowance, or small full relative speed suffices;
matching pad tangent while outer body spin below tensile support threshold.
User allows schematic tolerance capture; do not add detailed contact/leg physics.

### C. Atomic event ordering and fuel

Lean burn-end before land; reject land if another arc starts or impulse occurs at
that epoch, preventing attachment then same-epoch engine failure. Permit transfer
start after successful land at same epoch (existing dock + transfer convention).
Validate no existing attachment/service, envelope and finite fuel before any landing
mutation. Charge residual velocity using post-flight mass; failure keeps free state,
fuel and operation cursor. A prior thrust-end is a legitimate completed event and
must not be rolled back. `land` ledger counts one berth arrival, no synthetic dock.
No zero-fuel exception for nonzero capture residual.

### D. Failure presentation and close sampling

Lean keep prepared-set admission strict; no half-valid showcase. Unit fault cases
verify deterministic paid failures. Add dense disposable samples for the final2
units preceding land and its exact before/after boundary. Bounded error budget at
1million px/R; reject oversized content work rather than unbounded samples. Existing
Launch view becomes a generic Surface view, useful for both departure/arrival,
without automatic frame/rate changes. `nextDock` should treat land as arrival, event
label Touchdown; pad occupancy and service timelines update exactly once.

### E. Authoring and architecture seam

Lean first solve a reference circular-orbit → supported pad witness, exploiting
fixed-primary rotational symmetry to choose the global departure phase/time; freeze
all epochs and replay full original ascent → service → return. Fixed headings,
coast and throttle suffice if a bounded search finds a safe witness. Smoothness is
an authoring preference, not added inertial forces. If near-ground convergence is
poor, use more/shorter terminal arcs before considering continuous steering.
No automatic mission compiler or a reverse-time burn pretending fuel is restored.
Future continuous surface runtime will need committed finite episodes/window retries
and finite stocks; preserve original exact local epochs as in existing traffic.

## Admission and review output

Recommend a concrete minimal contract and disposition; main can resolve engineering
choices without human approval. Only new visual taste could need user feedback.
Executable gates should cover envelope just inside/outside, excessive vertical and
lateral speed, underfuel rejection, no partial attachment, same-epoch arc conflicts,
service after touchdown, berth/mass conservation, relaunch after service, exact event
sides, snapshots/query partitions, unchanged previous saved snapshots, full three-step
independent descent/end resources/paid residuals, certificate clearance and dense
close-view error, production browser frame/scrub/set-switch behavior.
