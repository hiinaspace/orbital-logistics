Model: **gpt-6-astra**, reasoning effort: **xhigh**, confirmed in this invocation’s transport log.

**Recommendation: adopt the passive attached-mass model and joint admission, but require a finite coupled-service witness before building the adaptive runtime.** Include explicit relay refueling in that witness. The brief correctly identifies the scheduling problem, but understates the changes to failure handling, canonical segmentation, seed generation and resource events.

This is a read-only senior review under the [senior-review protocol](/home/s/.agents/skills/senior-review/SKILL.md). No files were edited and no additional reviewers were invoked. This final response is supplied through the caller’s output mechanism.

**Verification and limits**

Reviewed checkout: `f799e556c45ac5b07f61a3d62c57c9fb3ea86745`, on natto, Node `22.22.1`. Tracked simulation, test and fixture files match that commit.

| Claim | Finding |
|---|---|
| Fixed timing is a material restriction | **Verified in code.** Departure is `t+6`; both flights take 14 units, relay dwell takes 2, and home service takes 2. There is one seeded attempt per dispatch opportunity. [Planner](/home/s/code/orbital-logistics/src/maintained/planner.ts:10), [engine](/home/s/code/orbital-logistics/src/maintained/engine.ts:32). |
| Existing target leases are canonical and checked | **Verified in code and a fresh focused test run.** Providers reconstruct physical definitions and are compared with the owner at every common grid point and target event. This verifies the existing fixed-mass domain. [Admission](/home/s/code/orbital-logistics/src/maintained/planner.ts:25). |
| Attached maintenance and relay refueling need new semantics | **Verified.** `powered-ports-v4` rejects overlapping attachment and maintenance, rejects relay transfer, and requires zero exchange inventory. Existing fuel transfer accepts only nonnegative port-to-ship quantities. [Validation](/home/s/code/orbital-logistics/src/sim/schema.ts:323). |
| The 1536-unit run completed 17 returns with 108 failures | **Verified against retained raw evidence, not rerun.** Final station fuel is `0.1009384695`; controller failures appear by the recorded `t=800` sample. [Rollout](/home/s/code/orbital-logistics/docs/design/maintained-service/follow-up/rollout-before.json). |
| Search uses an axis-dependent restriction | **Verified.** Each force component is limited to `Fmax/√3`; with `Fmax=.8`, an axial force above `.46188` rejects even though the physical sphere permits up to `.8`. [Shooter](/home/s/code/orbital-logistics/src/maintained/shoot.ts:20). |
| Economical timing is plausibly different | **Independently recalculated.** Ideal circular two-body values are flight `12.418235`, relay dwell `23.496429`, round trip `48.332899`, and total Δv `.256885`. These are diagnostics, not feasible routes certified in this perturbed finite-thrust model. |
| Existing regression and numerical evidence proves the proposed extension | **Unverified; it does not.** The maintained-service test file passed freshly in 34.1 seconds. I inspected the retained independent oracle report, but did not rerun the oracle, browser suite or long rollout. |

**Prioritized critique**

1. **Prove the useful service before committing to the runtime architecture.**

   The missing evidence is a paid, economical round trip with a long attached dwell, maintenance under the combined mass, and fuel delivery. Neither the existing fixed pair nor the exploratory extra-revolution probe demonstrates that combination.

   Attached mass is substantial. With station fuel `.6` and visitor fuel `.7`, total attached mass is `6.35`; full station thrust produces acceleration about `.00945`, below the station’s `.012` cap. The existing four-unit correction window and two-pulse controller have not been shown adequate under that load.

   Build a finite witness using the proposed production segment/event implementation. Preserve it as a regression fixture when the online planner follows. If it cannot maintain the selected geometry and return safely, stop before constructing the adaptive engine.

   Also separate “economical” from “constantly moving.” In the ideal calculation, home service finishes around `50.33` after departure, while favorable outbound alignments recur every `39.00`. A single ship using those exact alignments departs every `78.00`, leaving about `27.67` units at home. Longer relay activity can improve the scene without increasing departure frequency. A no-wait expectation would be a different operational choice.

