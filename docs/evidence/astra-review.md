Model identifier: not available to me; reasoning effort: not available to me.

Proceed with TypeScript and bounded RK4, but make the next milestone **one understandable, objective-driven maneuver edit with explicit failure behavior**. A prepared moon encounter is a promising test fixture; it is not yet evidence that this should be the player’s first interaction. The highest-leverage decision is what the player must understand and deliberately accomplish.

I read the brief first, then the charter, plan, environment/ecosystem notes, numerical sources and reports. As concurrent work appeared, I also read the finalized numerics note and updated viewer, and inspected its retained screenshot. I used read-only, in-memory calculations; I modified no files and launched no agents.

**What is verified**

- The prescribed barycentric binary and inverse-square ship dynamics match the stated model. I regenerated all 601 retained samples for both trajectories and reproduced them exactly.
- I independently reran the existing Python oracle’s tightened DOP853 solves. Maximum position differences were **2.47×10⁻¹⁰ baseline** and **2.37×10⁻⁹ edited**, matching the report. This supports RK4 for those trajectories. [Oracle implementation](/home/s/code/orbital-logistics/spikes/numerics/oracle.py:35)
- The edited local minimum is approximately **0.09287335457 at t=2.506473629**. The TS sampled minimum’s epoch differs by **0.000473629**, despite tiny propagation error. Event/readout accuracy already needs separate treatment.
- Installed npm package versions match the brief. The current application is a retained-sample viewer with sample-time frame transforms, not an executable editor. Browser/build success remains reported evidence; I did not independently rerun those workflows.
- Collision termination, resumable execution, fuel accounting, human comprehension and input-to-paint latency remain unverified or unimplemented.

**1. Highest leverage: give the first edit a visible purpose and a bounded meaning.**

“An intentionally altered pass is visually distinguishable” is too weak an acceptance criterion. It can pass when dragging produces an impressive curve but the player cannot predict whether the change helps. Conversely, requiring an explanation of multi-body orbital mechanics would reject an otherwise usable tool.

The right question is: **Can the player form a local intention, see whether an edit moves toward it, and reverse or improve that edit?**

A prepared encounter removes the difficult task of finding an encounter from scratch. It also combines moving references, timing, nonlinear sensitivity and unfamiliar burn axes. Thus I recommend it conditionally, with a narrow objective and a close-up view. Keep the existing two-body calibration fixture available as a diagnostic fallback if the encounter proves confusing; do not build a second tutorial campaign now.

The retained screenshot reinforces this: the full trajectories visibly diverge, but the actual closest-pass distinction occupies a small, crowded region. The distant endpoint difference of 1.44 units does not establish that encounter altitude is legible. [Viewer screenshot](/home/s/code/orbital-logistics/docs/evidence/viewer.png)

My concrete specification for the next interaction is:

1. **Objective.** Use the existing fixture over `[0,6]`. Ask the player to put the selected moon pass inside a visible **center-distance band `[0.09,0.10]`**, during `[2.4,2.6]`, with one burn. Label the equivalent surface altitude `[0.065,0.075]`; never interchange altitude and center distance. The retained edited trajectory supplies a verified feasible example. This is an encounter-editing exercise, not a delivery or docking success.

2. **First manipulation.** Initially pin the maneuver at `t=1.137`, expose radial/transverse handles in a named moon-relative basis, and keep numeric entry secondary. This isolates steering from epoch selection. The existing inertial impulse corresponds approximately to radial `+0.00043722`, transverse `−0.01802245` at that epoch, providing a regression seed. After this interaction works, unlock path placement and epoch editing in the same scene.

3. **Visual contract.** Show an overview and a moon close-up with the target band, baseline, draft, burn marker and direction of travel. Freeze camera scale during dragging; do not recompute a fit that makes the handle move beneath the pointer. Keep all body/ship ghosts synchronized to the same scrub epoch. Comparing each trajectory at its own periapsis is a separate, explicitly labeled comparison.

