I support the narrow `atmospheric-mission-v1` approach, conditional on numerical feasibility. **Use a small shared atmospheric segment core with absolute mission epochs, plus a finite mission orchestrator.** Preserve the existing entry and staging contracts.

I verified the relevant source at `987a0a9`. The entry, staging, propulsion, steering and surface test files pass, as does typecheck. No files were edited or subagents launched. I did not rerun browser checks or the independent oracle; the proposed mission remains unwitnessed.

The priorities are:

1. **P1 — Establish insertion and recovery feasibility before building mission presentation.**
   Choosing the station’s phase from an insertion witness can align its position, but cannot eliminate radial velocity or incorrect circular speed. Existing circular-port validation correctly requires the Keplerian rate; `paidCapture` only tests supplied residual tolerances and charges velocity matching. It does not include a numerical error allowance. Freeze the station and program before convergence/oracle checks, and require **position residual + allowance < `1e-7` and velocity residual + allowance < `1e-7`**. [Rail validation](/home/s/code/orbital-logistics/src/sim/schema.ts:212), [paid capture](/home/s/code/orbital-logistics/src/sim/capture.ts:6).

   The first feasibility gate should include ascent, actual separation, viable booster recovery, and courier insertion with a declared return-fuel reserve. Then prove deorbit and courier recovery from that same frozen outbound result. Reaching orbital altitude alone is insufficient.

2. **P1 — Separate interval integration from entry-specific termination.**
   `prepareEntry` requires epoch zero, an above-atmosphere start, and eventual water recovery. Its near-shell logic demands certified descending motion; carrying that logic unchanged into a launch starting near the shell can exhaust subdivisions. This is appropriate for entry, but unsuitable as the ascent runner. [Admission](/home/s/code/orbital-logistics/src/model-set/entry.ts:19), [integration and contact detection](/home/s/code/orbital-logistics/src/model-set/entry.ts:65).

   Extract the bounded RK4/step-doubling/enclosure machinery into a small internal core. Give it explicit **prescribed thrust versus entry feedback**, and **fixed endpoint versus descending water contact** policies. Preserve the old entry wrapper and its accepted numerical behavior. Avoid extending the legacy Runner’s force law or copying the whole entry integrator into another implementation.

   Add acceleration-cap transitions and fuel exhaustion to the boundary policy. For constant-throttle prescribed arcs, the existing `massLaw` already provides these epochs independently of aerodynamic motion; it can also check integrated fuel. [Anchored mass law](/home/s/code/orbital-logistics/src/sim/propulsion.ts:6).

3. **P1 — Make handoffs atomic transfers of physical state and ownership.**
   Existing staging correctly carries upper fuel as inaccessible ballast and derives both children from a retained parent checkpoint. Preserve that contract. The new risk is carrying obsolete mass or fuel accounting through capture, unloading and entry. Entry forces and their safety envelope derive nonfuel mass from their supplied scenario; each post-split/post-unload segment therefore needs the correct immutable mass context. [Separation](/home/s/code/orbital-logistics/src/model-set/staging.ts:77), [entry mass and enclosure](/home/s/code/orbital-logistics/src/sim/entry.ts:10).

   One mission ledger must own tanks, cargo and port occupancy. Local segment results report consumption; they do not independently mutate inventories. Recovered vehicles remain owners of their remaining fuel. Splashdown neither unloads cargo nor occupies a berth. Publish the scene only after both branches and the complete ledger pass.

4. **P2 — Scope aerodynamic presentation by phase and recovery results by actor.**
   Today, setting `v.entry` makes `sampleVessel` evaluate entry guidance throughout that vessel’s history. It overrides thrust, mass and axis. `SceneView.entry` also describes one recovery, and the inspector reads that singleton. A courier with ascent, station dwell and return cannot reuse those fields unchanged. [Sampling](/home/s/code/orbital-logistics/src/model-set/model.ts:179), [inspector](/home/s/code/orbital-logistics/src/main.ts:286).

   Keep three actor identities, but add bounded phase descriptors. Each phase chooses its force evaluator, mass context and constrained-state provider. Recovery records belong to individual actors. Cargo and cumulative fuel usage must survive segment transitions without resetting or falling back to birth values.

5. **P2 — Resolve the budgets and distinguish sampled loads from certificates.**
   My read-only preparation reproduced **8,965 physical nodes, 116,728 checked propagation evaluations and a 6.12 MB display packet** for the existing single entry. Post-recovery samples alone occupy 1.07 MB. Two recovery branches plus ascent make sparse constrained phases necessary; a 40,000-sample limit does not guarantee a 12 MB packet.

   The clearance envelope certifies exterior motion. Pressure/load maxima are checked stage observations, including rejected trials—not continuous peak certificates. Preserve that distinction and require independently refined maxima with margin for the frozen witness. [Work and load checks](/home/s/code/orbital-logistics/src/model-set/entry.ts:55).