2. **The coupled plan needs a new failure contract, including failures before attachment.**

   This is the highest-leverage correctness decision.

   Today, a free-flight visitor fault can be isolated while the independent station continues. [Existing handling](/home/s/code/orbital-logistics/src/maintained/engine.ts:69) explicitly permits that. Under the proposal, a failed outbound flight means the station’s accepted future assumes mass and possibly delivered fuel that will never arrive. Continuing that future would create ghost ballast or fuel.

   Joint admission establishes a valid nominal future; it does not guarantee that future’s prerequisites occur.

   For the first version, **halt the coupled service at the last valid event boundary whenever execution diverges in a way that invalidates a remaining station dependency**. This includes missed capture, wrong post-capture fuel, failed transfer and failed release. Preserve the paid prefix and actual attachment state. Do not manufacture a release, apply the planned fuel transfer, or continue the conditional station tail.

   After successful release and settlement of all station dependencies, an independent return-flight fault may again isolate the visitor. Recovery and branch replacement can follow separately.

3. **Resolve canonical segmentation and existing limits explicitly.**

   The brief’s “preserve absolute canonical steps” is an obligation, not something existing segmented Runners automatically provide. Runner’s grid is `scenario.epoch + index × step`. [Grid implementation](/home/s/code/orbital-logistics/src/sim/runner.ts:281). Restarting at an arbitrary fractional epoch changes that grid. A small read-only experiment reproduced a tiny numerical difference; this is a structural warning, not evidence of a current accuracy failure.

   For this slice, quantize departure, capture, transfer completion and release to the common `h=1/256` grid, and keep ownership changes outside active burns. That provides ample flexibility without adding arbitrary-origin integration semantics. Preserve existing exact burn boundaries within segments.

   A second omitted limit: a Runner scenario rejects durations above **64 units**. I reproduced the rejection. [Schema](/home/s/code/orbital-logistics/src/sim/schema.ts:134). Start with each complete visitor episode, including home dwell, bounded to 64 units. The ideal diagnostic fits. If the actual finite witness requires longer, explicitly design chained visitor execution before admitting it; increasing owner storage alone does not solve this.

4. **Near-Hohmann search needs a seed repair, not just timing freedom.**

   The current Lambert helper rejects nearly antipodal endpoints through `abs(A)<1e-5`. I reproduced `Degenerate Lambert seed` for the exact circular Hohmann endpoints. [Seed implementation](/home/s/code/orbital-logistics/src/maintained/seed.ts:6).

   Add a calibrated tangential Hohmann seed for that neighborhood and retain the existing Lambert seed where well conditioned. Keep both as inputs to finite-force shooting. Specify zero-full-revolution transfers explicitly; “single-revolution” is ambiguous beside the retained extra-revolution probe.

   Replace the component cube with a norm-constrained search whose finite differences and line search remain valid at the boundary. Merely changing the acceptance predicate can make Jacobian probes step outside the sphere and reject otherwise useful candidates.

   The correction changes the controller as well as visitor planning because both call the shooter. Preserve the old domain’s admitted behavior through explicit versioning or an explicit solver policy.

5. **Refueling is necessary for a replenished service claim; optimizing its quantity is not.**

   Making relay transfer optional is reasonable for an intermediate finite physics test. It is insufficient for the intended continuing scene: the retained run already demonstrates eventual station reserve limitation.

   Use one explicit station top-up policy initially, with a fixed target level and exact tank capacities. Compute the transfer quantity, then solve and admit the return with that reduced visitor fuel. “Safe return reserve” cannot be inferred by subtracting a fixed allowance before solving the return.

   Do not turn this into another optimizer yet. A failed funded return rejects that schedule. A lower-delivery policy can be a later deliberate choice.

   Measure **burned fuel separately from delivered fuel**. After relay delivery, visitor tank loss is no longer propulsive expenditure, and `ve·log(initialMass/finalMass)` across the whole trip is no longer its propulsion Δv.

**Concrete architecture contract**

The keystone is one immutable, serializable **coupled service plan**, owned by the maintained runtime. The target chain and visitor program are two views of that plan, not independent authorities allowed to disagree.

1. **Start from a committed prefix.** At a deterministic planning epoch, retain the existing station/origin prefix. Branch candidates privately after that prefix. Require every candidate’s first ownership-changing event to lie beyond any incompatible committed controls. Departure itself may occur earlier if it changes no station physics.

2. **Construct the plan causally.** Solve outbound against the unattached station; execute paid capture; take the exact resulting visitor state and fuel; apply the specified service event; propagate attached maintenance; release; solve the return; then replay the complete coupled plan. There must be no later recomputation that changes the target used by the outbound proof.