4. **Encounter identity.** Define this encounter by named body, periapsis kind and the authored window `[2.4,2.6]`. Require exactly one qualified smooth-coast minimum in that window. Zero candidates means “selected encounter missing”; multiple candidates means “ambiguous.” Never silently select the nearest or first remaining event.

   Crucially, **the numerical root bracket is not the encounter’s durable identity**. It changes when a legitimate edit shifts the event. Preserve semantic selection/provenance; regenerate numerical brackets per revision. A sign jump caused by an impulse is not a smooth apsis, and a nearly circular coast must not manufacture events from numerical noise.

5. **Draft and execution.** Every result identifies its program revision, validity and completed horizon. Pending/stale trajectories cannot satisfy the objective or supply execution results. On acceptance, execute the exact validated program from the fixed scenario start. Frame switches change presentation only. A failed required burn stops the forecast and leaves the pre-burn state and ledger unchanged.

6. **Numerical boundary.** The implementer chooses and validates an editable component range that includes zero and the regression seed. Every forecast also needs collision/near-body safeguards; a parameter sweep alone is not a certificate. Distinguish collision, unsupported close approach, missing encounter and insufficient fuel. Stop the displayed valid path at the first blocking condition.

7. **Human acceptance.** The player moves the pass into the band, undoes it, deliberately moves it the other way, and explains the local effect in their own terms. Then change the target band and let them revise without a supplied numeric solution. Save before/after programs and compare prediction with execution. A short human check here should precede full queue polish; the full M1 gate still precedes targeting.

This adds a meaningful objective without introducing inventories, ports or synchronization. It tests the editor hypothesis while honestly leaving the logistics hypothesis open.

**2. RK4 is supported for the retained paths; the editable domain is the unresolved numerical decision.**

The convergence and oracle evidence are good. They justify continuing, not replacing the integrator preemptively.

However, “bounded fixture” must bound the player’s accessible edits, not merely the baseline state and horizon. In an in-memory probe, multiplying the example impulse by five produced a sampled moon-center distance of **0.01276**, inside the **0.025** surface. The spike continued through it. At four times the impulse, the sampled clearance was only about **0.00157**, and the endpoint state difference between `h` and `h/2` had grown to roughly **4.7×10⁻⁶**. These are stress probes, not certified trajectories; they demonstrate why two successful examples cannot validate unrestricted handles. [Integrator](/home/s/code/orbital-logistics/spikes/numerics/model.ts:17)

Prioritize the following failures over further clean-orbit precision:

- A moving surface entered and exited within one step.
- An RK stage entering an invalid near-body region before an endpoint test catches it.
- Grazing contact or a nearly degenerate apsis without a clean sign change.
- An impulse coinciding with a surface event or changing the sign of radial velocity.
- A minimum outside the horizon being reported as a completed closest approach.

A conservative unsupported-region stop is acceptable for this milestone. Continuing through a singular or unresolved passage is not. Event root-finding alone is insufficient: SciPy itself documents that multiple crossings within one step can be missed. [SciPy event documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html)

Keep the physical-resolution and pixel-error criteria, but add **event-time, relative-velocity and classification stability** criteria. The measured discrepancy between sampled and refined periapsis demonstrates why position error alone cannot establish inspector accuracy.

One smaller calibration gap: the hyperbolic analytic check starts at periapsis and travels outward. It does not yet test the charter’s complete inbound–periapsis–outbound deflection. [Calibration fixtures](/home/s/code/orbital-logistics/spikes/numerics/run.ts:16)

**3. Canonical continuation needs a precise endpoint contract, not more architecture.**

The latest implementation explicitly inserts the requested horizon as a terminal node and rejects out-of-range queries. For a fixed horizon, this is reasonable. Its comment correctly warns against continuing from an arbitrary partial endpoint. [Canonical runner spike](/home/s/code/orbital-logistics/spikes/numerics/model.ts:40)

I checked the trap directly: with `h=0.25`, stopping a circular trajectory at `0.6` and then resuming from that state to `0.75` differs from uninterrupted canonical propagation by approximately **1.05×10⁻⁵** in combined state norm. Querying `0.6` from either full trajectory agrees exactly. The problem is promoting a query endpoint into an integration origin.

Make the distinction explicit:

