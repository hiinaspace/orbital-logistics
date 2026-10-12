# Physical meaning and accurate display-only field contracts

## What scalar and vector field does the current simulation actually have?

### Takeaway
Use potential per unit test mass and acceleration as distinct selectable quantities. For the accepted compact field, ordinary gravitational potential exactly matches the code; rotating effective potential is also meaningful, but belongs to this prescribed fixed-primary model rather than the conventional barycentric CR3BP.

### Cited Findings
- Verified checkout: `src/compact/physics.ts:3–10` fixes Aster at the origin, mu=1, exclusion radius=1; Selene has mu=.03, radius=.2, circular radius=5 and rate `sqrt(1.03/125)`. Its acceleration is `-r/|r|^3 + .03(b-r)/|b-r|^3`, without an indirect term. [Code](../../src/compact/physics.ts)
- Verified checkout: general Runner gravity sums prescribed-body Newtonian attractions and rejects interior queries; body rails may be spatial. [Code](../../src/sim/dynamics.ts)
- Verified checkout: solar gravity instead subtracts the Sun-origin acceleration from every non-Sun contribution. Its Moon, Mars and Jupiter ephemerides have inclinations, so the solar world is not coplanar. [Code](../../src/solar/ephemeris.ts)
- The Newtonian point-source potential energy is `U=-GMm/r`; its additive zero is conventional, and an orbit also depends on kinetic energy. [OpenStax: gravitational energy](https://openstax.org/books/university-physics-volume-1/pages/13-3-gravitational-potential-energy-and-total-energy)
- Standard CR3BP catalog coordinates are rotating and centered on the two-primary barycenter; their length unit is primary separation and their mass parameter is `m2/(m1+m2)`. [NASA/JPL catalog API](https://ssd-api.jpl.nasa.gov/doc/periodic_orbits.html)

### Inferences
- Derived from inspected force law: define `Phi_g(t,r)=-sum(mu_j/|r-b_j(t)|)` and `g(t,r)=-gradient(Phi_g)`. Units are length²/time² and length/time². For compact this is `-1/|r|-.03/|r-b(t)|`. Neither quantity includes ship thrust, supported-pad forces, constraints or mutual ship gravity.
- Derived from solar code: write `A(t)=sum_{j>0} mu_j b_j/|b_j|^3`; actual solar coordinate acceleration is `g-A`. Its matching coordinate potential is `Phi_coord=Phi_g+A·r` (positive sign). Offer either physical gravitational attraction alone, clearly identified, or the complete heliocentric coordinate field. Never show attraction-only arrows alongside a scalar claiming to generate the complete force law.
- The solar indirect potential is linear and need not tend to zero at infinity. Its additive gauge can be fixed at a named reference point. A moving multi-source potential does not imply conserved ordinary spacecraft energy.
- Compact's moon rate resembles the two-body sum-of-masses relation, but the fixed primary and missing indirect term make it physically different from the barycentric CR3BP. Imported CR3BP L1–L5 coordinates or Jacobi values would describe a different field.
- Field capability should be explicit by domain: compact/Runner expose exact source ephemerides, source mu/radii and domain epoch; solar additionally declares the uniform indirect vector. Reuse their force laws through a display query adapter, with no Runner construction, candidate planning or changes to integration/event steps.
- Mask every point at or inside a source surface. No interior extrapolation, softening or arbitrary softened replacement is justified by the current contracts. Rendering clamps/color compression apply only after evaluating valid exterior samples.

### Gaps
- No numerical gradient/parity tests were run; implementation would need exterior finite-difference `-grad Phi` against actual acceleration, including solar's sign and indirect term.
- Source ephemerides must be available at the cursor epoch. Held-history/faulted frame origins can be unavailable; renderer failure must never trigger physical extrapolation.

## What does a potential in a rotating or object-centered frame mean?

### Takeaway
The safe universal mode is the instantaneous base field expressed in the selected view coordinates. A second explicitly named effective-potential mode is feasible for the compact co-rotating frame; it still cannot describe all apparent acceleration because Coriolis depends on velocity.

### Cited Findings
- Uniform rotation introduces centrifugal terms pointing away from the axis and Coriolis terms perpendicular to velocity. The latter are velocity dependent. [MIT Press: Structure and Interpretation of Classical Mechanics, rotating coordinates](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/9579/sicm_edition_2.zip/chapter001.html#%_sec_1.6.1)
- In a static rotating restricted-body field, specific effective potential is gravitational potential minus `.5*omega²*(x²+y²)`; rotating energy is `.5*|v_rot|²+Phi_eff`. The conventional Jacobi constant uses minus twice that energy. [MIT Press: restricted three-body derivation](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/9579/sicm_edition_2.zip/chapter001.html#%_sec_1.8.4)
- Verified checkout: `transform` rotates around the world origin only for `rotating`; named body/port/ship frames instead translate and subtract origin velocity with unchanged orientation. `transformDirection` rotates axes and explicitly omits translation and velocity terms. [Code](../../src/model-set/frames.ts)

### Inferences
- Display-coordinate derivation: with world position `r=o(t)+Q(t)q`, ordinary scalar is `Phi_view(t,q)=Phi(t,o+Qq)` and the base vector is `Q^T a_base`. This remains valid in every frame whose current position/orientation is valid, without claiming it equals `q_ddot`.
- If one instead wants frame-relative acceleration, for constant rotation `omega`, `q_ddot=Q^T(a_base-o_ddot)-2 omega×q_dot-omega×(omega×q)`. Changing angular rate adds `-omega_dot×q`. Therefore a position-only field cannot encode the full rotating dynamics.
- A translating-frame instantaneous potential can include `+(Q^T o_ddot)·q`, but only with an exact origin acceleration. Current display port/vessel interpolation is not such a physical acceleration authority. Initial implementation should disable effective mode for translated ship/port frames and label ordinary field as gravitational/base field in view coordinates.
- For compact's current origin-centered rotation at exactly its moon rate, sources are stationary in rotating coordinates. Derive `Phi_eff(q)=-1/|q|-.03/|q-(5,0,0)|-.5*n²*(qx²+qy²)` (phase aligned). The coast-only quantity `C=-2 Phi_eff-|v_rot|²` is a Jacobi-like invariant of this prescribed field by the same rotating time-symmetry argument, even though it is not barycentric CR3BP. It changes across paid impulses, thrust, capture and support. Do not present one invariant for an entire powered/support/capture program.
- Its zero-velocity region for a chosen coast invariant satisfies `-2 Phi_eff >= C`; the boundary depends on that chosen C, not potential alone. Static equilibria solve `-grad Phi_eff=0`; stability and transit behavior require dynamics including Coriolis. Neither minimum color nor a saddle proves a stable parking orbit or fuel-cheap route.
- General Runner rails may not share a rotation rate/axis; even an instantaneous effective potential then need not be time independent. Solar has several orbital rates/inclinations and no one stationary rotating field. Disable conserved-Jacobi/standard zero-velocity claims there.
- Proposed capability table: ordinary instantaneous potential/base arrows in inertial, valid translated and rotating views; compact co-rotating effective potential/zero-velocity diagnostics as a separate opt-in; full frame-relative vector field only for an explicitly specified test velocity and exact physical frame acceleration; unsupported modes unavailable with a brief explanation in optional details.

### Gaps
- Need a capability predicate over actual source rails and frame policy before generalizing effective mode beyond the known compact fixture.
- No equilibrium solver, stability analysis or Jacobi drift calibration was performed. Such research is separate from drawing a field.

## What can rubber-sheet, contours, arrows and moving particles honestly explain?

### Takeaway
Recommend color plus a small number of isolines and optional arrows as the first implementation. A height surface can be an appealing separate potential diagram; animated first-order flow should be explicitly a field-direction animation, and physical particles would require a different bounded trajectory feature.

### Cited Findings
- Equipotential contours are perpendicular to the corresponding gradient field; the same gradient geometry is illustrated for electrostatic potential in educational material. [OpenStax: equipotentials](https://openstax.org/books/college-physics-2e/pages/19-4-equipotential-lines)
- In a circular orbit gravity points radially inward while velocity is tangential. [OpenStax: satellite orbits](https://openstax.org/books/university-physics-volume-1/pages/13-4-satellite-orbits-and-energy)
- A published primary education study used a rubber-sheet activity with over 150 students to explore understanding of gravity. Its existence supports treating the analogy as a teaching device, not evidence that it automatically communicates accurate dynamics. [Postiglione and De Angelis, 2021](https://arxiv.org/abs/2102.04156)
- General relativity concerns space and time geometry, and free fall retains tidal differences even where local apparent weight vanishes. [Max Planck Institute: gravity and curvature](https://www.einstein-online.info/en/spotlight/geometry_force/)

### Inferences
- Derived visualization distinction: an artificial height `h=scale*(Phi-Phi_ref)` plots energy per mass. Height is neither physical altitude nor spacetime curvature. A Newtonian spacecraft keeps its physical xyz; lifting it onto this mesh would misstate the actual trajectory unless clearly confined to a separate schematic diagram.
- Rubber-sheet pitfalls: literal marbles require external downward gravity, surface constraints and rolling inertia/friction; their motion does not implement the code's unconstrained Newtonian equation. Do not animate marbles on a mesh and imply they are the same canonical ships. This conclusion follows from comparing the mechanical analogy to the inspected force law, rather than a retrieved empirical result.
- If height uses nonlinear/log compression, the visual slope is no longer proportional to acceleration. A monotone map preserves equipotential sets but changes gradient magnitude. Color and height legends must expose the quantity and compression; exact sampled scalar values can remain inspectable.
- For coplanar compact sets, a world XY slice is natural and plane-normal field is zero. For spatial sources, contours show only the scalar restricted to the slice; their normals represent the in-plane gradient, not the full 3D vector. An oblique screen projection is not itself a physical sampling plane. Keep an explicit world plane or defer noncoplanar coverage.
- Field lines solve a first-order geometric equation `dr/ds proportional to g(t_fixed,r)`, with chosen normalization/parameterization. A spacecraft solves the second-order equation `r_ddot=g(t,r)+a_thrust` from position AND velocity. The circular-orbit example decisively separates the two. Gravity arrows are acceleration arrows, not desired headings or predicted velocity.
- Decorative advection `r_dot=k*g`, or normalized `r_dot=k*g/|g|`, depicts downhill field direction. It produces dissipative-looking first-order flow, not ballistic gravity; normalizing erases relative magnitude and fails at zero field. Label it “field flow” and avoid calling it test particles. For a changing field it becomes a time-varying direction animation rather than a frozen streamline.
- Physical test particles would need initial velocities, second-order propagation, body exclusion, bounded lifetimes/work and scrub/reseed semantics. They should use the same dynamics authority as spacecraft but remain isolated from logistics/resources; no implementation or new particle experiment is warranted during this research pass.
- Arrows can use length compression and/or color for magnitude, with normalization documented. Near equilibria, omit/zero the arrow rather than dividing by tiny magnitude. Sampling epoch follows the displayed cursor, not the running worker frontier or wall clock.
- Color/isolines plus sparse arrows provides three complementary cues: well shape/level, gradients, and force direction. Prefer a fixed per-scene scale or declared explicit rescaling rather than unannounced per-frame normalization, which can fabricate apparent changes during scrubbing.

### Gaps
- No user experience test, benchmark or visibility/occlusion measurement was performed. Mesh appeal, contour density and arrows versus animated flow remain human perception choices.
- This bounded research does not establish that any teaching device improves comprehension for this particular viewer/user; the primary education study was not used to claim that.
