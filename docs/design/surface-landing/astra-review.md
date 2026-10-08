Proceed with an additive `land` operation and a separate finite round-trip set. The highest-leverage decision is the combined **capture-envelope and event-transaction contract**. Settle that before implementation; descent feasibility remains an authoring gate.

This review was read-only and used no delegation. Recommendations below are proposals, not implemented behavior.

[verified: Git and hostname] The cited host, branch and commit match: `natto`, `codex/model-set-viewer`, `ca8b843`. No remote is configured. The landing directory was untracked at entry; an unrelated numerics pre-commit configuration change appeared during review. I made no edits.

[verified: code and focused execution] The load-bearing baseline claims hold:

- Surface geometry derives from the fixed body, supported COM height and physical XY spin. The schema rejects spin requiring tensile support. Surface `dock` requires exact initial attachment; later attachment rejects. See [schema.ts](/home/s/code/orbital-logistics/src/sim/schema.ts:179) and [runner.ts](/home/s/code/orbital-logistics/src/sim/runner.ts:155).
- The focused surface test file passes. Current production replay exactly matches the retained samples and ledger: 6,177 nodes, final fuel `0.16669451136764724`, and orbital capture residuals approximately `3.15e-13` position and `2.79e-13` velocity.
- Read-only DOP853 replay reproduces the retained three-resolution discrepancies: `2.31e-12`, `1.58e-13`, `7.18e-14`. Oracle tightening differs by `3.04e-13`. These checks concern ascent, not a proposed descent.
- All 1,485 production free-flight intervals pass the unchanged clearance certificate; its minimum conservative clearance bound is approximately `5e-7 R`.
- A targeted probe confirms the event-order hazard: adding a thrust start at orbital arrival produces `dock → transfer-start → operation-rejected`. The ship remains attached with service started. This establishes why landing conflicts must be rejected before landing commits.

[verified: retained evidence only] The reported 110 simulation and 15 browser passes are documented in [surface-ascent.md](/home/s/code/orbital-logistics/docs/evidence/surface-ascent.md). I did not rerun those broader suites or interact with the browser.

My recommended disposition, ranked by leverage:

| Priority | Fork | Disposition | Decision |
|---|---|---|---|
| 1 | B + C: capture and atomicity | Adapt | Treat them as one contract: geometrically bounded, fully paid attachment, with static conflict rejection and a precisely scoped commit. |
| 2 | E: authoring | Adopt with constraints | Solve a forward-time reference descent, phase it against the existing depot and pad, then replay the entire unchanged outbound prefix. |
| 3 | A: operation and versions | Adopt | Add explicit `land`; preserve existing `dock` and canonical-v3 behavior. Apply new restrictions only to programs containing landing. |
| 4 | D: presentation and sampling | Adapt | Integrate landing as an arrival everywhere; validate the sampling error domain rather than assuming two dense windows suffice. |

The following is the proposed minimal landing contract.

1. **Validate the event’s structure before execution.**

   Admit `{id, kind: "land", t, portId}` only for canonical schema 3, `surface-ports-v3`, a surface port, and `t > scenario.epoch`. Give it arrival ordering, alongside `dock`.

   At the landing epoch, reject any authored impulse, any new thrust arc—including zero-throttle arcs—and any other operation except one transfer targeting that same pad. Permit a thrust arc to end exactly at landing. Continue rejecting operations strictly inside arcs.

   Put these rules in bundle validation. An impulse currently runs before arrival processing, so discovering its conflict inside the landing branch would be too late.

   [verified: probe] The current reader rejects unknown `land`. [verified: code] Snapshots validate through deterministic replay in [Runner.restore](/home/s/code/orbital-logistics/src/sim/runner.ts:333). Together these support retaining canonical v3, provided old accepted bundles still reproduce their snapshots. Avoid changing global event ordering or tightening every surface scenario’s capture configuration.

2. **Use a local, geometrically safe capture envelope.**

   At the exact event epoch, obtain the analytical pad state from `Runner.portState`. Let:

   - \(d_p\) be full three-dimensional position error.
   - \(d_v\) be full relative-velocity magnitude against the rotating pad.
   - \(h\) be the represented target clearance above the body.
   - \(\epsilon_p=\min(\text{capture.position},h/4)\).
   - \(\epsilon_v=\text{capture.velocity}\).

   Require finite values, positive represented clearance, \(d_p\le\epsilon_p\), and \(d_v\le\epsilon_v\). Derive the tighter effective tolerance for landing instead of rejecting historical initial-only surface bundles with larger configured tolerances.

   The geometric reason is straightforward: the entire capture ball lies at least \(3h/4\) above the sphere. Even a straight position correction within that ball stays outside it. This bounds the attachment correction; it does not replace certification of the incoming trajectory.

   **Do not add a radial-velocity sign gate.** Full relative-speed matching already bounds and charges outward, inward and lateral residuals. Rejecting a tiny positive radial residual would introduce another numerical classification boundary without materially improving this schematic attachment model.

   Likewise, permit arrival slightly below supported COM height when still inside the envelope and above the sphere. The accepted abstraction is a supported point attachment. A visibly descending final approach belongs in authored-content admission, where it can be assessed without changing runtime contact semantics.

3. **Price and validate the entire attachment before mutating it.**

   First require that the ship is unattached, not servicing and no longer under active thrust. Compute residual fuel from post-flight resources:

   \[
   m^- = m_\text{dry}+m_\text{cargo}+f^-,
   \qquad
   f_\text{capture}=m^-[-\operatorname{expm1}(-d_v/v_e)].
   \]

   Require a finite affordable result. Positive residual velocity with zero fuel rejects; exactly zero residual may attach without fuel. Numerical acceptance allowances must not become runtime free-impulse allowances.

   Only after every check succeeds should landing subtract fuel, increment cumulative consumption, set the exact pad state, attach to the pad, advance the operation cursor and emit one `land` entry. Record position error, residual Δv, fuel charged and before/after fuel.

   No synthetic `dock` entry is needed. One successful landing produces one berth arrival.

