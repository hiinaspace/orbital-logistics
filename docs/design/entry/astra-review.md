**I recommend an isolated `entry-flight-v1` domain.** The architecture is appropriate for one prepared atmospheric arrival, but the safety certificate, recovery event, and thrust/mass contract need to be explicit before admitting a witness.

I verified the core seams at `c9335d2` and ran five focused test files covering Runner, propulsion, landing, sensitivity, and staging; all passed. No files were changed or agents launched. Two untracked entry files appeared during the review; I inspected them as draft inputs, not validated implementation. I did not run an atmospheric oracle or browser acceptance pass.

The priorities are:

| Priority | Finding | Required disposition |
|---|---|---|
| **P0** | The existing clearance certificate assumes gravity plus a separately bounded thrust acceleration. Velocity-dependent aerodynamics invalidate a bound taken only at the interval’s initial state. | Establish a bound over the whole candidate interval, including RK stages, before propagating. |
| **P0** | Existing `land` is a scheduled, paid capture at a named pad. Splashdown is a trajectory-triggered transition that removes momentum through environmental contact. | Introduce a distinct recovery event with deterministic root detection and explicit before/after accounting. |
| **P1** | The draft fixture contains feedback-guidance parameters. Existing anchored fuel laws assume prescribed thrust behavior. | Choose the thrust contract now. For feedback braking, use a seven-state entry integrator with fuel evaluated at every RK stage. |
| **P1** | Legacy validation silently discards unknown atmosphere/aero fields. | Make entry a strictly discriminated domain, with no fallback through legacy validation. |
| **P1** | The viewer can display another finite domain, but surface controls and telemetry are not yet domain-neutral. | Add explicit entry presentation data and recovery support; do not manufacture a logistics port. |

The following is the minimum specification I would freeze.

1. **Keep the isolation boundary, but distinguish it from staging’s precedent.**

   Staging isolates mission ownership while delegating every trajectory to existing Runners. It does not demonstrate a second force law or integration policy. See [staging.ts](/home/s/code/orbital-logistics/src/model-set/staging.ts:77).

   Use a separate authored definition, validator, bounded integrator, and `SceneView` adapter. Reuse pure vector, body-ephemeris, and steering helpers. Leave legacy Runner, snapshots, targeting, and sensitivities unchanged. The sensitivity implementation explicitly differentiates gravity and its existing thrust model; it cannot acquire drag implicitly. See [sensitivity.ts](/home/s/code/orbital-logistics/src/sim/sensitivity.ts:9).

   Admission should require one fixed spherical primary, one atmosphere, one vessel, one finite mission, and an in-plane witness. The force kernel may remain fully three-dimensional. Restrict physical spin to the existing Z-axis convention for this slice.

   Reject unsupported versions and unknown **physical** fields. My in-memory probe confirmed that adding atmosphere and aero fields to a legacy bundle currently succeeds, drops those fields, and produces the unchanged vacuum trajectory. This follows from reconstruction in [schema.ts](/home/s/code/orbital-logistics/src/sim/schema.ts:129). Entry data must never reach a permissive legacy fallback.

