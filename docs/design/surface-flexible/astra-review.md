**Recommendation: proceed with a separately versioned surface-flexible domain, gated first on a complete funded numerical witness.** The cached-path idea is sound under a strict acceleration-capped operating envelope. The existing coupled-service lifecycle needs explicit extension before it can safely compose those paths.

I verified the load-bearing sources at `8803286` and ran one small in-memory mass-law/step probe. No edits, subagents, or long rollouts. This establishes architectural constraints, not mission feasibility.

**Prioritized findings**

1. **P0 — Prove the propulsion envelope and complete fuel chain before runtime integration.**

   Mass-independent geometry requires every powered surface arc to remain acceleration-capped across the admitted load range. A “high enough force ceiling” is insufficient if throttle or wet mass puts any interval into force-limited operation. The existing mass law explicitly supports both regimes. My probe produced identical one-step states across two masses while capped; under the legacy force ceiling, they diverged. [Mass law and integration](/home/s/code/orbital-logistics/src/sim/propulsion.ts:12)

   The existing ship’s acceleration cap is `0.4`; increasing thrust alone cannot lift it from a slowly rotating pad against approximately unit surface gravity. Launch admission already checks this correctly. New hardware is necessary and must remain confined to the new domain. [Launch gate](/home/s/code/orbital-logistics/src/sim/runner.ts:189), [legacy hardware validator](/home/s/code/orbital-logistics/src/maintained/world.ts:33)

   Fuel feasibility must include ascent, outbound flight, station delivery, inbound flight, descent, residual matching, and the final reserve. Today `.05` is checked at orbital home arrival. Applying that check at descent entry would leave landing unfunded. A larger tank also increases the mass Meridian must maintain; it cannot be evaluated independently of the loaded station controller. [Return admission](/home/s/code/orbital-logistics/src/adaptive/plan.ts:54), [attached mass](/home/s/code/orbital-logistics/src/adaptive/world.ts:32)

2. **P0 — Separate orbital boundaries from ground lifecycle events.**

   Currently `homeArrival` means inbound endpoint, origin capture, and refuel-service start; `end` must equal `homeArrival + 2`. Departure similarly means origin undocking and orbital flight start. These meanings cannot survive surface composition unchanged. [Schedule validation](/home/s/code/orbital-logistics/src/adaptive/plan.ts:31), [service commitment](/home/s/code/orbital-logistics/src/adaptive/engine.ts:63)

   In particular, calculating `launch = departure − ascentDuration` can put launch before admission. Calculating refuel completion from descent entry can refill a still-flying ship. These are lifecycle errors even when every individual trajectory is numerically valid.

3. **P1 — State the hybrid force model and numerical handoff rule explicitly.**

   Primary-only surface motion can be rotated and shifted in time; the complete Mote field cannot. Keep the switch tied to named mission events and leave Mote’s global phase unchanged.

   From the current force implementation, Mote’s omitted acceleration is bounded by `0.004/(6−2)² = 0.00025` while the surface path remains within radius two. **That is an instantaneous acceleration bound, not an endpoint-error bound.** Quantify trajectory discrepancy separately from integration error and the `1e-7` matching tolerances. [Gravity implementation](/home/s/code/orbital-logistics/src/sim/dynamics.ts:11)

   A return solver will also have a nonzero numerical residual against the cached descent entry. Specify how that residual is handled; silently replacing its state with the template state would introduce an unaccounted correction.

4. **P1 — Reuse the coupled machinery through explicit boundaries; a trip wrapper alone is insufficient.**

   `AdaptiveWorld` physically propagates its origin as a ballistic Runner, while `CoupledTrip` directly queries that origin for both endpoints. Placing Equator on the surface requires replacing that physical provider as well as changing the trip schedule. [Origin propagation](/home/s/code/orbital-logistics/src/adaptive/world.ts:56), [endpoint construction](/home/s/code/orbital-logistics/src/adaptive/plan.ts:112)

   The existing planner is also a specific near-Hohmann policy: fixed search ranges, four trials, orbital cost thresholds, and the `1.7–3.4` corridor. Preserve its bounded search machinery, but make the new domain’s endpoint and admission policy explicit. Do not apply orbital burn-cost thresholds to the whole launch/landing mission. [Planner policy](/home/s/code/orbital-logistics/src/adaptive/planner.ts:6)

5. **P1 — Preserve immutable admission knowledge separately from later execution outcomes.**

   The brief slightly overstates existing historical-knowledge preservation. `knownAt` filters admission visibility, but a coupled fault truncates the visit’s stored samples, boundaries, and events. Earlier cursors therefore lose part of the previously available forecast, although the serialized plan remains. [Fault mutation](/home/s/code/orbital-logistics/src/adaptive/engine.ts:65), [historical view](/home/s/code/orbital-logistics/src/adaptive/view.ts:48)

   Reusable surface geometry should make immutable predictions inexpensive. Keep the admission record intact and overlay committed progress/fault knowledge instead of rewriting it.

**The concrete minimum spec**

