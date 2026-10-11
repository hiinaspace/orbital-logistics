**Recommend C’s forward-dynamics contract in a separate `solar-transport-v1` domain, with B permitted only as an offline burn-design tool.** Start with one finite transfer, then admit three complete carrier cycles. Exact recurring service is a later gate.

I reviewed the brief, required project docs, and exactly five source files. No files changed; no agents delegated.

**Verified facts.** The checkout is `codex/model-set-viewer` at `823e9a6`. [Schema validation](/home/s/code/orbital-logistics/src/sim/schema.ts:135) confirms the duration/grid/node restrictions; [dynamics](/home/s/code/orbital-logistics/src/sim/dynamics.ts:4) confirms static-center rails and spacecraft acceleration from every prescribed body. The viewer has centralized vessel queries, but body/frame queries still depend on those rails. A solar domain needs an explicit ephemeris/provider boundary.

JPL confirms the quoted constants, with one qualification: the Mars and Jupiter values are **system** GMs. Do not later count their satellites twice. NASA’s abstracts support circular-model cycler studies and maneuver-assisted recurrence; they do not validate this candidate. SpaceX supports orbital refilling as inspiration, not the proposed vehicle’s feasibility. [JPL parameters](https://ssd.jpl.nasa.gov/astro_par.html), [1993 cycler study](https://ntrs.nasa.gov/citations/19930054986), [2002 cycler study](https://ntrs.nasa.gov/citations/20060029853), [Starship](https://new.spacex.com/vehicles/starship).

**Independent calculation.** Reconstructing the branch and propagating it with step-halved RK4 under Sun-only gravity reproduces the geometry: 145.356-day Mars crossing, 80.177° Earth turn, and required Earth periapsis approximately **5,384 km**, inside the stated radius. The finer integration’s terminal position differs from the analytic conic by approximately 0.29 m. This verifies the seed geometry, not an admissible planetary encounter; DOP853 validation remains pending.

Two additional results materially affect the choice:

- Mars encounter \(v_\infty\) is approximately **9.68 km/s**. Taxi capture/departure is a major mission cost.
- Reorienting the Earth asymptotic velocity without gravity assistance costs approximately **8.24 km/s**. At an illustrative exhaust velocity of 3.7 km/s, that alone implies a mass ratio of **9.27**. This is a diagnostic, not a lower bound for an optimized assisted maneuver.

The supplied geometry also uses \(\mu_\odot=4\pi^2\), whereas converting the quoted JPL GM into AU/Julian-year gives **39.4769264**. Pick one consistent normalization and regenerate timings.

**Physical contract — judgment.**

Use prescribed circular planetary ephemerides, explicitly distinct from real ephemerides or self-consistent planetary N-body motion. Include Sun/Earth/Moon/Mars/Jupiter gravity for spacecraft throughout the finite exhibit. In nonrotating heliocentric coordinates, include the indirect acceleration:

\[
\ddot r=-\mu_\odot r/|r|^3+
\sum_b\mu_b\left[(R_b-r)/|R_b-r|^3-R_b/|R_b|^3\right]+T/m.
\]

Define nested lunar ephemerides with position, velocity **and acceleration**. Coordinate changes for close encounters must transform this same equation, including origin acceleration; they must not substitute a different force field.

Consequently:

- “Exact Kepler coast” is a **seed/oracle**, not execution under the declared multi-body field. Admitted coasts have zero thrust and are numerically propagated.
- Use offline adaptive propagation with frozen controls, event boundaries and numerical policy. Adaptivity must be independent of display queries. Keep the old Runner domains unchanged.
- One admitted physical artifact owns flight states, mass and event sides. Drawing interpolation is disposable; physical rendezvous queries use the admitted provider.
- Separate uncontrolled decorative satellites from participating logistics assets. A kinematic satellite must not become a free capture/refueling target.

B is mathematically legitimate but insufficiently constrained as proposed: almost any smooth curve can acquire a post-hoc thrust bill. Permit inverse dynamics to generate a **bounded candidate control schedule**, then freeze that schedule and forward-integrate from the initial state without reimposing the authored path. Require genuine zero-thrust coast intervals and predeclared vehicle limits. Agreement obtained by repeatedly resetting to the curve proves nothing.

For propulsion, enforce \( \dot m=-|T|/v_e \), thrust and acceleration caps, tank capacity, dry/cargo mass and reserves. Charge the integral of thrust magnitude—not net velocity change. Attached taxi mass loads the carrier; transfers conserve aggregate mass; residual velocity matching is paid.

**Concrete go/no-go gates — proposed acceptance criteria.**

1. **Freeze the model and vehicle before searching.** Version units, GMs/radii, ephemerides, force law, engine limits, inventories, tolerances and work limits. Use a named fictional vehicle; “Starship-inspired” must not imply verified Starship performance. Freeze a positive payload and at least 10% arrival propellant reserve. Do not enlarge tanks or exhaust velocity silently to rescue a preferred curve.

2. **Admit one finite transfer.** Start/end at physically defined orbital states, not planetary centers or arbitrary sphere boundaries. Compare a low-energy transfer seed with the current fast seed. Require continuous clearance certification including numerical error; for this atmosphere-free first slice, exclude altitudes below 200 km at Earth, 100 km at Mars and 10 km at the Moon. These are exhibit exclusions, not operational safety claims.

3. **Validate propagation, seams and paid capture.** Compare an independent DOP853 implementation with a refined second method, using identical frozen controls and separately checked units/ephemerides. Proposed maximum disagreement: 1 km/1 cm·s⁻¹ in interplanetary cruise; 1 m/0.1 mm·s⁻¹ at rendezvous, local encounters and seams. Require unchanged event classification under refinement and fuel disagreement below \(10^{-6}\) of initial propellant. Coordinate/segment seams introduce no intentional state jump. For schematic capture, initially cap geometric mismatch at 100 m and relative speed at 1 cm/s; pay even the accepted residual velocity match. Independently verify continuous clearance, not just sampled minima.

4. **Admit the carrier and taxis together.** Permit at most three bounded seed families: low-energy transfer, safe assisted/powered modification of this branch, and a longer-period phasing candidate. Set an evaluation/time budget before solving. Each accepted itinerary must include actual taxi interception, matching, transfer duration, departure and destination capture—not merely planetary proximity. Report carrier and taxi fuel separately. If none meets the frozen vehicle/resource gates, ship the valid finite transfer and stop the cycler claim.

5. **Compile three cycles at their actual epochs.** Continue from preceding physical/resource states without resets. Earth–Mars relative geometry repeats, but the complete field with independently advancing Moon/Jupiter generally does not. Rotated templates may seed subsequent solves; they are not admitted continuations. Require all three cycles, attached mass intervals, berths and finite-stock debits to pass together. Continuous reuse requires a later proof of force/control/resource symmetry or bounded online replanning.

6. **Admit playback and resource behavior.** Failed burns, insufficient fuel, unsupported clearance and invalid handoffs must reject the dependent itinerary without successful-looking continuation. Scrubbing/reverse must reproduce event sides without duplicating transfers. Proposed display limits: 16 MiB per worker reply, bounded multiresolution trails, and interpolation error below 0.25 pixel at supported zoom. Profile system and close-up views at 4K; retain Canvas unless measurements justify replacement.

Implement in that order: model/provider boundary → finite transfer witness → carrier/taxi feasibility → three-cycle ledger → orbital tanking and lunar service → presentation and human taste gate. Keep launch, atmospheric entry and detailed Starship reconstruction outside this slice.

