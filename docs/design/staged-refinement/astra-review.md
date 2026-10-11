Model: **gpt-6-astra**, reasoning effort **high**, confirmed in the CLI transport log.

**Recommendation: fix Eagle’s ascent topology first; then reshape lunar insertion while initially preserving its endpoint. Keep the world scale unchanged.** Lower acceleration should be a secondary objective.

Labels: **[Verified—run]** freshly measured using the canonical compiler; **[Verified—source]** inspected implementation; **[Recorded]** retained evidence inspected, not rerun; **[Proposed]** recommendation, feasibility untested.

1. **P0 — Replace Eagle’s backward coast with an ascent in Odyssey’s orbital direction.**

   **[Verified—run]** The problem is more specific than radial overshoot:

   | Measurement | Current ascent |
   |---|---:|
   | Maximum lunar radius | 0.50594 |
   | Maximum excess over Odyssey’s simultaneous radius | 0.14033 |
   | Lunar tangential velocity after first burn | −0.04735 |
   | Tangential velocity at docking | +0.25952 |
   | Ascent propulsive Δv | 2.06058 |
   | First/final burn total heading turn | 301.6° / 346.0° |

   Eagle spends the coast moving in the opposite lunar orbital direction from its eventual docking motion. The terminal burn must undo that as well as correct position.

   **[Verified—source]** The solver constrains individual key turns, weakly attracts controls toward already-looping seeds, and restricts angles to seed ±0.25 radians. That does not constrain total turning or trajectory topology. See [author.py](/home/s/code/orbital-logistics/docs/design/staged-apollo/author.py:257).

   **[Proposed]** Search two families, in order:

   - Outward launch, progressive pitch toward Odyssey’s orbital direction, coast, short rendezvous correction.
   - Lower parking insertion, bounded phasing coast, rendezvous correction—only if direct ascent cannot meet the shape constraints.

   Start with **3–4 heading keys per burn**, fixed outward initial heading, and the existing liftoff epoch. Seed docking at **43, 44.5 and 46**, with continuous adjustment inside **[42, 46.65]**, leaving at least 0.5 before return departure.

   Suggested initial search bounds—not established feasibility limits:

   - Launch force **[0.55, 0.72]**, duration **[0.25, 0.9]**.
   - Terminal force **[0.25, 0.72]**, duration **[0.08, 0.6]**.
   - Coast duration ≥ **0.15**.
   - Total heading variation ≤ **120° per burn**, adjacent key turn ≤ **60°**.
   - Radius excess over the simultaneous orbiter ≤ **0.03**; no sustained negative lunar angular momentum.

   If these fail, widen surface dwell to **[1, 4]** before adding heading freedom. Do **not** require monotonically increasing radius through docking: the actual target has inward radial velocity about **−0.00985** there. Match its motion.

2. **P1 — Treat insertion as excessive steering plus velocity cancellation, not an L1 encounter.**

   **[Verified—run]** Around **t=29.883**, Odyssey’s inertial speed reaches approximately **0.06373**, while its lunar-relative speed remains **0.39935**, at lunar radius **0.35039**. The inner rotating equilibrium of this prescribed field is approximately **1.00464** from Selene. This is not a libration-point pause.

   **[Verified—source/run]** The inherited target is a near-side, locally circular state at radius **0.35**. Its lunar-relative velocity opposes Selene’s translation: **0.45387 − 0.29277 ≈ 0.16110** inertial speed at insertion completion. Some apparent slowing follows naturally from that geometry. The deeper speed dip occurs during a **173.7° thrust turn lasting only 0.10749**. See [target construction](/home/s/code/orbital-logistics/docs/design/apollo/author.py:189).

   **[Proposed]** First try one coherent insertion arc with **2–3 keys**, duration **[0.15, 0.6]**, total turn ≤ **90°**, and throttle seeds **0.2, 0.35, 0.5**. Initially preserve the existing endpoint state and epoch.

   **Important correction to the brief:** changing insertion controls does **not necessarily** require retargeting descent and ascent. Preserving the six-state endpoint and epoch preserves the subsequent ballistic geometry; Eagle’s separate fuel inventory also remains unchanged. Odyssey’s changed fuel still requires complete return/recovery validation. [Compiler ownership](/home/s/code/orbital-logistics/src/model-set/staged-apollo.ts:113)

   If that family fails, vary encounter time and azimuth together: start with arrival **±0.5 time units**, target azimuth **±30°**, radius **[0.33, 0.40]**. Only then broaden translunar departure phasing. Those candidates require downstream retargeting.

   **[Verified—source]** Small throttle reductions are ineffective here: the current insertion remains acceleration-capped at throttles above roughly **0.63**. Changing 1.0 to 0.8 would leave the initial acceleration unchanged.

3. **P1 — Make choreography constraints survive every refinement stage.**

   **[Proposed]** Use feasibility gates followed by a small Pareto comparison, rather than one weighted objective that can exchange a loop for a better endpoint residual.

   Gate on:

   - Canonical launch release, whole-interval clearance, fuel ownership and unchanged capture margins.
   - Chosen orbital direction and revolution count.
   - Radius overshoot and terminal relative motion.
   - Total heading variation and peak heading rate.

   Then compare propulsive Δv, consumed fuel, peak acceleration and duration. For the existing smoothstep steering, peak angular rate within a key interval is **1.5 × angular separation / interval duration**; key-angle limits alone cannot prevent rapid turns. [Steering law](/home/s/code/orbital-logistics/src/sim/steering.ts:8)

   Lower acceleration alone is not a reliable improvement: longer burns can increase gravity losses, overshoot or total turning. Avoid raw inertial curvature as the main score—it becomes ill-conditioned near low speed. Measure path shape, thrust-direction changes and rocket orientation separately.

   **[Verified—source]** The current coarse authoring pass uses softened interior gravity, and its clearance diagnostic samples adaptive solver nodes. Neither establishes interval safety. The replacement search should reject physical-domain violations using unsoftened dynamics; final canonical admission remains mandatory.

4. **P2 — Bound the search by actual work and retain at most three finalists.**

   **[Proposed]** Use at most **12 initial seeds total**, staged across the families above rather than a Cartesian grid. Budget **1,500 trajectory evaluations per seed**, counting finite-difference calls, plus a **30-minute initial wall-clock ceiling**. Stop and report family failures rather than automatically expanding the parameter space.

   Carry all shape constraints into final endpoint polishing; the existing fine pass removes seed regularization. Retain at most three nondominated candidates for full compilation and comparison.

   Keep parking geometry shared between the two investigations: finish the ascent comparison against today’s target first, but expect to rerun it if insertion geometry subsequently changes.

5. **P2 — Revalidate the complete mission, then make one visual choice.**

   **[Verified—run]** The unchanged mission compiled successfully and reproduced its paid captures and recoveries. **[Recorded]** Existing whole-graph DOP853 and h/h2/h4 evidence supports this fixture’s **1e−4 global allowance**, not newly authored controls. [Accuracy evidence](/home/s/code/orbital-logistics/docs/design/staged-apollo/oracle-accuracy.md:1)

   **[Proposed]** Finalists must pass full return/entry, attached-fuel mass accounting, recurrence turnaround and storage limits. Longer Eagle flights also increase its dense drawing samples, so duration has a storage cost.

   Compare identical playback windows and speeds in inertial, Selene-centered and rotating views. The remaining human decision is the preferred motion among physically admitted alternatives—not solver tuning.

No files were modified. No candidate optimization or browser visual assessment was performed; the proposed bounds and aesthetic improvements remain unverified.