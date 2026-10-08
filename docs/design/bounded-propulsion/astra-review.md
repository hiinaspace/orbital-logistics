**Proceed with the slice, after specifying one canonical powered-interval contract.** I recommend retaining State6, evaluating mass analytically at RK4 stages, introducing explicit v3 compatibility, and treating two-arc lunar targeting as a bounded feasibility experiment.

[verified: source inspection] The brief’s core Runner, event, capture, target-provider and interpolation claims hold at `8394ad0`. The simulation command and no-emit TypeScript check exited successfully. [unverified: fresh execution] I inspected retained oracle evidence but did not rerun the oracles or browser checks. The speed-control claim has become stale: concurrent working-tree changes add the analog slider. Simulation files remained unchanged during this review. [verified: CLI transport header] This review ran as `gpt-6-astra`, `xhigh`. I made no repository changes, delegated nothing, and did not touch the preview.

**1. Highest leverage: unify mass evolution, interval propagation and event semantics.**

[verified: source inspection] Updating the main integrator alone would leave inconsistent physics. Disposable sampling and segment reconstruction call RK4 directly in [runner.ts](/home/s/code/orbital-logistics/src/sim/runner.ts:216); diagnostic root finding also calls it directly in [events.ts](/home/s/code/orbital-logistics/src/planning/events.ts:27).

Make the smallest primitive a **free-flight interval with a fixed propulsion mode and an anchored mass law**. Canonical advancement, disposable samples and supported diagnostics must evaluate that same primitive. Legacy aiming tools should reject powered programs explicitly.

For commanded force \(C=\theta F_{\max}\), define:

\[
F(m)=\min(C,a_{\max}m),\qquad
\dot m=-F(m)/v_e,\qquad
\dot{\mathbf v}=\mathbf g+F(m)\mathbf u/m .
\]

The acceleration cap applies to **propulsive acceleration**, independently of gravity. Omit the second limit when no cap exists.

Recommend exact scalar mass evolution:

- Constant-force phase: \(m=m_0-C\Delta t/v_e\).
- Capped phase: \(m=m_s e^{-a_{\max}\Delta t/v_e}\).
- Transition mass: \(C/a_{\max}\).
- Fuel: \(m-(m_{\rm dry}+m_{\rm cargo})\).
- Integrated propulsive delta-v: \(v_e\log(m_0/m)\).

Cargo stays fixed within an arc. Evaluate mass from the arc’s actual starting mass, including preceding service and capture costs. Use the same law at every RK4 stage. This avoids adding numerical fuel error and depletion-root error to an otherwise analytically solvable quantity. Augmented State7 remains useful for the independent oracle; it is unnecessary in production for this restricted force law.

The rest of this contract should be explicit before implementation:

| Concern | Required semantics |
|---|---|
| Boundaries | Derive cap-transition and depletion epochs from the arc anchor. Split at these, authored start/end epochs, grid points and existing events. View queries never introduce retained boundaries. |
| RK4 endpoint | Every stage uses the **interval’s mode**, including the final stage at its endpoint. A global half-open arc lookup would incorrectly switch thrust off during that last stage. Public samples at the same epoch expose the post-event mode. |
| Simultaneous events | End preceding arc → service completion → undock → impulse → dock → transfer start → start new arc. Reject incompatible combinations; abort remaining events after failure. |
| Impulses | Reject explicit nonzero impulses inside or touching powered arcs. Keep the separately reported capture-residual exception after an arc ends. Avoid an undefined “substantial” threshold. |
| Depletion | Depletion before scheduled end terminates the run at that epoch, preserving flown state and consumption. Exactly exhausting fuel at scheduled end can complete the arc; subsequent fuel-requiring actions may fail. Zero throttle consumes nothing. |
| Partial accounting | Samples expose continuously varying fuel and cumulative consumption, including an unfinished arc. Close an interrupted arc with its actual endpoint and termination reason. Never count its partial consumption again when adding a closing ledger entry. |
| Replay | Snapshot/replay covers arc cursor, mass-law anchor and cumulative accounting. Safety/work-limit failure preserves the same partial prefix as depletion. |

**2. Explicit v3 is necessary to fail safely in older readers.**

[verified: executable probe] Adding proposed `engine` and `thrustArcs` fields to a v2 bundle passes the current validator, which silently drops both. This follows its reconstruction behavior in [schema.ts](/home/s/code/orbital-logistics/src/sim/schema.ts:133).

Use schema3 for scenario/program/snapshot and a new canonical model identifier. Upgrade v1/v2 programs explicitly to propulsion-free v3 runtime objects; preserve original fixtures and baselines. Reject propulsion fields attached to legacy versions before conversion. Reject old snapshots with the existing recover-program-and-replay guidance.

