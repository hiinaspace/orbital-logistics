Recommend the **network-only authority switch**, while retaining fail-closed behavior for genuine storage exhaustion. The direction is supported; the registry’s hard allocation-bound claim needs tightening.

**Verified:** [baseline.log:12](/home/s/code/orbital-logistics/docs/design/network-robustness/baseline.log:12) now reproduces the exact failure preparing **t=696**, leaving the published frontier at **695.9375**. Reported peaks were **262,224 transient-accounted nodes** and **133,744 retained nodes**, below the network’s 400k/140k limits. These are accounting measurements, not a complete measurement of live scratch allocations.

I traced committed/private worlds, guide forks, retained-best trips, reconstruction worlds and flight holds through the registry. It deduplicates Runner identities; the legacy sum does not. Whole-epoch publication and the 140k retained guard are present in [network/engine.ts](/home/s/code/orbital-logistics/src/network/engine.ts:83). The 24-entry cache and 400k reservation check are in [network/origin.ts](/home/s/code/orbital-logistics/src/network/origin.ts:9); reply and aggregate held-display 16MB guards also exist.

Prioritized disposition:

1. **P1 — Adopt the network-only replacement; preserve legacy behavior. Verified.**
   `guide.nodes + best.nodes`, owner and reconstructed-trip counts overlap through shared canonical Runners. Use the registry at candidate handoff and retain 220k only without it. That change appeared in the working tree during this review and matches the recommendation: [adaptive/plan.ts:130](/home/s/code/orbital-logistics/src/adaptive/plan.ts:130). Keep genuine reservation/ownership failures as invariant stops; retry classification adds unnecessary scope.

2. **P1 — Make allocation allowances enforceable before declaring the registry a hard transient bound. Verified gap; an actual overrun is unknown.**
   An eight-unit cache miss reserves **3,072 nodes**, but propagates a Runner whose fixture policy permits **65,536**. World blocks similarly reserve a nominal allowance while inheriting that larger cap. Safety subdivision can add nodes beyond the nominal grid: [origin.ts:17](/home/s/code/orbital-logistics/src/network/origin.ts:17), [world.ts:35](/home/s/code/orbital-logistics/src/adaptive/world.ts:35), [runner.ts:259](/home/s/code/orbital-logistics/src/sim/runner.ts:259).
   Require each allocation’s enforced maximum to fit its reservation, or charge growth before allocating. Preserve safety checks and the 400k limit. Final reconstruction’s two-leg allowance does match the explicitly bounded leg policies; world/cache growth is the weaker part.

3. **P2 — Make registration exception-safe. Verified conditional defect.**
   [CoupledTrip’s constructor](/home/s/code/orbital-logistics/src/adaptive/plan.ts:72) registers `this` before calling `reserve()`. If that call throws, construction never returns and the caller cannot dispose that registration. Roll it back locally on failure. This is not established as the reported failure’s cause.

4. **P2 — Keep the cursor fix; strengthen its regression assertion. Verified.**
   Immediate template positioning addresses the missing-transform replacement bug, and [chart-after.log](/home/s/code/orbital-logistics/docs/design/network-robustness/chart-after.log:8) records a pass. However, the [test](/home/s/code/orbital-logistics/tests/browser/network-service.spec.ts:24) also accepts a stale nonzero or `NaN` transform. Check a finite position against the displayed epoch and chart window.

For acceptance, use a compact failing-candidate witness, allocation-refusal/cleanup checks, exact prefix plan/resource comparisons, and one bounded continuation through **696 and the next completed service**. At my last inspection, fixed-run summary rows matched baseline through **384**; continuation past the failure and exact prefix parity remained **unverified**.

I made no edits, spawned no agents, and launched no simulations or test jobs.