2. **Specify forces, units, and controls independently of the glyph.**

   With body-relative position \(r=x-x_b\), define:

   \[
   v_{\rm air}=v_b+\omega\times r,\qquad
   u=v-v_{\rm air},\qquad q=\tfrac12\rho |u|^2
   \]

   Store `dragArea = Cd*A` explicitly, so:

   \[
   F_D=-\tfrac12\rho\,\mathrm{dragArea}\,|u|u.
   \]

   This avoids dividing by airspeed. At zero airspeed, both aerodynamic forces must be exactly zero. NASA supports the drag relation; Orekit independently uses a corotating atmosphere and divides drag force by actual spacecraft mass. These precedents support the equations, not this fixture’s coefficients or survivability. [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/), [Orekit atmosphere velocity](https://raw.githubusercontent.com/CS-SI/Orekit/develop/src/main/java/org/orekit/models/earth/atmosphere/Atmosphere.java), [Orekit drag acceleration](https://raw.githubusercontent.com/CS-SI/Orekit/develop/src/main/java/org/orekit/forces/drag/IsotropicDrag.java).

   Keep the exponential density with an explicitly versioned smooth fade to zero. Validate positive scale height and `0 ≤ fadeHeight < topHeight`. Below-surface states are invalid; a density clamp must not make them admissible.

   For lift, the draft’s regularized radial projection is a reasonable bounded toy law:

   \[
   n=r/|r|,\quad p=n-(n\cdot\hat u)\hat u,\quad
   F_L=q\,\mathrm{dragArea}\,\lambda(t)\,f(h)
       \frac{p}{\sqrt{|p|^2+\epsilon^2}}.
   \]

   Freeze the regularization, altitude fade, command interpolation, and sign convention in the model version. Positive \(\lambda\) means the outward radial projection; it does not mean screen-up. Describe \(|\lambda|\) as an **upper bound** on L/D: regularization and altitude fade reduce the actual ratio. The draft already does this reduction in [atmosphere.ts](/home/s/code/orbital-logistics/src/sim/atmosphere.ts:27).

   Use consistent normalized dimensions: area \(L^2\), density \(M/L^3\), pressure \(M/(LT^2)\). Existing unit fields are labels, not conversion factors. Do not display kelvin, Mach, or terrestrial g without the corresponding model and scales.

3. **Resolve feedback braking in favor of one authoritative mass state.**

   For the draft’s state-dependent braking direction, I recommend:

   \[
   y=(x,v,f),\qquad m=m_{\rm dry}+m_{\rm cargo}+f,
   \]
   \[
   \dot v=g+(F_D+F_L+F_T)/m,\qquad
   \dot f=-|F_T|/v_e.
   \]

   Evaluate the same pure guidance law, force saturation, current mass, atmosphere, and lift law at every RK stage. Engine acceleration limits constrain thrust acceleration; a separate vehicle-load limit constrains the declared total non-gravitational acceleration.

   The draft’s `guidance` gains do not yet define a complete control law. Specify its desired velocity, height blending, gravity compensation, saturation, and zero-command behavior before tuning the witness. A frozen feedback controller is compatible with a prepared exhibit; it still needs a mathematical definition and independent replay. See [draft fixture](/home/s/code/orbital-logistics/fixtures/model-sets/aster-entry.json:79).

   Existing `massLaw` remains valid if thrust is instead restricted to its prescribed arc contract. It is not valid for arbitrary feedback throttle. Likewise, [intervalStep](/home/s/code/orbital-logistics/src/sim/propulsion.ts:38) cannot be reused unchanged: its unpowered branch directly invokes gravity-only RK4.

   Successful admission must retain a positive fuel margin. Depletion and invalid intermediate mass stop the flight; clamping negative fuel and continuing is forbidden.

4. **Make the safety certificate a prerequisite to each step.**

   The existing certificate in [dynamics.ts](/home/s/code/orbital-logistics/src/sim/dynamics.ts:32) is useful structure, but passing current aerodynamic acceleration as its extra bound is insufficient.

   For each candidate interval, establish bounds on position, inertial speed, airspeed, density, minimum mass, and commanded force. One conservative aerodynamic acceleration bound is:

   \[
   A_{\rm aero}\le
   \frac{\rho_{\max}\,\mathrm{dragArea}_{\max}\,U_{\max}^2}
        {2m_{\min}}\sqrt{1+\lambda_{\max}^2}.
   \]

   Combine this with gravity and thrust bounds. Verify that the resulting position excursion stays inside the assumed exterior neighborhood and that the velocity excursion stays inside the assumed speed envelope. This closes the dependency between the airspeed bound and acceleration bound. Check every trial stage against those assumptions.

   Use deterministic subdivision anchored to canonical intervals. Split at authored control boundaries. Safety alone does not establish accuracy: add a deterministic local error or timescale criterion sensitive to atmospheric gradients, drag relaxation, and feedback gain. Dense display queries must never choose accepted physical steps.

   Exhausted subdivision or work budgets produce a bounded failure with the last valid prefix. They must not soften gravity, clip acceleration, or advance through an uncertified interval.

5. **Give splashdown its own physical transition.**

   Define the recovery surface as:

   \[
   g(x,t)=|x-x_b(t)|-(R+h_s),\qquad h_s=10^{-5}R
   \]

   as an initial numerical default.

   Detect the **first downward crossing** within the authored recovery window. Certification must still protect the actual solid surface at \(R\), not treat \(R+h_s\) as an uncrossable surface; otherwise subdivision can approach recovery forever without producing a root bracket.

   Equal-sign endpoints do not prove no crossing. Near recovery, prove the interval cannot reach the shell, establish monotonic descent, or subdivide. Tangencies and unresolved multiple crossings must fail conservatively. Refine the root from canonical physical states, never drawing interpolation.

   At the root:

   - Evaluate the pre-contact state, actual mass, and water-relative velocity.
   - Require impact speed plus numerical allowance to fit the authored envelope.
   - Preserve position; derive the body-fixed recovery location from the actual arrival.
   - Set post-contact velocity to the local corotation velocity.
   - Preserve cargo and remaining fuel, terminate thrust, and enter a constrained recovered phase.

   Record the environmental impulse and water-relative energy removal:

   \[
   J=m(v_{\rm water}-v^-),\qquad
   E_{\rm removed}=\tfrac12m|v^--v_{\rm water}|^2.
   \]

   This is an explicitly inelastic support model. The energy is relative to moving water, not necessarily the loss of inertial kinetic energy.

   Failed recovery must not create attachment. Successful recovery has no berth, refuel, unloading, or continuing engine operation. Store exact event-left and event-right states; exact-time queries return the right state, while preceding interpolation ends at the left state. Terminal recovery takes precedence over a coincident new command.

   Existing `land` instead calls paid capture and snaps to a specified pad, as verified in [runner.ts](/home/s/code/orbital-logistics/src/sim/runner.ts:165). Reusing it would conflate two different physical contracts.

6. **Extend presentation deliberately.**

   Add typed entry phase, aero telemetry, recovery anchor, and splashdown event data. Keep these separate from logistics state.

   Three specific seams need work:

   - `sampleVessel` currently clones the left sample and recomputes only selected quantities. New aero fields would remain stale between samples unless explicitly evaluated or interpolated. See [model.ts](/home/s/code/orbital-logistics/src/model-set/model.ts:174).
   - Surface view requires a surface port, and surface readouts assume the first body and planar geometry. Supply an entry-specific close-view target and three-dimensional diagnostics. See [main.ts](/home/s/code/orbital-logistics/src/main.ts:570).
   - Existing rocket orientation follows thrust or the previous commanded heading. Entry orientation needs its own deterministic presentation command; it must not silently determine aerodynamic coefficients.

   Reuse [transformDirection](/home/s/code/orbital-logistics/src/model-set/frames.ts:23) for force arrows. Do not apply velocity-frame corrections to forces.

   Show altitude, airspeed, dynamic pressure, actual L/D, non-gravitational acceleration, fuel, and recovery outcome. The draft’s \(\sqrt{\rho}|u|^3\) glow can remain a named qualitative proxy. Its threshold is an authored exhibit envelope, not thermal-survival evidence.

7. **Freeze bounded admission and measurable acceptance.**

   Reasonable starting caps for this one-vessel domain are: eight normalized time units, 65,536 physical nodes, 40,000 drawing samples, 12 MB serialized output, and explicit limits on trial steps, force evaluations, subdivisions, and root iterations. Count rejected attempts and root work, not just retained nodes. Enforce limits during construction.

   Before viewer admission, require:

   - Independent DOP853 integration from the original initial state, including independently evaluated guidance, fuel, and recovery detection.
   - Step refinement and tightened-oracle agreement on trajectory, event epoch, pre-impact velocity, fuel, peak pressure/load, and recovery classification.
   - Explicit numerical tolerances fixed before final tuning; root position error substantially below support height, and impact uncertainty below the remaining speed margin.
   - Drag power nonpositive in the air frame, lift perpendicular to air-relative velocity, vacuum parity, corotation/translation tests, radial-flight degeneracy, and powered mass consistency.
   - Adversarial cases for excessive density, stiff braking, exhausted fuel, missed recovery, grazing crossings, and work limits.
   - Off-grid display error below 0.25 pixels at allowed close zoom, with no event smearing; rewind, frames, layer toggles, Follow/Chase, and legacy/continuous/staging switching.
   - No successful scene publication if recovery or any admission constraint fails.

The remaining physical coefficients and successful trajectory are an **offline evidence gate**, not a reason to ask you to select integrator parameters. No human architecture decision is needed now. The later human gate is whether the atmospheric deceleration and schematic recovery look convincing at the preferred viewing speed.