- Grid boundaries and physical event boundaries are resumable checkpoints.
- Arbitrary horizon/readout states are disposable endpoint results.
- Extending a horizon resumes from the preceding genuine checkpoint.
- If the horizon coincides with a real burn, preserve that event boundary and its executed cursor.
- Snapshots preserve the integration origin/grid index, physical event cursor and relevant discrete state—not just the displayed epoch/state.

The existing “queries leave nodes unchanged” check proves query nonmutation. It does not prove partitioned execution, snapshot/reload or horizon-extension invariance. Test those behaviors directly before claiming M0b.

For the first queue, rejecting duplicate burn epochs is simpler than designing elaborate tie semantics. Surface termination should take precedence over a coincident burn. Apsis snapping should resolve an explicit epoch from a specified trajectory revision; after an upstream edit, show that the saved epoch no longer coincides with the selected apsis and offer explicit re-snap. Do not silently retarget it or let the snapped burn define its own triggering event.

**4. Keep TS/Python, but narrow the justification.**

“Fastest” is unverified. The stronger argument is that this checkout already has a working browser toolchain, a small force law, retained fixtures and an independent oracle. Switching now needs a demonstrated benefit.

The ecosystem note understates two alternatives:

- Python desktop does not inherently require a later port if native delivery is acceptable. The browser preference should contribute positively to the choice, rather than making porting an assumed penalty.
- Domain libraries offer more than neighboring patched-conic solutions. PyKEP exposes adaptive CR3BP propagation and variational equations, directly relevant to this fixture after matching coordinate conventions. That could reduce later sensitivity/targeting work. [PyKEP propagation documentation](https://esa.github.io/pykep/propagation.html)

Nevertheless, neither supplies this editor’s interaction or discrete semantics. Keep the current stack. Treat Python as a required independent check for this multi-body milestone, not an optional confidence extra. Reconsider runtime propagation technology if maintaining accurate, responsive user-edited encounters becomes the dominant implementation burden.

Canonical stepping also does **not** require fixed stepping: adaptive internal steps can remain independent of display queries. Preserve that option without building a generic solver framework.

**5. Workers and targeting are lower-leverage decisions.**

The roughly 13 ms Node propagation measurement excludes event localization, diagnostics, drawing and input handling. It neither proves main-thread responsiveness nor warrants a large optimization task.

Keep M0 synchronous. At the first drag interaction, measure input-to-paint and use the already tested worker boundary if propagation competes with feedback. Start with one accurate bounded forecast and real cancellation; add approximate previews only if measured latency requires them. A revision check prevents stale acceptance but does not stop obsolete computation.

For M2, “permitted encounter branch” remains under-specified. Begin after the human gate with a short, collision-free two-body rendezvous, fixed departure/arrival epochs and a bounded correction around a player seed. Define branch constraints concretely—such as angular direction, permitted revolution count and clearance—and require every finite-difference trial and accepted update to satisfy them. Reject ill-conditioned or infeasible local solves; charge the arrival match before presenting success. Do not make preservation of arbitrary lunar encounter topology the first solver assignment.

The disposition I recommend is:

| Rank | Decision | Recommendation | Owner |
|---|---|---|---|
| 1 | First interaction | Prepared pass with a visible target band; early one-burn human check | Human judges comprehension/appeal; implementer builds it |
| 2 | RK4 sufficiency | Accept for retained paths; validate edit range and termination before unrestricted editing | Implementer |
| 3 | Temporal/event contract | Distinguish disposable endpoints, checkpoints and semantic encounter identity | Implementer |
| 4 | Runtime stack | Keep TS/Canvas/DOM and Python oracle; withdraw the unmeasured “fastest” claim | Implementer within delivery preference |
| 5 | Worker strategy | Measure during first drag; use bounded accurate jobs and real cancellation | Implementer |
| 6 | M2 targeting | Defer; start with a tightly defined two-body local solve | Implementer after human gate |

The next assignment should deliver the collision-safe canonical runner and the single-burn target-band interaction above, with replayable before/after programs, refined encounter diagnostics and measured latency. Bring the user the playable result to judge. Integrator policy, event ordering, worker scheduling and tolerances are implementation calls; whether the encounter is understandable and worth manipulating is the human decision.