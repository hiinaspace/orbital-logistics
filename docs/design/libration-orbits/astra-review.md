**I support the barycentric approach and skipping a public planar milestone.** The brief needs tighter orbit-admission and continuation contracts before implementation.

Verified at `f9c397f`: [the general dynamics](/home/s/code/orbital-logistics/src/sim/dynamics.ts:4) support both moving primaries, spatial direct gravity and moving-source clearance bounds. The compact engine and old Beacon probe use the different fixed-primary field described in the brief. The cited [Gaia](https://blogs.esa.int/gaia/2014/01/07/the-flight-dynamics-expertise-behind-gaias-critical-manoeuvre/) and [Webb](https://science.nasa.gov/asset/webb/webbs-orbit-at-sun-earth-lagrange-point-2-l2/) precedents check out. One correction: JPL supplies **normalized rotating-frame states**, not dimensional states; changing units still cannot fix a different mass ratio. [JPL API](https://ssd-api.jpl.nasa.gov/doc/periodic_orbits.html)

My recommendations, in priority order:

1. **Reuse the integrator; explicitly bound the new scenario.**
   Fix the barycenter at the origin and binary plane to XY for this slice: the existing [rotating transform](/home/s/code/orbital-logistics/src/model-set/frames.ts:8) assumes both. Admission should verify opposite phases, mass-weighted radii, common rate, nonoverlapping surfaces and agreement between each rail’s acceleration and the other primary’s gravity. No new force schema is needed. However, [scenario admission](/home/s/code/orbital-logistics/src/sim/schema.ts:135) caps duration at **64** and nodes at **65,536**. Choose an explicit horizon and refinement budget before promising “several periods”; if necessary, use bounded episodes joined at canonical grid endpoints with exact state/fuel continuity.

2. **Make the spatial-orbit gate more specific.**
   Keep planar Lyapunov correction as an internal sanity check. A spatial solve needs a nonzero amplitude constraint and explicit rejection of convergence back to a planar solution; simply perturbing the planar seed is not an admission strategy. Require rotating-frame six-state closure, continuous clearance, and independent full-horizon position/velocity agreement at three canonical resolutions **using the same frozen initial state**. Jacobi convergence alone cannot establish trajectory accuracy. Also measure perturbation growth so the eventual correction cadence has evidence behind it.

3. **Separate phase freedom from physical recurrence.**
   In [decision 5](/home/s/code/orbital-logistics/docs/design/libration-orbits/brief.md:18), quantify phase using a locally continuous, scaled position-and-velocity comparison to the reference orbit. A global nearest-position match can choose the wrong passage. Allow tangential phase drift while bounding transverse error and amplitude; verify that available thrust can control the measured unstable directions. Require fixed control epochs, deadbands, correction/fuel limits and a defined envelope-loss outcome. A finite maintained witness should pass before continuous operation.

   For caching, immutable executed segments need field, absolute epoch, initial six-state, mass/fuel, controls and numerical-policy identity. Periodic reference geometry may be reused; **small closure error does not authorize resetting execution to the seed**. Any rotated execution reuse must also preserve canonical step/event partitioning and account for accumulated seam error. I would defer that approximation contract from the first release.

4. **Keep the first station logistics-free; narrow the first visit.**
   [The prepared-set path](/home/s/code/orbital-logistics/src/model-set/model.ts:78) already permits a vessel with no ports. For the first visitor, recommend a frozen canonical target and a quiet dwell ending before maintenance. Existing [powered-port semantics](/home/s/code/orbital-logistics/docs/design/stationkeeping/README.md:15) deliberately prohibit attached maintenance and exchange; they do not automatically provide loaded-mass stationkeeping. Thrust while attached or relay refuelling should trigger a separate coupled-ownership gate.

5. **Keep field rendering out of the halo release’s critical path.**
   [Field sources and equilibrium markers](/home/s/code/orbital-logistics/src/view/potential-field.ts:8) hardcode the old geometry, and [relief currently shifts object Z](/home/s/code/orbital-logistics/src/main.ts:181). Preserve the brief’s undeformed spatial trails by disabling that relief path for the new domain. A later field adapter must derive sources, rotation and equilibrium markers from admitted binary data. Grid strength and circular fade can proceed independently; use one shared fade coordinate system across overview/detail and fallback outlines.

The proposed mass ratio is a reasonable starting point: the primary/secondary ratio is about 33.3, above the approximately 24.96 triangular-stability threshold. That supports small L4/L5 librations, **not** halo suitability or affordable maintenance. [NASA](https://science.nasa.gov/resource/what-is-a-lagrange-point/)

Recommended sequence: **binary admission → internal planar check → finite spatial halo → human viewing → finite paid maintenance → one quiet visitor → continuous service**. Treat Lissajous as a separate finite exhibit, not a prerequisite for logistics.

Human taste decisions are L1 versus L2, spatial amplitude, trail length and default framing. Select between numerically admitted candidates.

Read-only review completed; no edits, delegation, tests or numerical experiments. Halo feasibility and control cost remain unverified.
