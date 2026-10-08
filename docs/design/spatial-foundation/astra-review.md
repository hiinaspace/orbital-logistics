The proposed direction is sound. I recommend proceeding with the spatial foundation after tightening **the canonical state/burn/event contract** and **validation before docking changes the arrival state**. Lunar freight should remain a separately bounded experiment.

I reviewed `65935ab` on `codex/model-set-viewer`. No files were edited and no reviewers were delegated.

| Claim | Verification |
|---|---|
| Canonical grid, event splitting, disposable queries, replay-validated snapshots | Confirmed in [runner.ts](/home/s/code/orbital-logistics/src/sim/runner.ts:136). |
| CCW transverse burns, atomic fuel charging, paid capture residual | Confirmed in [runner.ts](/home/s/code/orbital-logistics/src/sim/runner.ts:58). Clockwise compatibility has an explicit test. |
| Fixed-primary circular logistics and narrow planar targeting | Confirmed in [schema.ts](/home/s/code/orbital-logistics/src/sim/schema.ts:105) and [rendezvous.ts](/home/s/code/orbital-logistics/src/planning/rendezvous.ts:76). |
| Independent vessel execution, aggregate stock/berth admission | Confirmed in [model.ts](/home/s/code/orbital-logistics/src/model-set/model.ts:64). |
| Label anchors reset every frame | Confirmed in [main.ts](/home/s/code/orbital-logistics/src/main.ts:200). |
| Existing validation | Typecheck passed; direct test-module execution confirmed **71 passing simulation tests**. Browser and independent-oracle results were inspected as retained evidence, not rerun. |

1. **P0 — Specify one canonical spatial execution contract before migrating consumers.**

   Merge decisions 1–3 and the event boundary into this decision. A version bump is necessary, but insufficient: state layout, burn interpretation and event-side semantics must move together.

   **Input/runtime seam.** Introduce explicit v1 wire types and one canonical v2 runtime representation:

   ```ts
   type State = [x, y, z, vx, vy, vz];
   // unknown → decode/version conversion → validated canonical Bundle
   ```

   Keep four/six-component unions inside the loader only. Runner, workers, diagnostics and presentation consume canonical data. Use small position/velocity/vector helpers so migrating an index does not silently turn velocity into position.

   Convert `[x,y,vx,vy]` to `[x,y,0,vx,vy,0]`; lift fixed positions and circular centers; preserve absolute-time rail phase, currently `phase + rate*t`. New serialization emits v2. Reject v1 snapshots explicitly; offer program recovery through conversion and replay, without trusting their anchors.

   Include nested saved programs in the conversion boundary. [EditorSession](/home/s/code/orbital-logistics/src/editor/session.ts:101) separately loads `baseline` and `accepted`; [targetBundle](/home/s/code/orbital-logistics/src/planning/target.ts:10) constructs a schema-1 program. Updating only the top-level fixture loader would leave mixed-version paths.

   **Rails.** Use the proposed explicit `center,u,v,radius,rate,phase`. Define the normal as `u×v`; no hierarchy is needed. Reject malformed bases and avoid repeatedly normalizing serialized values during validation: validation/reload must be idempotent. The clearance calculation needs a conservative speed bound for the basis actually evaluated, including accepted floating-point deviations from orthonormality.

   **Burns.** I recommend two canonical variants:

   - An inertial Cartesian `deltaVelocity: Vec3`, especially for offline shooting.
   - A reference-body radial/transverse/normal burn with an explicit inertial orientation axis.

   For the latter, evaluate once from the actual pre-burn state:

   \[
   R=\frac{r-r_b}{|r-r_b|},\quad
   T=\frac{a\times R}{|a\times R|},\quad
   N=R\times T,\quad
   \Delta v=d_rR+d_tT+d_nN.
   \]

   Call `a` an **orientation axis**, not necessarily the resulting orbital normal: when it is not perpendicular to `R`, resolved `N` differs from `a`.

   Convert legacy burns to this variant with `a=(0,0,1)` and `d_n=0`. This preserves their CCW convention on clockwise trajectories without retaining a separate legacy execution branch. Never substitute instantaneous angular momentum.

   Reject nonfinite geometry, zero relative radius, and near-parallel `a,R` before mutation. Specify a dimensionless pole threshold—`|a×R| ≤ 1e-10` is a reasonable conservative starting policy for unit vectors—and test both sides. Radial velocity alone is not degenerate with this construction. A statically valid zero impulse can remain a no-op without resolving axes.

   Charge fuel from the resolved vector norm. Rejected burns leave position, velocity, fuel and cursor unchanged; diagnostics may record rejection. Cartesian burns eliminate unnecessary basis singularities for generated transfers and are justified within this scope.

   **Events.** Expose ordered before/after states for instantaneous physical changes. Keep the existing order: completion → undock → burn → dock → service start. The viewer should consume the state before the first event and after the last event at an epoch.

   This addresses a reproduced defect: [stateAt](/home/s/code/orbital-logistics/src/model-set/model.ts:114) subtracts a burn from a post-docking state, but docking also changes position and velocity. In an in-memory Orison variant, leaving a valid `5e-6` capture residual produced approximately `5e-6` of premature displayed velocity change immediately before capture; execution still reached the horizon. Existing authored residuals are much smaller, but the contract is incomplete.

   Build on [coastSegments](/home/s/code/orbital-logistics/src/sim/runner.ts:194), which already distinguishes pre-event endpoints. Do not make presentation reverse additional burn and docking formulas.