| Area | Required contract |
|---|---|
| **Domain** | New `surface-flexible-v1` definition and separately versioned composed plan. One Tern, one equatorial pad, one Meridian, unchanged prescribed field. Fixed dry mass/cargo during each tour; one tank and engine identity. Legacy validators and serialized plan meanings remain unchanged. |
| **Surface templates** | One ascent and one descent, authored in primary-centered inertial coordinates. Constant acceleration magnitude on powered arcs, smooth direction, and coasts are sufficient; avoid introducing arbitrary acceleration profiles initially. Each template records duration, exact canonical endpoint states, local event epochs, cumulative propulsive Δv, safety evidence, supported fuel/mass interval, and a versioned content hash. |
| **Cache admission** | Every powered arc must satisfy the force ceiling at the maximum admitted wet mass, remain capped from its start, and avoid depletion at the minimum admitted fuel. Cache geometry once; calculate fuel, mass, and actual force from each instance’s real load. Nominal cached fuel values have no resource authority. |
| **Physical boundaries** | Outbound starts from the rotated ascent’s exact exit state. Inbound targets the rotated descent’s exact entry state. These interfaces carry no berth, inventory, dwell, or docking status. Any numerical matching correction is explicit: retain pre-match residuals, charge residual velocity matching, and permit only a declared numerical-scale position projection. Reject larger mismatches. |
| **Support and landing** | Ground waiting follows actual pad corotation at positive COM height. Launch preserves the existing outward-acceleration gate. Touchdown requires ended thrust, geometry-bounded position matching, paid velocity matching, and an atomic transition to support. Ground refueling follows successful touchdown. |
| **Ownership** | Relay capture attaches the visitor’s actual remaining wet mass. Top-up debits its tank and credits Meridian once, preserving aggregate mass. Solve and freeze loaded maintenance and the return using the post-transfer fuel. Admission publishes the complete surface–orbital–surface plan and dependent station future atomically. |
| **Failure** | Rejected candidates leave the ship supported and retry later. A post-admission failure preserves the paid actual prefix and invalidates dependent future operations. Stopping the single coupled service is sufficient initially; recovery and rescue are unnecessary. |

The schedule should name these epochs independently:

`knownAt → launch → ascentExit → relayCapture → transferComplete → relayRelease → descentEntry → touchdown → serviceEnd`

Require:

- `launch ≥ knownAt` and after completed ground service.
- `ascentExit = launch + ascentDuration`.
- `touchdown = descentEntry + descentDuration`.
- `serviceEnd = touchdown + groundServiceDuration`; successful refueling is required before another admission.
- Relay capture, transfer, and release retain the existing quiet-window/canonical-grid requirements. Surface events preserve authored local times without rounding them to satisfy the old schedule validator.
- The composed mission has its own duration/lookahead bound, derived from the fixed surface durations and bounded orbital schedule.

For phase mapping, rotate ascent by the pad phase **at launch**. Define descent relative to its nominal touchdown pad phase, then rotate it by the pad phase **at touchdown**. Rotate both position and inertial velocity by that constant angle; corotation is already present in the nominal boundary velocity. Retain local event offsets explicitly, following the existing surface episode’s exact-time mapping. [Existing adapter](/home/s/code/orbital-logistics/src/traffic/planner.ts:79)

For fuel, let `D` be dry mass plus fixed cargo and `J` the remaining propulsive Δv, including residual matches. The descent-entry requirement is:

`requiredFuel = (D + touchdownReserve) × exp(J / exhaustVelocity) − D`

Check the reserve after touchdown. Reject a full station top-up that leaves insufficient return fuel; partial top-ups would add another scheduling decision outside this minimum.

Also measure replenishment-supported cadence. Equator currently imports `0.015` fuel per time unit: a loop needing refill `q` every `T` requires `q ≤ 0.015T` for sustained operation, with capacity clipping considered. Otherwise waiting for stock is an expected outcome, even if the first tour succeeds.

**Implementation boundary and evidence gate**

I recommend extracting three narrow shared capabilities: the loaded station owner, the bounded orbital-pair builder with explicit endpoint states, and the service runtime’s trip/event interface. Keep legacy adaptive/network wrappers and their policies intact; add the new surface trip and analytical pad provider behind the new discriminator. The ballistic `OriginIntervals` cache should retain its present contract.

Store each surface template once per worker/view cache. Visits carry template hashes, epochs, rotations, starting resources, immutable admission metadata, and actual/fault progress. Preserve 128-unit retention, event-side brackets, held-head behavior, and bounded pending work. Count shared template storage explicitly and retain the existing 8 MB reply/view guards; do not expand dense surface arrays into every visit. Wire the new domain into playback dispatch explicitly—the current speed policy otherwise defaults a new set to 16×. [Playback policy](/home/s/code/orbital-logistics/src/traffic/playback.ts:5)

Before runtime integration, require:

- The two surface contracts verified across their admitted mass range, with independent numerical checks and representative phase comparisons against the full field.
- One complete funded coupled tour, including loaded maintenance, paid touchdown, and a subsequent scheduling opportunity from the resulting state.
- Rejection evidence for force saturation, insufficient descent reserve, launch-before-admission, and a failed handoff.
- During implementation, unchanged legacy adaptive/network results plus held-cursor, fault-knowledge, and eviction checks for the composed mission.

Hardware sizing, interface geometry, pad spin, tolerances, and funding are numerical authorship decisions. Human review should judge the visible cadence and choreography. Keep exact-pad return as the first target; consider visibly separate ground transport only if bounded numerical authorship demonstrates that exact return is the wrong constraint.
