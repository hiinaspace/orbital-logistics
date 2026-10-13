# Spatial libration exhibits — proposed sequence

2026-10-12. Planning only; no dynamics or viewer changes in this pass.

The next visible target is a compact fictional binary with a spacecraft on a
spatial halo orbit. Its three-dimensional trail in the binary rotating frame is
the main exhibit. A Lissajous companion and station traffic follow after the
finite orbit is validated. The existing fixed-Aster scenes retain their field,
programs, resources and caches.

## 1. Finish field presentation

Add a grid-strength slider with a dimmer default. Apply a smooth circular envelope
to grid, contours, tint and edge strokes so rectangular tile boundaries do not
rotate into view. Keep the envelope's center/radius consistent across overview
and detail coverage; it must not expose a new rectangle during pan/Follow or
change physics. Preserve a subtle curved silhouette inside that envelope.

For the spatial exhibit, optional field rendering is an explicitly identified
orbital-plane slice. It is not a volume or the potential along every spacecraft's
path. Spatial ships and trails retain their true z; do not apply the old
coplanar rubber-sheet displacement to them. Default to ordinary 3D trails without
a relief surface. A faint plane/projection can be optional if it helps orientation.

## 2. Admit an accelerating circular binary

Use barycentric inertial coordinates: both bodies move on opposite circular rails
about their shared center of mass. With separation a and gravitational parameters
muA, muB, the common angular rate is sqrt((muA+muB)/a^3); orbital radii are
a*muB/(muA+muB) and a*muA/(muA+muB). These analytical rails are an exact circular
two-body solution. Ships remain restricted test particles; this does not require
integrating the massive bodies numerically.

The general canonical Runner already accepts moving circular sources and sums
direct gravity. Reuse that integration/event engine, with an explicitly admitted
binary descriptor and separate exhibit/cache identity. Do not reuse compact
hardcoded gravity, support providers or field shaders merely because body names
match. The initial factory enforces the two masses, common phase/rate, opposite
positions, bases, separation and barycenter. Fix the barycenter to world zero and
the binary plane to XY, matching the existing rotating-frame transform; reject
rate/phase mismatches and overlapping source surfaces. Body-centered views subtract the
moving body's actual state; rotating views use the binary basis about its
barycenter. Follow/Chase remain presentation.

Start near the familiar compact scale (muA=1, muB=.03, separation5,
radii1/.2). Suitability for a clear spatial orbit is not yet measured: tune
separation/radii or mass ratio deliberately if clearance or appearance demands it.

Admission gate: each body's acceleration equals the gravity of its companion;
all five rotating equilibria have small force residual; independent barycentric
and primary-relative propagation agree; unpowered Jacobi error converges under
canonical refinement; body clearance and per-vertex frame epochs remain valid.
L4/L5 markers become available only on this admitted field.

Ordinary gravity potential and rotating effective potential are separate scalar
choices. The latter adds centrifugal potential and supports Jacobi/zero-velocity
contours. It still omits the velocity-dependent Coriolis term from its scalar
landscape. A new plane-field backend is required; the current compact shader's
fixed masses/positions cannot silently stand in for it.

## 3. Release a finite spatial halo exhibit

Use offline differential correction/continuation. A planar Lyapunov orbit is an
internal shooting regression, not another mandatory public milestone. Find one
readable, safely separated L1 or L2 halo orbit, selected by measured geometry and
numerical conditioning rather than by the name alone. Search has explicit work,
time and amplitude bounds; a failed search changes the seed/parameters.

Validate the corrected six-state initial condition with independent DOP853 and
canonical refinement using the same frozen initial state at three resolutions.
Require nonzero spatial amplitude and reject convergence to a planar solution.
Check full-horizon position and velocity agreement, not only a scalar invariant.
The current scenario caps duration at64 and nodes at65,536: choose the horizon
and refinement budgets before deciding the number of circuits, or join bounded
episodes at canonical grid endpoints with exact state/fuel continuity. Report
rotating six-state closure, phase,
clearance, Jacobi drift and growing-mode sensitivity, and bound drawing error at
close zoom. Periodic mathematical closure does not justify unlimited replay of a
numerically imperfect trajectory. A finite prepared ephemeris is sufficient for
the first release; initial spacecraft placement does not claim a solved insertion
transfer.