The minimum spec I would approve is:

| Part | Required contract |
|---|---|
| **Domain** | Strict `atmospheric-mission-v1` discriminator and model version. One fixed primary, XY flight, Z spin, two hardware components, one pad and one circular station. Pad spin equals atmosphere/water spin. Station lies wholly above the atmosphere. Unsupported physical fields reject. |
| **Segment input** | Immutable start checkpoint `{t, position, velocity, fuel}`, end limit, mass context derived from the manifest, engine, fixed aero configuration, tagged control policy and tagged terminal policy. All external epochs are absolute mission time. |
| **Segment output** | Retained canonical checkpoints, exact terminal checkpoint, event-left/right states, fuel consumption, sampled extrema and work counters. No inventories, rendering objects or display-derived restart states. |
| **Controls** | Prescribed finite arcs use existing steering and actual RK-stage mass; coast is an empty arc schedule. Recovery uses the existing feedback law. Each RK interval retains its selected control/configuration through its endpoint. |
| **Canonical schedule** | Fixed grid origin; insert exact arc starts/ends, steering keys, cap transitions and mission boundaries without shifting the grid. Queries never add checkpoints. Reject fuel exhaustion; never clamp negative fuel into a successful flight. |
| **Termination** | Ascent/insertion/deorbit stop at authored epochs with solid-body clearance enforced. Recovery stops at the first certified descending water-shell crossing and records the existing dissipative impulse and recovered pose. |
| **Presentation** | Three lifetime lanes; phase-scoped aero/control metadata; per-actor recovery results; exact boundaries for mass, fuel, ownership and constraint changes. Analytical sampling during pad support, station dwell and recovered motion. |

The mission’s event rules should be explicit:

- **Launch:** derive the pad’s corotating state. Require positive outward radial-distance acceleration with margin, including gravity, aerodynamic force and the tangential-velocity contribution. Release support and start thrust atomically; add no departure impulse.
- **Separation:** close parent thrust, retain its exact state, retire the assembly, and create both children with identical position/velocity. Upper fuel remains unchanged; booster fuel is the actual remainder. Prove wet-mass and momentum conservation.
- **Capture/service:** end insertion thrust before paid capture. During finite unloading, cargo stays aboard until completion. Completion transfers cargo once and rebuilds the courier’s mass context.
- **Departure/return:** release at the analytical station’s exact state with actual remaining fuel and cargo. Start deorbit without an impulse. Enter recovery from its retained endpoint; preserve mission-wide consumption totals.
- **Simultaneous events:** process completion before release and new thrust. Group each epoch into one transaction with one before/after boundary. Reject conflicting operations.

The proposed local-clock recovery adapter is physically valid under the stated fixed-body, constant-spin restrictions: source inspection and an offset probe confirmed force-law autonomy and recovered-pose equivalence. **Absolute epochs in the shared core are simpler**, because they remove the need to remap contact, pose, samples, phase thresholds and ledger epochs separately. Keep station and rotating-frame evaluation on absolute time either way.

For a concrete initial budget, I recommend **16 mission units; 40,000 physical nodes as the target and 65,536 as the aggregate hard ceiling; 40,000 drawing samples; 12,000,000 serialized bytes**. Retain depth 20 and 48 root iterations per contact. Set aggregate preparation ceilings of 524,288 trial intervals and 2,097,152 checked propagation evaluations, including rejected attempts, roots and display resampling. These are proposed admission limits, not demonstrated capacity. Keep existing domain limits unchanged. Offline search needs a separate finite evaluation budget and must not run during scene preparation.

Acceptance should require the complete independent DOP853 branch tree from its own original parent state, split and post-service masses; three production grids; tightened-oracle agreement; paid-capture margins; refined pressure/load/heating observations; conservation at every event; and deterministic query order/clone/rewind behavior. Check drawing error at maximum supported zoom—`2048` samples per unit is a starting density, not an accuracy guarantee. Browser checks must exercise both recoveries and the courier’s transitions through ascent, docking, unloading and return.

**No new human architecture decision is needed.** Numerical feasibility belongs to the implementation loop; choreography remains the human viewing gate. If the bounded witness fails, report the specific fuel, targeting, recovery or budget shortfall before changing the mission’s scope.