4. **Define atomicity around landing, not the entire epoch.**

   [verified: code] Current event processing closes thrust and completes due service before executing later operations. Its existing event boundary encloses the whole epoch’s processing in [runner.ts](/home/s/code/orbital-logistics/src/sim/runner.ts:119).

   Preserve that model. A rejected landing leaves position, velocity, fuel, stocks, attachment and operation cursor unchanged **relative to the landing attempt’s entry state**. It may set failure status and append rejection diagnostics. Earlier completed thrust remains completed and paid.

   If free flight cannot reach the event because its clearance certificate exhausts, retain the existing safe-prefix termination. Do not force execution to the landing epoch.

   A successful landing followed by a resource-invalid transfer is a different case: landing remains committed; transfer rejects. That is consistent sequential execution, not partial landing. Prepared-set admission rejects the resulting failed program.

   For successful terminal thrust, landing and unloading start at one epoch, the expected ledger is:

   `thrust-end → land → transfer-start`

   Preserve the existing event-left state before these transitions and event-right state afterward. Do not create a second snapshot/event-boundary convention just for touchdown.

5. **Make physical admission stricter than runtime acceptance.**

   For the frozen showcase, require production, both refinement runs and the independent oracle to report pre-snap residuals. For position and velocity separately, the maximum residual plus the proposed `1e-8` allowance must be strictly below both the applicable runtime tolerance and the `1e-7` content ceiling.

   This matters because post-attachment agreement can conceal approach error: both implementations snap to the same analytical rail. Compare the independently propagated left state before that snap, along with capture fuel and subsequent resources.

   Preserve clearance certification through every incoming interval. DOP853 agreement is numerical evidence, not an independent interval-safety proof.

For authoring, the rotational-symmetry lean is sound, with one restriction: **choose departure time and rotate the reference controls; leave the existing depot and Cairn phases fixed.**

[verified: fixture and arithmetic] Depot rate is approximately `0.7155417528`; pad spin is `0.003`, giving a relative-phase period of `8.8179889564`. A reference descent of duration \(T\), starting at orbital angle zero and ending at angular displacement \(\alpha\), can be phased using

\[
(n-\omega)t_d
=\phi_\text{pad}+\omega T-\phi_\text{depot}-\alpha+2\pi k.
\]

Choose a branch after depot service completes, rotate every inertial heading by the depot’s departure angle, then freeze the resulting epochs. The full replay must establish the witness because this analytical construction does not remove integration error or resource constraints.

[verified: resource probe] The proposed load fits existing stocks and capacities:

- Fuel after depot refueling would be approximately `1.11669451137`, below the `1.4` tank capacity.
- Loading `0.05` cargo fits the `0.1` cargo capacity.
- Preserving the original unload and adding a subsequent load/refuel service makes earliest departure approximately `2.3207514043`.

There is a bookkeeping consequence: Lantern starts with zero cargo. Delivering `0.1` and taking back `0.05` leaves **net delivery `0.05`**. [verified: code] `logisticsResult` measures net destination-stock increase, so an unchanged `0.1` objective remains incomplete after that return. Make the new fixture’s metadata consistent, and describe the cargo honestly as fungible freight; no commodity-system expansion is necessary.

[unknown] Available fuel does not establish that the bounded descent is feasible. Keep its search bounded by duration, arc count, fuel and final certification. At the finest proposed step, a 32-unit horizon already exceeds the 65,536-node schema budget before event or safety-subdivision overhead. Include attached waiting and final dwell in that budget.

For presentation, [verified: code] [model.ts](/home/s/code/orbital-logistics/src/model-set/model.ts:59) counts only `dock` as arrival, while [nextDock](/home/s/code/orbital-logistics/src/main.ts:94) controls destination status and route extent. Update all three behaviors together: arrival ordering, berth accounting and next-arrival lookup. Use “Touchdown” for the event and retain “On pad” for attached state.

Dense samples before landing are appropriate, but **two time units is a sampling choice, not an accuracy guarantee**. The longer round trip makes the existing 2,049 whole-horizon samples more widely spaced. Declare whether the close-view bound covers surface windows or all inspectable free flight, then measure that domain explicitly.

Split drawing intervals at exact events and use the existing event-left state for interpolation into touchdown. Check representative interior points and transformed path segments in supported frames, including the landing boundary. Keep an explicit sample budget and reject content that cannot satisfy it. Renaming Launch view to Surface view is sufficient; automatic frame or speed changes add no necessary capability.

The decisive implementation gates are:

- **Envelope:** just-inside/outside position and full-speed limits; lateral and vertical excess; below-COM but exterior arrival; small upward residual accepted; zero-fuel positive-residual rejection.
- **Transaction:** underfuel and envelope failures preserve the attempted transition’s inputs; ending thrust remains paid; forbidden same-epoch combinations fail validation; successful landing plus failed transfer has distinct expected behavior.
- **Lifecycle:** one arrival, finite stock and mass conservation, unloading/dwell, then a small relaunch test using existing post-service launch semantics.
- **Determinism:** exact event sides, irregular queries and backward seeks, snapshots before/at/after success and failure, and retained old snapshots unchanged.
- **Witness and view:** unchanged outbound prefix; full round-trip three-step/DOP853 resources and pre-snap residuals; certified clearance, node/sample budgets, and production-browser touchdown/frame/scrub/set-switch checks.

No additional human design decision is required for this contract. The remaining judgment for the user is the eventual motion and close-view experience; feasibility and correctness should be established before presenting that gate.