Viewer gate: the loop reads clearly in rotating and body-centered views, has
obvious vertical extent at an oblique angle, and is spatially legible alongside
both bodies. Recommend a trail duration in orbit periods. Field map and relief
are optional and do not gate this release.

## 4. Add Lissajous motion, then operations

Add a finite Lissajous/quasiperiodic witness with independent horizontal/vertical
motion, preferably as a second selectable scene or companion if density permits.
Halo is periodic; a generic Lissajous path does not close after one circuit.
Validate its actual finite horizon and do not wrap a supposed period. Begin with
a bounded numerically shot center-motion witness; if unstable leakage is too
large, use a bounded multi-arc boundary-value construction rather than hand-drawn
sinusoids or pretending a small vertical perturbation is an indefinitely valid
Lissajous orbit.

Lissajous is a separate visual exhibit, not a prerequisite for halo logistics.

Next, add small paid stationkeeping corrections with measured correction cadence,
drift tube, fuel use and solve cost. Target unstable growth and orbital geometry;
only constrain phase where service rendezvous actually requires it. Track phase
continuously using scaled position and velocity, rather than global nearest
position at a potentially ambiguous passage. Specify fixed control epochs,
deadbands, thrust controllability, correction/fuel caps and an envelope-loss
outcome before admission. Finite
stationkeeping is the bridge to continuous operation, not a full online transfer
optimizer. Immutable executed segments need field, absolute epoch, initial six-state,
mass/fuel, controls and numerical-policy identity. Reusing reference geometry
does not authorize resetting execution. Defer rotated execution-template reuse
until seam error and canonical event/step partitions are explicitly admitted; cached display interpolation is never a physical target.

Then solve one finite visiting ship against a frozen canonical physical target,
with paid capture and a quiet dwell ending before the next maintenance burn.
Existing powered-port semantics prohibit attached maintenance and exchange;
loaded-mass station thrust or relay refuelling needs a separate coupled-ownership
gate. After that passes, continuous
bounded forecasts and rolling playback can reuse the existing publication
pattern. A Lissajous station needs actual future forecasts, not an exact-recurrence
assumption. Larger traffic networks and third-body perturbations are later sets.

## Sources and verified starting points

- [JPL periodic orbit API](https://ssd-api.jpl.nasa.gov/doc/periodic_orbits.html):
  orbit families, barycentric rotating states, normalization and stability data.
  Catalog states are tied to a mass ratio; use matching seeds or continue to our
  ratio, rather than simply rescaling Earth–Moon coordinates.
- [heyoka periodic-orbit continuation example](https://bluescarni.github.io/heyoka.py/notebooks/Periodic%20orbits%20in%20the%20CR3BP.html):
  variational propagation and numerical correction/continuation methods.
- [NASA Webb orbit diagram](https://science.nasa.gov/asset/webb/webbs-orbit-at-sun-earth-lagrange-point-2-l2/):
  useful precedent for making the spatial halo shape visible.
- [ESA Gaia flight dynamics](https://blogs.esa.int/gaia/2014/01/07/the-flight-dynamics-expertise-behind-gaias-critical-manoeuvre/):
  Lissajous motion above/below the primary plane and operational stationkeeping.
- Current source: src/sim/dynamics.ts, src/compact/physics.ts,
  src/solar/ephemeris.ts. Existing actual-field planar shooting is preserved in
  docs/design/libration-service/lyapunov_probe.py; its states are not new-binary
  solutions.

[Review brief](brief.md), [Astra review](astra-review.md) and
[disposition](disposition.md) record the reviewed boundaries and sequencing. No new orbit suitability, solver runtime or continuous stability has
been measured in this planning pass.
