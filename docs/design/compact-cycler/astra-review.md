**Proceed with the finite witness. Choose a separate `compact-cycler-v1` domain, Beacon turnaround, synchronous surface pads, and conditional reuse of one admitted cycle. Continuous operation should remain gated on physical closure, accounting, and watchability.**

I reviewed six source excerpts, inspected the candidate image, and ran a bounded coast calculation. No edits or delegation.

**Verified facts:** The [search code](/home/s/code/orbital-logistics/docs/design/compact-cycler/study.py:23) uses unsoftened two-source gravity, but its clearance filter checks only sampled positions. Re-solving the successful branch and replaying with tighter DOP853 settings reproduced minimum sampled Aster radius **3.339839**, Moon distance **0.734237**, and maximum radius **6.111500**; terminal position error was **1.14e−11**. This reproduces the coast, not an independent integrator oracle, clearance certificate, or powered mission.

The [Beacon preparation](/home/s/code/orbital-logistics/src/libration/prepare.ts:13) explicitly checks equilibrium in the declared fixed-primary field, synchronous surface geometry, outward release, paid captures, and turnaround funding. The [expedition engine](/home/s/code/orbital-logistics/src/expedition/engine.ts:29) demonstrates synodic recurrence and event-indexed imports. The [Solar compiler](/home/s/code/orbital-logistics/spikes/numerics/solar_transport.py:214) demonstrates frozen, knot-split forward controls and polynomial acceleration bounds. These support the proposed architecture; they do not establish the new coupled service’s correctness.

**The consequential choice is recurrence, especially what makes the next cycle physically admissible.** I recommend per-set Aster and Selene spin equal to the Moon’s orbital rate. This is an acceptable explicit fictional parameter and keeps the desired cadence independently selectable. Preserve other sets.

Retaining Aster spin `.03` does **not** necessarily require online targeting: exact recurrence is also available at the relative-spin period,

\[
T_\mathrm{syn}=\frac{2\pi}{0.0907744457-0.03}=103.3853.
\]

However, retaining the current 54-unit coast would then occupy only 52.2% of that cycle, with substantially more waiting. Synchronous pads are the better fit for this exhibit.

For synchronous pads, rotation/time covariance is valid for arbitrary cycle offsets in this declared field. But symmetry only transforms a solution; **it does not repair a mismatched endpoint or replenish a tank**. Both ships must finish at their designated physical anchors, with matching next-cycle loadouts established by actual operations. Cumulative imports, consumption, deliveries, and fuel expenditure continue increasing.

My chosen physical contract is:

- **Separate domain, immutable cubic acceleration controls.** “Acceleration-commanded” is the accurate description; these are not constant-acceleration arcs. Keep six-state inertial dynamics and the existing prescribed field. Freeze hardware before targeting. Share narrowly useful polynomial utilities, without migrating Runner or importing Solar’s indirect gravity.
- **Beacon capture and dwell.** The checked equilibrium permits a burn-free anchor under this model. Free-flight endpoints continue into insertion; only an admitted paid capture establishes attachment. No free-flight periodic reset. Keep the dwell short, but count it in the complete-cycle coast fraction: the existing 54/64 calculation leaves ten units for **all** remaining phases.
- **One shuttle, two surface deliveries.** Declare support geometry, synchronous phases, imports, capacities, and consumption explicitly. Preserve separate tanks. The shuttle pays velocity matching before attachment and inherits carrier state on release. Carrier burns cannot overlap attachment; reject conflicts instead of inventing additional propulsion semantics.
- **Physical mass accounting.** For each unchanged ownership interval, \(m'=-m\lVert a\rVert/v_e\); thrust is \(m\lVert a\rVert\). Re-anchor mass after cargo/fuel operations. The exponential mass relation still requires a numerically controlled integral of acceleration magnitude. Prove both force and acceleration caps between knots, not just at samples.

**Admission gates, in order:**

1. **Complete finite choreography with frozen hardware.** Admit both carrier burns and all shuttle legs, including every boarding, release, landing, loading, and refueling event. Freeze capture limits and reserve definitions before solving. Define the shuttle’s 10% reserve as at least `.3` fuel after each half-trip, including both captures; also require carrier reserve `.6`. These imply approximate available propulsion budgets of **4.206** and **3.106** velocity units respectively under the stated loadouts. They are budget checks, not feasibility evidence. If hardware fails, document a design revision rather than silently increasing it.

2. **One authoritative forward execution.** Use TypeScript’s admitted canonical execution for the physical template, with independent DOP853 comparison of identical controls and initial states. Split every control knot and ownership/event boundary; compare event-left states before applying corrections. Require step-halving convergence, then freeze the accepted resolution. Never restart propagation from drawing samples, inverse-design curves, or desired endpoints.

3. **Explicit numerical and safety margins.** My starting capture gate is position residual plus numerical allowance **below `1e−7`**, and separately velocity residual plus allowance **below `1e−7`**, in scene units. Target numerical uncertainty at most `1e−8` near captures and surfaces; reject evidence that cannot justify its allowance. Pay the velocity correction conservatively and retain both event sides. Certify continuous clearance against both moving bodies, with bounded subdivision/work and numerical uncertainty included. The `1e−5` supported COM height needs dedicated launch/landing checks; positive outward acceleration at one instant alone is insufficient. A permitted geometric snap must not cross the surface.

4. **Whole-cycle closure and conservation.** At the boundary, compare rotated six-state anchors, attachments, fuel, cargo, and relevant local stocks. Matching loadouts must result from capped imports and debits. Count each `.15` delivery once, each import once, and propulsion expenditure continuously. Check aggregate mass through attachment/release without double counting the carried shuttle. Verify closure across two adjacent cycles, including exact boundary queries on both sides.

5. **Watchability before continuous work.** Show the complete finite journey at one ordinary overview scale and speed. The carrier must visibly spend most of its cycle in broad free flight; both shuttle deliveries must remain legible without compulsory camera changes. Aim for the proposed 84% coast fraction, measured over the complete cycle. Periapsis is still **2.34 Aster radii above its surface**: the Aster taxi legs are substantial excursions. The candidate image supports a broad carrier arc, but cannot establish that these transfers feel local or that the dwell/flight cadence works. If that fails, stop at finite and revise geometry or timing.

6. **Continuous ownership, failure, and bounds.** Cache only under an exact key covering field, spins/phases, hardware/loadouts, controls, event semantics, canonical resolution, and admission tolerances. Rotate inertial positions, velocities, and accelerations by the same constant cycle rotation; preserve local canonical intervals. Verify early and near-`1e6` epochs without accumulating phase by repeated addition.

   The worker owns one frontier and publishes complete resource/event transactions. Forecasting, scrubbing, repeated queries, and retries must apply no operations twice. A failed import or mismatched anchor stops reuse at the last valid state; a failed landing must never be followed by cached “supported” samples. For this single dependent pair, halting is sufficient—rescue and replanning need not enter this slice.

   Enforce the proposed template/reply/sample/cycle limits before publication, including pending and held copies. Preserve **128 total retained units including the 32-unit lead**, one outstanding request, and held-head playback. Exercise boundary cuts, shortage/capture failures, long-run accounting, set switching, and buffer exhaustion. Set the supported playback speed from measured production-browser throughput.

The remaining unverified items are the powered coupled mission, continuous clearance, independent TypeScript convergence, resource closure, and the finite viewing experience. None requires an architectural expansion before the finite witness.
