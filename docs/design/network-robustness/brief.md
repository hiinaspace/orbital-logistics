# Network storage robustness follow-up

User accepted 2× viewing but reported `Network invariant failed: Candidate physical storage budget exceeded` and a sidebar time cursor briefly resetting to zero. This is a scoped repair, unchanged field, hardware, schedules and budgets.

| Fact | Evidence |
|---|---|
| Checkout / baseline | `/home/s/code/orbital-logistics`, `65b61d2`, Node22/TypeScript7, natto; preview4178 retained. |
| Physical ownership | `src/network/engine.ts` private whole-epoch prepare/commit, sequential assigned-lane planners. |
| Network budgets | Unique Runner registry in `src/network/origin.ts`:400k transient, cache24 entries. Network engine enforces140k retained; packet/view16MB. |
| Legacy check | `src/adaptive/plan.ts` near end of `buildPlanJob` adds `residentNodes + owner.nodes + trip.nodes + outbound.retainedNodes + inbound.retainedNodes`, throws a generic Error at220k. `planner.ts` passes guide+best nodes, including shared hub intervals counted repeatedly. |
| Shared forecasting | Guide forks share exact canonical hub Runners. Owner and reconstructed trip also reuse exact hub intervals. Registry deduplicates them, old sum cannot. |
| Existing witness | Network512 passed but user encountered failure later. Longer actual rollout is running; `baseline.log/json` are current evidence, no longer-run success claimed. |
| UI reproduction | `chart-before.log` reproduces >50 replacements with missing cursor transform. `fuelGraph` emitted cursor at x0 and `refreshTraffic` replaced it before the next panel tick. New template positions it immediately using the same calculation as panels. |

Verified claims above are from source or named fresh test; longer-run trigger and actual peak at failure remain unknown until baseline completes. No physics/safety/admission relaxation is proposed.

Lean: choose exactly one physical-storage authority for network admission. When `OriginIntervals` is supplied, rely on its global deduplicated allocation guard and call `reserve()` at candidate handoff; retain the legacy220k sum only for old single-lane domain without a registry. Do not simply raise220k. Current400k registry still includes committed old state, private transaction state, guide, retained best, trial/reconstruction worlds, outbound/inbound via scoped watchers and conservative per-shot allowances. Review its coverage, particularly scratch lifetime and final reconstruction allocation, rather than assuming it is complete.

Open decisions:
1. Is bypassing the legacy sum only with the network registry correct? Alternative deduplicating only this sum excludes other network actors/old committed state; rejected as competing partial authority. Increasing thresholds rejected as masking double counting.
2. True transient exhaustion: keep fail-closed invariant behavior in this patch, or narrowly classify speculative storage refusal as a bounded planning retry? Lean keep fail-closed unless correctness of typed/scoped retry is clear. Do not turn committed ownership/allocation failures into successful admission or coasting.
3. Regression scope: bounded actual rollout beyond first failure, exact baseline-prefix plans/resources, targeted shared-budget accounting/candidate regression and live DOM mutation cursor test. Prefer compact late-epoch plan witness to an expensive long soak in the normal suite.

Use senior-review verify-then-critique discipline. Read-only: audit source and available fresh evidence; do not edit files, spawn reviewers or launch a long rollout concurrently. Return prioritized load-bearing findings and a concrete scoped disposition, within roughly five minutes. No re-review of viewer cameras, force math or general routing. This review is authorized by the user's continuing Astra-review preference.
