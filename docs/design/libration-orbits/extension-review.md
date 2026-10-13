The direction is sound for bounded feasibility work. **Before runtime implementation, correct the moving-surface assumption and make the controller’s acceptance criteria and continuation state explicit.**

I verified `eed27fa` on `codex/model-set-viewer`, inspected the existing uncommitted camera changes, and checked the binary, propulsion, staging, worker and history code. No edits or delegation; no expensive experiments.

1. **P1 — The proposed surface configuration is currently rejected.**
   The [brief’s surface-support claim](/home/s/code/orbital-logistics/docs/design/libration-orbits/extension-brief.md:18) is partly correct: support coordinates can follow either body. However, [schema admission](/home/s/code/orbital-logistics/src/sim/schema.ts:247) requires exactly **one surface port, one ballistic target, two bodies and duration ≤2**. A second surface support does not satisfy that contract.

   Recommend a narrowly versioned single-pad mission support domain that reuses the existing support/launch/landing mechanics. Avoid manufacturing an unused physical target merely to satisfy old logistics requirements. Keep v6 admission unchanged. The existing binary exhibit handler also [rejects logistics and multiple vessels](/home/s/code/orbital-logistics/src/binary/model.ts:29), so reuse its field checks through the new composition rather than treating it as an existing mission loader.

2. **P1 — One radial pulse is plausible, but unstable-mode cancellation is insufficient acceptance.**
   The [controller proposal](/home/s/code/orbital-logistics/docs/design/libration-orbits/extension-brief.md:25) has a reasonable physical basis: cancelling unstable departure without returning to a prescribed orbital phase is an established stationkeeping approach. That does not establish controllability for this particular radial actuator and cadence. [NASA-hosted analysis](https://ntrs.nasa.gov/api/citations/20220005226/downloads/AFarres_2022_JGCD.pdf)

   Specify the radial origin, signed authority, whether direction stays inertially fixed during the pulse, and the endpoint scalar being solved. Require a sufficiently strong, consistently signed endpoint response to pulse amplitude; saturation, poor conditioning or exhausted evaluations must reject the candidate.

   Track **both center phases**, with independently monitored horizontal/vertical amplitudes and scaled velocity error. A position envelope and small unstable projection can pass while useful center motion changes substantially. Phase estimation must not hide this through repeated phase adjustments.

   I reproduced the stored `0.0004534933` maximum component residual on its collocation grid. A shifted 64×64 grid gives comparable sampled error. This is approximately `2.83e-5` in physical acceleration units, **not a continuous residual bound or controlled-flight result**. The stored frequencies imply a relative-phase beat of about **641 time units**. Recommend a bounded rollout spanning several beats and at least two retention windows, with early/late perturbations, amplitude bounds, correction cost and independent replay of frozen controls.

3. **P1 — Controller state belongs in the canonical continuation contract.**
   [Chunk identity](/home/s/code/orbital-logistics/docs/design/libration-orbits/extension-brief.md:38) currently lists physical state, fuel, policy and controls. Continuous phase estimation and deadband decisions also depend on controller state: unwrapped phases, branch choice and any hysteresis or estimator memory.

   Carry that state explicitly across chunks and update it only upon acceptance. Rejected candidates must leave it unchanged. Require identical accepted controls under different worker request sizes, pause timing and restart-from-chunk checks. Otherwise identical physical endpoints can produce different futures.

   Also define how “scalar acceleration” becomes native controls. The [Runner propulsion law](/home/s/code/orbital-logistics/src/sim/propulsion.ts:12) uses force/throttle with an acceleration cap; acceleration is not generally constant as fuel burns. Specify exhaust velocity in simulation units rather than leaving “high-Isp50” ambiguous.

4. **P2 — The history design is suitable, but its budgets remain placeholders.**
   The [runtime paragraph](/home/s/code/orbital-logistics/docs/design/libration-orbits/extension-brief.md:38) needs numeric candidate-node, aggregate-work, reply-byte and retained/held-row limits. Six candidates bounds neither subdivisions nor accidentally retained Runners. At eight samples/unit, 1024 units already means roughly 8193 drawing epochs before boundaries and metadata.

   Essential gates:

   - Commit endpoint, fuel, controller state and drawing packet atomically; failed candidates publish nothing.
   - Preserve exact held pose, interpolation brackets and incoming future rows through the outstanding reply.
   - Reject invalid packets before mutating the store; the [fleet store’s staged ingestion](/home/s/code/orbital-logistics/src/cycler/service-store.ts:24) is a useful pattern.
   - Retain exact cumulative fuel anchors after physical-node eviction.
   - Validate Hermite error at maximum supported zoom and across thrust boundaries.

   With 32 units of lead included in 1024 total retention, a buffered viewer has roughly **992 units behind it**. Clamp the trail to available history. Calendar `1e6` is an epoch limit, not a promised fuel lifetime.

5. **P2 — Keep staging ownership strict, and make booster recovery an optional scope cost.**
   The reusable [separation method](/home/s/code/orbital-logistics/src/model-set/staging.ts:77) correctly preserves an exact checkpoint, zero-kick child states, reserved upper fuel and mass/momentum accounting. Preserve those gates, parent retirement, exclusive post-split ownership and absolute-epoch moving-pad queries.

   Add a measurable parking requirement: roughly two completed planet-relative revolutions with admitted clearance, followed by departure from the actual endpoint. Halo insertion must continue into a verified post-insertion coast; endpoint matching alone is insufficient for an unstable orbit.

   Airless staged launch fits this scope. Returning the booster to the same pad is additional work beyond the stated staged-launch request. Recommend keeping it only if the first bounded solve is straightforward; otherwise retain a finite, explicitly terminated booster trajectory while completing the observatory mission.

The camera change addresses the identified dominant-body switch and planar roll reversal. Its [pole fallback](/home/s/code/orbital-logistics/src/model-set/camera.ts:86) still switches axes abruptly and can introduce a roughly 90° roll change near vertical velocity. Test pole-threshold and near-zero-speed crossings before claiming generally cut-free spatial Chase.

**Recommended sequence:** controller feasibility → explicit continuation/publication contract → continuous survey; independently, moving-pad/staging admission → launch and parking → actual-state halo insertion. No torus proof, general targeting system or new atmosphere model is needed.