2. **P0 — Make pre-capture accuracy and spatial covariance the decisive numerical gates.**

   The largest missing proof is accuracy **before attachment**. Docking overwrites the ship with the port state, so excellent post-dock agreement can conceal arrival error. Current evidence sampling explicitly includes event epochs and shortly afterward; add the exact state immediately before docking, including after any coincident capture burn.

   Require:

   - Exact agreement in event IDs/order, discrete classifications and resource transfers between legacy and converted fixtures; bounded numerical agreement for state and fuel.
   - Exact zero `z,vz` preservation for planar inputs, plus clockwise burn compatibility.
   - An obliquely rotated and translated analytic orbit with unequal, nonzero components.
   - Moving sources and ship motion that do not all occupy one plane.
   - Rotation covariance of propagation and burns when states, rails and burn axes are rotated together. Test view-transform covariance separately.
   - Separate negative cases for `z` position misses, `vz` capture misses, and fast motion through a surface along the third axis.
   - Query-order, partition, event-boundary and snapshot invariance in spatial fixtures.

   For declared characteristic scales `L,V`, start with position/velocity error budgets of `1e-8 L` and `1e-8 V`, tightened to at most one hundredth of the applicable capture tolerance. Require oracle tightening to change results by less than one tenth of that budget. At capture, budget **both target and ship error**, and require the remaining tolerance margin to exceed their combined uncertainty.

   Use `h,h/2,h/4`; expect fourth-order improvement on smooth coasts until roundoff dominates. Compare fuel and pre-dock residuals separately from snapped states.

   Preserve work limits. I reproduced rejection of duration 64 at `h=1/1024`: the base grid alone exceeds the permitted node count. Shorten refinement fixtures and retain headroom for events/subdivisions.

   Finally, re-audit the [clearance certificate](/home/s/code/orbital-logistics/src/sim/dynamics.ts:28) mathematically after changing norms and rails. Oracle agreement establishes trajectory accuracy; it does not establish the certificate’s safety argument.

