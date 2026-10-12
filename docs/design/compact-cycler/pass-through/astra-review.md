**The pass-through replacement is justified. Approve a smaller finite carrier-only experiment; defer taxi redesign and continuous migration.** The brief correctly identifies the Beacon turnaround as structural, but makes exact natural recurrence too much of a prerequisite.

Verified at `8ef460a`: Wayfarer explicitly departs Beacon, returns, captures, refills and restores its supported state ([prepare.ts](/home/s/code/orbital-logistics/src/compact/prepare.ts:74)). The force law matches the stated fixed-primary/prescribed-moon model; native integration has interval-enclosure checks and bounded work ([physics.ts](/home/s/code/orbital-logistics/src/compact/physics.ts:3)). The search implements symmetric rotating-frame shooting with independent full-period propagation, but that is research candidate generation, not native admission ([search.py](/home/s/code/orbital-logistics/docs/design/compact-cycler/pass-through/search.py:39)).

The recorded refinement evidence supports the 74-unit period, 64-unit coast and Δv≈1.55; I did not rerun those measurements, reproduce candidate closures or inspect playback.

1. **Make finite recurrence the first gate, rather than exact ballistic periodicity.**
   [Recommendation 1](/home/s/code/orbital-logistics/docs/design/compact-cycler/pass-through/brief.md:15) risks an open-ended search: unsuccessful bounded searches cannot establish that ballistic families “fail morphology.” Time-box a few candidate families, then allow bounded, paid corrections. Two complete carrier circuits propagated from actual preceding endpoints can establish the desired pass-through experience without first solving indefinite repetition. The cited [NASA 2015 work](https://ntrs.nasa.gov/citations/20150018049) supports modest corrected cycling as a precedent; it does not establish feasibility in this fictional field.

2. **Turn the morphology ranking into a declared acceptance envelope.**
   [Recommendation 2](/home/s/code/orbital-logistics/docs/design/compact-cycler/pass-through/brief.md:16) lists useful measurements but leaves “near both bodies” and “small corrections” undefined. Freeze encounter-distance ranges, allowed encounter order and a correction budget before choosing the winner. Report correction Δv in absolute units and against a specified reference speed; “carrier orbital velocity” varies substantially along the route. Extending beyond the moon’s orbital radius is a presentation preference, not sufficient evidence of a lunar encounter. Keep it optional unless that geometry is specifically wanted.

3. **The recurrence warning needs an explicit numerical and resource boundary.**
   Current playback selects a cycle by modulo time, rotates its stored state and restores its template fuel history ([query.ts](/home/s/code/orbital-logistics/src/compact/query.ts:29)). Removing Beacon removes the paid capture/refill that makes that boundary defensible. A small DOP853 closure residual does **not** authorize repeatedly replacing the actual endpoint with the seed. Later continuous work must address:

   - Position **and velocity** closure under the epoch rotation, with accumulated error bounded or physically corrected.
   - Fuel depletion and force caps across cycles; repeating acceleration controls does not repeat mass or fuel.
   - Arbitrary discovered periods versus the integrator’s absolute canonical grid. Rotational symmetry of the equations does not automatically make shifted RK4 partitions identical.
   - Existing structural assumptions: cycle completion currently counts a carrier `dock` event ([engine.ts](/home/s/code/orbital-logistics/src/compact/engine.ts:35)).

   These block reusing the current continuous wrapper unchanged. They need not block a finite witness.

4. **Keep parking-orbit/descent architecture provisional.**
   [Recommendation 3](/home/s/code/orbital-logistics/docs/design/compact-cycler/pass-through/brief.md:17) is plausible, but the asserted cause of shallow landing remains an inference. An earlier parking coast does not itself guarantee a satisfying terminal descent. After carrier acceptance, test one directional taxi connection with visible orbital coast and a separately inspected terminal descent. Defer choosing one reusable Pipit versus multiple vehicles until encounter timing and paid rendezvous costs are known. Hold the field fixed for the first carrier experiment; changing body ratios would invalidate the current physical admission.

**Concrete finite gate:** admit one carrier, already in flight, through **two complete Aster–Selene–Aster circuits**, with an optional third only if drift remains uncertain.

- Propagate continuously from actual canonical endpoints; no cycle resets, Beacon capture or refills.
- Freeze encounter envelopes and correction limits; publish encounter epochs/distances, burn spans, Δv and remaining fuel.
- Require native interval safety, independent DOP853 agreement and three-resolution convergence across the entire horizon, within explicit numerical allowances and aggregate budgets.
- Show the admitted trajectory in inertial and rotating frames for the owner’s pass-through judgment.

Passing this gate authorizes **one taxi feasibility slice**, not continuous recurrence. If bounded candidate work fails, return the closest valid geometry and its specific miss for a design decision.

No files modified; no searches, simulations or subprocess reviews launched.