3. **Give each physical quantity one owner.** During attachment, the station’s acceleration uses

   \[
   M=4+F_s+1+0.05+F_v.
   \]

   Its mass law uses nonfuel mass `4 + 1 + .05 + Fv`, consumes only `Fs`, and keeps the visitor engine off. Reusing Runner with an effective nonfuel mass is sound, but serialized semantics must retain the constituent identities and masses; the visitor is not a permanent change to station dry mass.

   This is a co-located constrained-point model. It does not need hull contact, attitude, docking torque or a general coupled-body integrator.

4. **Use explicit atomic ownership events.** Paid capture first matches the visitor to the station and records its post-payment fuel. Transfer of `q` then changes

   \[
   F_s^+=F_s^-+q,\qquad F_v^+=F_v^--q,
   \]

   while preserving combined mass, position and velocity. Release preserves state and each tank, and removes visitor ballast from subsequent station propulsion.

   A finite service interval may finish in one atomic transfer. Check donor stock, recipient capacity, attachment identity and return feasibility before admission; check actual event preconditions again at commitment. Initially reject conflicting ownership events at the same epoch rather than relying on incidental operation ordering.

5. **Derive segment anchors; verify supplied anchors.** Each segment starts from the previous segment’s terminal state plus a permitted ownership event. JSON must not authorize arbitrary mass, fuel or state jumps merely by supplying plausible anchors. Bind station transitions to the exact visitor identity, hardware, paid capture and transfer ledger. Validate complete interval coverage, ordering, world/policy identity, event sides and safety.

   Use one chain evaluator for owner and reconstructed provider semantics. Reconstruction must work from the serialized plan, without a hidden callback or drawing data.

6. **Promote atomically, commit chronologically.** Only a fully admitted pair promotes its station tail and visitor plan together. Give both the same admission epoch and stable plan identity. Promotion does not advance actual fuel, stocks or history. Those change only when the frontier reaches their events.

   On expected planning failure, discard the entire private candidate. On execution divergence, apply the coupled failure rule above. A historical cursor before admission must never see the accepted future.

7. **Keep scheduling policy replaceable.** Separate the candidate generator/ranker from the canonical chain evaluator and admission checks. Reuse worker infrastructure and display helpers, but adapt the store’s fixed `departure+32`, `arrival+2`, eight-unit identities and count limits explicitly. They are embedded in the [current view store](/home/s/code/orbital-logistics/src/maintained/view.ts:34).

**Bound the first online search**

Use a deterministic cheap candidate list, followed by **at most four complete schedule attempts per planning opportunity**. Keep the existing 96-evaluation limit per flight leg initially. Quantize selected times to the canonical grid; cheap phasing estimates can remain continuous.

Each attempt must include all choices that require rebuilding attached maintenance or re-solving return. Trying several transfer quantities is several attempts, not a hidden inner search.

Separate mandatory admission from ranking:

- **Correctness gates:** valid physical states, certified clearance, force/cap compliance, paid captures, tank conservation, exact ownership, bounded work, valid return and reserves.
- **Service policy gates:** required delivery, declared station-maintenance quality, maximum wait/episode duration, and a fixture-specific orbital corridor if desired.
- **Ranking:** compare actual burned visitor plus station fuel from the common admission epoch through each completed service episode; use shorter elapsed time and stable candidate identity as declared tie-breakers. Do not count transferred fuel as consumption.

Compare the bounded solved candidates; do not take the first merely feasible flyby. An earlier exit is acceptable only against a predeclared adequacy threshold established by the finite witness.

Keep the planning horizon at a declared maximum, such as the proposed 96 units, and include the post-release station continuation needed for admission. Short idle commitment is appropriate; an idle forecast may simply be shorter than 40 units.

The suggested `180k` node ceiling is a **provisional engineering budget**, not a verified capacity result. Count all live owner, provider, visitor, trial and candidate Runners recursively. `Runner.retainedNodes` currently counts only its own nodes, and existing aggregate reporting estimates private providers. Retain candidates sequentially and store losing/best-so-far programs compactly rather than retaining several complete physical chains.

Account separately for controller solves on every candidate tail. Four schedules × two 96-evaluation legs gives 768 visitor trials, but candidate-dependent maintenance can dominate that number. Keep deterministic work yielding; wall time must never decide which candidate wins.

**Evidence gates, in implementation order**

