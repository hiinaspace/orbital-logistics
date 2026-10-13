# Spatial libration implementation review — 2026-10-12

Read-only bounded Astra check of the implemented slice, following your reviewed plan.
User authorized Webb/Gaia/WMAP inspired compact fictional Sun–Earth L2 sets, with
launch/insertion if feasible after validating orbit. Current scope: three finite
60-unit exhibits: coast-only halo, finite Lissajous center-motion BVP, and bounded
parking-departure/insertion into halo. Ground ascent is expressly not claimed.
No continuous maintenance or logistics in this slice.

Verified source: src/binary/model.ts uses existing direct-gravity canonical Runner,
admits barycenter0/XY/circular opposite rails/common rate/ratio/accelerations,
no logistics/operations, one vessel. Separate circular-binary-set-v1 identity.
mu fraction .003, total1, separation4, n=.125, source radii .65/.1. L4/L5 true
rotating equilibria; no influence from old compact field shaders.
New L2-centered rotating frame src/model-set/frames.ts uses physical reference
position+velocity, undeformed spatial trails. A bounded value-key equilibrium
cache avoids per-vertex root shooting. Old coplanar relief remains scoped to
compact sets. New grids have strength .55 and circular fade8→11 in source basis;
flat maps share circular envelope; no rectangular rim strokes. Observatory glyph
is schematic display, not attitude physics.

Numerical evidence: docs/evidence/libration-orbit-native.json and
libration-orbit-oracle.json generated from frozen fixtures and independent DOP853
rotating/barycentric-primary-relative equations. Coarse3-grid sequence1/64,1/128,
1/256 exhibits convergence; shipping1/1024 reaches roundoff-amplified floors, so
we do not claim arbitrarily finer steps monotonically improve unstable flight.
Full60-unit shipping6-state errors halo2.32e-8, Lissajous4.65e-8,
insertion5.72e-8. Relative-coordinate/oracle tightening also bounded<1e-7.
Full native certificate no collisions. Program has no impulses/resets, .04
acceleration cap, totalfuel .06840857 paid; finalreserve .33159143.
Independent insertion terminal residual1.35e-13. Halo continued from JPL normalized
EarthMoon seed to fictionalratio; no reused states across mismatchedfields.
Planar internal closure4.07e-13, spatial halo closure8.65e-12 offline.
Lissajous is a finite BVP center-motion witness, no exact quasiperiodic torus proof
and no period wrapping. Need phrase this boundary accurately.

17 focused numerical/camera/glyph/field tests pass. Production browser tests are
running: one stale selector was corrected (#speed-slider→#speed); grid-strength
case passed. Browser screenshots and screenshot visual inspection still pending.
Existing user reports/research untouched; preview4178 maintained; no pushes.

Verify before critique; do not run costly experiments, edits or subagents. Audit
only load-bearing new contracts, stability/continuation claims, renderer safety
and frame correctness. Flag must-fix issues with file/line and evidence. Do not
re-review past control/worker systems or invent full Nbody/volumetric fields.
