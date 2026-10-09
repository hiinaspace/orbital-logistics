**The narrow `staged-flight-v1` architecture is sound, but five contracts need tightening before implementation.** Separate Runners are sufficient for this finite mission.

Verified on `natto`, branch `codex/model-set-viewer`, HEAD `8707202`: tracked source is clean; the claimed propulsion, launch, landing and aggregate-admission seams exist. All five targeted test files passed: runner, propulsion, surface, landing and model-set. I also ran disposable in-memory probes. Staged mission feasibility, Chrome and SSH/forwarding claims remain unverified.

1. **High — Separation needs an authoritative transaction and a canonical epoch.**
   “Exact Runner state” and “synthetic separation viewer event” in [brief.md:16](/home/s/code/orbital-logistics/docs/design/staging/brief.md:16) leave the boundary underspecified. `Runner.sample(t)` can return disposable propagation between checkpoints, while segment durations must contain an integer number of steps ([schema.ts:134](/home/s/code/orbital-logistics/src/sim/schema.ts:134), [runner.ts:305](/home/s/code/orbital-logistics/src/sim/runner.ts:305)).

   Choose separation on the common coarsest validation grid; terminate the parent there. Define ordering as parent thrust-end → atomic separation → permitted child thrust-starts, rejecting coincident impulses or logistics operations. Validate both child seeds before publishing either. The orchestrator owns the separation record; the viewer displays it. No core separation opcode is necessary.

2. **High — Wet-mass equality alone does not establish ownership.**
   Ballast encoding is mechanically valid, but the mission needs one authoritative component manifest. Derive stack nonfuel mass as booster dry mass + courier dry mass + reserved courier fuel; account for freight separately. Derive booster fuel from the actual parent remainder, retain courier fuel unchanged, and prevent either engine from consuming the other tank.

   New Runners reset cumulative fuel usage ([runner.ts:48](/home/s/code/orbital-logistics/src/sim/runner.ts:48)); the probe confirmed this. Mission accounting must include reserved courier fuel before separation and count parent consumption exactly once afterward. Retired stack samples remain history, not additional inventory.

   Child stock copies are acceptable for this fixed, independently executable exhibit. Preserve one mission-start stock anchor and uniquely identified parent/child transfer deltas. Copies are local admission inputs; never sum their inventories or replay the parent ledger in both children. Retain the restriction against depending on sibling deliveries.

3. **High — Lifetimes must govern every query, including reference-frame vertices.**
   The proposed glyph filtering is insufficient. Timelines sample across the complete scene window, and frame transforms query the reference vessel at each vertex’s epoch ([main.ts:179](/home/s/code/orbital-logistics/src/main.ts:179), [frames.ts:5](/home/s/code/orbital-logistics/src/model-set/frames.ts:5)). Both out-of-lifetime queries threw in the probe.

   Add explicit presence/validity queries and apply them to timelines, inspectors, tracking, hit testing, charts and diagnostics. Preserve absent actors as selectable metadata without inventing physical samples. When a vessel-centered frame is active, clip paths to that frame’s valid interval; switching individual vertices to another frame would mix coordinate systems. Keep explicit selection, disable tracking when its target disappears, and use a deterministic whole-frame fallback.

4. **Medium — Segment preparation needs explicit airborne intervals and aggregate budgets.**
   `prepareSet` rejects different epochs/durations ([model.ts:50](/home/s/code/orbital-logistics/src/model-set/model.ts:50)). Its dense landing coverage also requires an earlier launch/undock ([model.ts:119](/home/s/code/orbital-logistics/src/model-set/model.ts:119)), which a separated booster correctly lacks.

   Extract a segment-preparation helper accepting an executed Runner and explicit free-flight intervals, including birth-to-first-arrival. In my probe, rebasing the existing descent at grid epoch 8 preserved final physics exactly, but preparation produced only 2,059 samples; interpolation error reached **0.884 pixels at maximum zoom**. This demonstrates a display regression from naive reuse, not staged-flight feasibility. Bound total nodes, drawing samples and serialized output across all three segments.

5. **Medium — Admission must prove mission completion and independently propagate the split.**
   `prepareSet` checks successful horizon completion, not whether the intended delivery/recovery occurred ([model.ts:107](/home/s/code/orbital-logistics/src/model-set/model.ts:107)). Require completed courier unloading at Lantern, booster attachment at Cairn, no unfinished service, valid reserves and one conserved freight inventory.

   The DOP853 oracle must integrate its own stack state and branch from that result. Seeding both oracle children from the production Runner would hide parent/split errors. Compare pre-capture residuals with numerical allowance, fuel consumption, unchanged clearance certificates and exact boundary ownership. Add negative fixtures for duplicated cargo/fuel, altered child seeds, double-counted parent history, split conflicts and one failed child.

I recommend proceeding with a pure staged orchestrator, derived legacy Bundles, one mission ledger, and a lifecycle-aware SceneView. Restrict this version to the existing fixed Selene body and unchanged analytical Cairn/Lantern rails. No further human architecture decision is needed; numerical feasibility and the eventual visual experience remain separate gates.

No files edited or subagents used.