| Gate | Required falsifiable evidence |
|---|---|
| **1. Finite useful witness** | One complete outbound–capture–service–long-dwell–release–return episode, within the selected 64-unit bound, crossing multiple attached maintenance burns. Record delivered fuel, both tanks, paid captures, burn expenditure, station geometry, orbit extrema and all timings. Compare with the existing expensive witness under an explicitly matched service objective. |
| **2. Ownership and conservation** | At every event and intermediate powered sample, verify `origin stock + visitor fuel + station fuel + cumulative burned fuel + exports = initial total + imports`. Transfer cancels internally; provider replay does not debit anything. Include capacity boundaries, insufficient donor fuel, wrong visitor identity, duplicate events, capture residual fuel and release mass removal. Include known-bad variants that duplicate fuel or omit visitor ballast and demonstrate rejection. |
| **3. Independent numerical check** | Replay the frozen full station/visitor stream independently, including transfer and attachment transitions, from its original anchors. Do not reset the oracle to supplied segment states. Replay identical controls at `h=1/128`, `1/256`, `1/512` without retargeting. Preserve separate pre-snap position and velocity residual gates: each plus the numerical allowance below `1e-7`. Include an attached acceleration-cap transition and a low-fuel case. |
| **4. Canonical and fault behavior** | Verify owner/provider state, tank and event-side equality over every canonical point and boundary. Different request partitions, work budgets and display queries must produce identical admitted plans and actual ledgers. Reject unsupported fractional ownership epochs. Inject outbound failure, missed capture, transfer mismatch and failed release: no ghost station mass/fuel, no future actual events, and a valid paid prefix. Verify post-release isolation separately. |
| **5. Seed and search calibration** | Witness exact/near-antipodal cases, both sides of the force-sphere boundary, and rotated copies of the same planar problem. Check comparable outcomes within the same budgets; the numerical search need not be bitwise rotation invariant. Count failed Jacobians, line searches, refinement, controller work and full admission preparation. Distinguish bounded search exhaustion from a physical impossibility claim. |
| **6. Repeated funded operation** | First pass a sequential 512-unit run; then at least 1536 actual units to cross the old fuel-limitation interval. Replay representative early and late coupled plans independently. Require repeated real deliveries, conserved supply and maintained behavior without tank resets. Report departure-gap distribution, longest home/relay waits, delivered fuel and station reserve trend. Independent candidate successes do not satisfy this gate. |
| **7. Retention, playback and compatibility** | Measure exact retained nodes, peak transient memory and worker latency during the longest failed search as well as successful admission. Enforce the declared node cap, 8MB packet/display limits, 128-unit history and one held reply. Test before/at/after admission and transfer, duplicate packets, eviction, Pause/Play/Live and fault history. Run existing simulation/browser regressions; old powered-port inputs must still reject attached burns and exchange. |

Before the long run, freeze the service-quality thresholds used to judge it. In particular, do not call a scene “maintained” merely because a coasting station stays collision-free after its controller repeatedly fails. Conversely, the existing scheduling envelope is not a continuous velocity-error bound during burns; do not silently reinterpret it as one.

**Disposition of the brief**

| Proposal | Recommendation |
|---|---|
| Separate versioned maintained domain | **Adopt.** Preserve the existing fixture and numerical contract. |
| Short idle commits and private paired admission | **Adopt with explicit prefix and dependency rules.** |
| Passive visitor carried by station propulsion | **Adopt as the model choice.** Validate loaded controller capability first. |
| Serialized segmented target chain | **Adopt with derived anchors, grid-aligned ownership events and cross-ledger validation.** |
| Flexible online search immediately | **Defer until the finite coupled witness passes.** |
| Optional relay refueling | **Adapt.** Required for the replenished service deliverable; quantity optimization deferred. |
| Four–six solved schedules | **Start at four**, with complete controller/admission accounting. |
| Arbitrary fractional joins and 50–70-unit visitor episodes | **Narrow initially** to common-grid ownership events and episodes no longer than 64. |
| Existing free-flight fault isolation | **Restrict** to faults with no remaining station dependencies. |
| Phase locking, formation disguise, co-thrust or general fleet solver | **Do not add to this slice.** None is needed to test the selected passive-attachment model. |

No additional human decision is needed to build that bounded witness. The later human judgment is whether its visible cadence—longer relay service and some home waiting—feels sufficiently active. If it does not, present the concrete choice between a higher fuel allowance, another ship, or different orbital content. Conservation, paid capture, canonical replay and truthful failure/history behavior remain correctness obligations regardless of that preference.