No parallel v2 physics engine is needed if propulsion-free parity passes. Existing burn-basis and ballistic-port identifiers can remain unchanged where their semantics remain unchanged.

**3. The safety extension is sound, with a precisely stated bound.**

[verified: source inspection and algebraic check] The current certificate in [dynamics.ts](/home/s/code/orbital-logistics/src/sim/dynamics.ts:30) can use:

\[
A=A_g+\|\mathbf u\|
\min\!\left(\frac{C}{m_{\rm dry}+m_{\rm cargo}},a_{\max}\right).
\]

Then retain the existing per-body condition:

\[
(v_0+v_{\rm body,max})h+\tfrac12Ah^2<c/2.
\]

This bounds all RK4 stage positions and the continuous exact flow **from that step’s starting state**, provided mass never drops below the nonfuel mass and the force bound covers the entire interval. Account for the accepted direction’s actual norm, as the existing rail bound accounts for basis tolerance.

A certified canonical leaf also covers shorter disposable evaluations from its origin. They must not create query-dependent authoritative subdivisions.

This is a surface-exclusion argument, **not a numerical-accuracy certificate**. Convergence and independent comparison remain necessary.

**4. Two fixed-heading arcs are a reasonable first family; lunar success remains unknown.**

[unknown: powered feasibility] Four controls and four terminal constraints establish a candidate shooting problem, not reachability or a well-conditioned Jacobian.

Use departure arc \([t_d,t_d+\tau_1]\), braking arc \([t_a-\tau_2,t_a]\), and a nonnegative coast gap. Scale position and velocity residuals separately. Bound all evaluations, including finite differences and line searches, and retain conditioning/failure information.

There is one important continuation caveat: **raising maximum thrust with a fixed acceleration cap does not recover the impulsive limit**. Seed with the cap inactive, or continue the cap consistently alongside thrust.

Start the lunar attempt from Wren: its retained return impulses are substantially smaller than Ibis’s. Recommended fallback order:

1. Obtain the fixed-primary powered witness.
2. Attempt one complete lunar round trip using a declared small arrival/wait grid.
3. Retain the last fully validated higher-thrust solution if lowering thrust fails.
4. If no complete lunar candidate passes, deliver the fixed-primary scene and report the searched lunar domain.

That preserves the brief’s “if feasible” boundary. Neither additional steering segments nor a general optimizer is required to complete this slice.

**5. Capture and resource presentation need stronger admission checks.**

[verified: source inspection] Capture already records pre-attachment position error and charges velocity mismatch in [runner.ts](/home/s/code/orbital-logistics/src/sim/runner.ts:145). However, the viewer’s fuel-used readout sums completed ledger entries, and [sampleVessel](/home/s/code/orbital-logistics/src/model-set/model.ts:98) holds resource values constant between samples.

Powered samples must supply cumulative usage directly. Display resources should interpolate or evaluate the scalar mass law within event-separated intervals, using event-left resources before capture/refueling. Discrete cargo and service changes remain discrete.

For the normalized powered witnesses, recommend:

- No authored nonzero impulses anywhere in the demonstration program.
- Independent **pre-snap** position and velocity residuals, each plus its declared numerical error allowance, below \(10^{-7}\)—one hundredth of the current capture tolerance.
- Capture residual delta-v and fuel reported separately.
- Complete outbound/service/return checks using actual cargo mass, finite refueling stocks and the existing return reserve.

Passing through the horizon alone does not establish that the intended voyage completed.

**Concrete acceptance gates**

| Gate | Required evidence |
|---|---|
| Primitive | Pure zero-gravity analytic position, velocity and fuel checks; capped/uncapped motion, transition, zero throttle, depletion and inclined directions. Do not weaken the scenario schema just for these tests. |
| Canonical behavior | Identical committed results under dense/reversed queries, warp, seek and reload; off-grid starts/ends; adjacent heading changes; depletion coincident with other events; partial failure accounting. |
| Safety | Powered approaches that defeat the old gravity-only bound stop safely; moving sources, subdivision exhaustion and node-budget exhaustion preserve valid prefixes. |
| Independent numerics | Independently coded seven-state DOP853 comparison and h/h2/h4 for the **same authored program**, without retargeting at each resolution. Check pre-capture states, fuel and derived event times. |
| Content and viewer | One admitted fixed-primary powered route; bounded lunar outcome recorded; exact resource jumps and smooth active consumption; thrust telemetry and spans; speed/frame/scrub changes leave physics unchanged. |

**Human decisions:** none block implementation. Numerical representation, versioning, event order and bounded search policy are engineering choices. Human judgment is needed later for whether the resulting burn durations and choreography are visually satisfying; expanding steering solely to achieve a particular appearance would be a separate choice.