3. **P1 — Put explicit domain guards on every planar planning entry point.**

   Keeping the existing solver narrow is correct. Its restrictions currently depend partly on schema validation; widening that schema removes implicit protection.

   Add one shared planar-domain check used by targeting and encounter proposals. Check the actual departure prefix, target trajectory, relevant sources, ports and burns. Reject unsupported inputs before evaluating candidates; never project them into XY silently.

   Generalize distance, relative speed and radial-velocity diagnostics to 3D. Keep geometric orbit matching planar: [discoverEncounters](/home/s/code/orbital-logistics/src/planning/encounters.ts:25) derives phase, angular rate and crossings using XY assumptions. It is more than a dot-product migration.

   Centralize burn magnitude/resolution helpers. Diagnostics currently identify impulses using only radial/transverse components, which would miss a normal-only burn.

4. **P1 — Attempt lunar rendezvous before introducing trajectory-backed logistics.**

   Start with the existing binary field, the existing DRO as a ballistic target, and one visitor. Offline shooting can already emit explicit paid programs for two free-flight vessels without broadening the logistics schema.

   Declare the departure-state family, departure/arrival windows, fuel budget, minimum clearance and bounded search effort beforehand—for example, 16 seeds with at most 64 correction evaluations each. Report the searched domain and failures. Failure establishes no solution within that search, not global infeasibility.

   Success requires independent propagation of **both** target and visitor, converged arrival position/velocity, paid departure and matching impulses, and survival through a finite post-arrival interval. A co-located, velocity-matched free-flight pair is an honest intermediate result.

   Only then introduce a narrow trajectory-backed station variant. Store its initial state, epoch, finite validity interval, canonical integration policy and provenance. A headless `targetStateAt(t)` may query a dedicated canonical Runner; drawing samples must never supply station physics. Include the target definition and policy in shared-world compatibility checks.

   The important additional obligation is constrained dwell. [Runner’s docked coast](/home/s/code/orbital-logistics/src/sim/runner.ts:139) currently bypasses surface certification. That is supported by the present single-primary circular-port restrictions; it cannot simply be inherited by arbitrary targets.

   For the first extension, admit only an independently validated, burn-free ballistic target over the complete dock/dwell/undock interval. Verify full spatial capture, charged residual velocity, bounded attachment, safe target motion and undock continuity. Reject out-of-range queries. Target maneuvers or maintained trajectories require an additional accounting model.

   Lunar freight remains below foundation correctness in priority, but its experiment should actually be attempted before choosing the inclined fixed-primary fallback.

5. **P2 — Keep rotation about Z for this viewer; migrate complete state transforms.**

   Arbitrary-axis rotating frames are unnecessary for the authorized XY viewer. Preserve explicit Z-axis metadata and implement six-component translation/rotation with

   \[
   r'=Q(r-o),\qquad v'=Q(v-\dot o)-\omega'\times r'.
   \]

   Keep the transform interface capable of accepting a later orientation basis. Current frames need not become a general camera system.

   Audit presentation consumers too: [ship heading](/home/s/code/orbital-logistics/src/main.ts:258) currently reads velocity from indices 2 and 3. Define a stable glyph orientation when projected velocity is nearly zero. Expose depth/vertical velocity on demand so an XY overlap is not mistaken for spatial proximity.

6. **P2 — Implement label stability as a small presentation change.**

   Keep an anchor per object ID, place selected/hovered labels first, and use hysteresis before changing visibility. Anchor retention should survive ordinary playback, scrubbing and pan/zoom. Reset predictably on scene changes; define frame-change behavior explicitly.

   Avoid moving a label merely because another anchor becomes momentarily available. Verify paused stability, reverse scrubbing, docking overlaps and selection priority. This requires no simulation abstraction.

The implementation order should be: capture legacy baselines → establish v2 types, rails and burn/event semantics → migrate Runner and fence planners → pass independent spatial and compatibility gates → migrate viewer transforms and labels → attempt bounded lunar rendezvous → add station semantics only if the experiment supports them.

All six recommendations are decisions the implementation owner can make within the brief. **No additional human architecture decision is necessary now.** Human review belongs at the completed viewer’s readability and motion, and at any later proposal to expand scope beyond the bounded lunar result.
