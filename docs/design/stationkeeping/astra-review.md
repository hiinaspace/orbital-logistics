I recommend the **finite maintained-depot exhibit**, using a private canonical Runner and an immutable program compiled from bounded feedback checks. Empty-depot correction windows are a useful first constraint. The proposal needs firmer stock-mass semantics and a precise maintenance objective before implementation.

**Verified:** the checkout is `natto`, branch `codex/model-set-viewer`, base `8b3f6be`. I inspected the simulation, port admission, finite-set preparation and continuous-traffic ownership. The targeted lunar-port, propulsion, steering and model-set tests completed successfully. **Unverified:** I did not rerun the full browser suite or independent numerical oracles. **Unknown:** whether the proposed perturbation, correction family and visitor timing produce a useful scene within the intended budget; there is no maintained-target witness yet. Camera changes appeared concurrently and were left untouched.

The architectural risks, in priority order, are:

1. **Incomplete mass ownership.** Empty-berth windows eliminate thrust carrying unaccounted visiting ships, but do not eliminate unaccounted depot stocks. Existing port inventories are bookkeeping quantities; only the executing ship’s dry mass, cargo and fuel enter its propulsion law. Calling exchange buffers “external storage” does not establish what moves that storage alongside a maneuvering depot. This is the principal qualification to the brief’s claim that the restriction keeps physical mass honest. [Mass and service implementation](/home/s/code/orbital-logistics/src/sim/runner.ts:143)

2. **An underspecified controller objective.** “Compare actual state to nominal orbit” can mean preserving orbital geometry or pursuing a particular time-dependent position. Those generate different corrections and fuel costs. A successful terminal intercept alone would be weak stationkeeping evidence; the exhibit must maintain a declared envelope across its horizon, including visitor occupancy.

3. **Target identity and validity leaking across consumers.** Capture, attachment, display, forecasts and saved programs must refer to one physical trajectory revision. This is especially important because `Runner.sample()` returns the terminal state when queried beyond an early failure. A provider that ignores its returned epoch could accidentally present that state as a valid later target. [Sampling contract](/home/s/code/orbital-logistics/src/sim/runner.ts:298)

4. **Hidden multiplication of work and incomplete station presentation.** The existing constructor rebuilds every ballistic provider for each visitor. Meanwhile, station drawing samples contain only epoch and state, without station fuel, thrust or events. Per-provider node limits therefore neither bound aggregate preparation work nor supply the required maintenance inspection. [Provider construction](/home/s/code/orbital-logistics/src/sim/runner.ts:50), [finite preparation](/home/s/code/orbital-logistics/src/model-set/model.ts:89)

The highest-leverage decision is whether the station trajectory can remain independent of its visitors. **For this slice, deliberately preserve that independence.**

Use one powered station descriptor containing initial six-state, dry mass, maintenance propellant/capacity, exhaust velocity, engine limits, frozen finite-thrust program, integration policy, clearance and validity interval. Construct its child scenario from the enclosing world; accept no nested arbitrary bundle, logistics, rendezvous target or recursive port reference. Its private Runner supplies capture, dwell and undock states. Render and inspect that provider directly, without creating a second simulated vessel representing the same station.

This follows the existing ballistic implementation closely: it already strips logistics, substitutes the target state, enlarges exclusion radii and propagates the complete interval before admission. Powered motion can reuse the existing anchored mass law and event processing. [Existing admission](/home/s/code/orbital-logistics/src/sim/runner.ts:42), [propulsion law](/home/s/code/orbital-logistics/src/sim/propulsion.ts:6)

Use a new, narrow logistics domain admitting powered and ballistic ports in the same prescribed field. This needs explicit design: current `ballistic-ports-v2` requires **every** port to be ballistic, while the other domains require one fixed primary. A ballistic departure port avoids introducing an unmaintained circular rail into the perturbed field. Preserve the existing domains unchanged. [Domain restrictions](/home/s/code/orbital-logistics/src/sim/schema.ts:172)

For mass accounting, my recommended first witness has **no cargo or fuel exchange at the maintained station**. Fixed onboard stock may count as inert ballast; maintenance fuel decreases through its own engine only. The visitor can arrive carrying freight, dwell, and depart. That establishes maintained-target rendezvous without pretending to establish a physically complete freight depot.

If unloading/refueling is essential to the first scene, explicitly count co-moving stocks and introduce authoritative mass-change events before proceeding. That is a larger scope, but does not inherently require one monolithic world integrator. A scene-level event owner coordinating separate propagators remains an option. Shared ownership and shared numerical integration are separate decisions.

Define reserved maintenance intervals as half-open `[start, end)`:

- Reject any overlap with attachment, including a dwell continuing through the scene’s end.
- Reject capture at a maintenance start or strictly inside an arc.
- Permit capture at its end only if another maintenance arc does not start there.
- Permit undock at maintenance start after any coincident service completion, with release preceding station thrust.

Check these rules during admission and defend them at execution boundaries. For finite multi-ship extensions, also check aggregate occupancy; individual Runners cannot infer the fleet. Require a correction after the visitor departs, so the exhibit demonstrates that the restriction supports repeated maintenance rather than hiding all burns before attachment.

For the controller, define the nominal inclined orbit independently of the perturbed trajectory. My default is an **orbit-maintenance envelope allowing phase drift**: compare position and velocity against the nominal orbit at matched orbital phase, with separately scaled tolerances. Exact phase locking should be an explicit scope choice; the visitor already targets the actual station and does not require it to follow a nominal clock.

Compile corrections at fixed, canonical-grid check epochs. At each check, use the accepted physical prefix and remaining fuel; skip inside the deadband, otherwise solve within one bounded finite-burn family. Require improvement at a declared evaluation epoch and compliance with the envelope between checks. Freeze accepted arcs, check outcomes, before/after errors, evaluation counts and failures. No controller invocation belongs in playback, camera evaluation or sampling.

The resulting program demonstrates state-dependent authoring. It does not establish runtime adaptation. Perturbed initial conditions must regenerate different corrections, or a bounded failure, to distinguish the policy from prerecorded choreography.

Once frozen, the station trajectory is an unconditional input to the visitor solve. Include its complete physical definition in the visitor’s planning identity; changing station state, mass, field, policy or burns invalidates that arrival solution. The existing rotated continuous templates cannot simply be reused against this nonperiodic target: their admission explicitly assumes analytical rails and tightly constrained hardware. [Continuous domain](/home/s/code/orbital-logistics/src/traffic/planner.ts:16)

Provider admission should require successful completion through the full closed validity interval `[epoch, validUntil]`, completed scheduled arcs and declared fuel reserve. Every physical query must return the requested epoch and valid state. No extrapolation or nominal fallback is permitted.

Separate three failure meanings:

- **Authoring failure:** preserve the accepted prefix and diagnostic report; publish no successful candidate.
- **Maintenance-objective failure:** the station may remain physically safe while leaving its permitted envelope. Report that distinction.
- **Physical execution failure:** retain the paid prefix through depletion, unsafe approach or work exhaustion; the finite scene fails admission before public inventory effects.

A missing correction does not imply collision or orbital decay. A diagnostic continuation can propagate the actual accepted controls, or coast, while safe. It must be a separately constructed continuation, not fabricated samples beyond a terminal Runner state.

Versioning must protect the physical semantics. I verified with a short in-memory probe that unknown maintenance data attached to an existing rail is silently discarded, whereas an unknown logistics domain rejects. Therefore a new domain discriminator is mandatory, and the new reader should reject powered-only fields under legacy tags. Preserve program 3/4 distinctions for fixed/steered arcs. Reusing the existing dynamics does not itself require a physics-version bump. Snapshot v3 can remain if restoration continues to reconstruct providers and validate by deterministic replay; any added authoritative controller state would require a new contract. [Replay validation](/home/s/code/orbital-logistics/src/sim/runner.ts:335)

I would use these bounded acceptance gates, in order:

1. **Controller witness.** Start with one powered station, one visitor and at most one ballistic origin. An initial authoring budget could be eight check epochs, two arcs per correction and 64 candidate propagation evaluations per check. Require at least two accepted corrections and one deadband skip. Compare against identical initial conditions and gravity with maintenance disabled. Declare the maintenance envelope and fuel budget before tuning; exhaustion produces a report, not an expanding search.

2. **Independent physical admission.** Replay the identical frozen station and visitor programs at `h`, `h/2`, `h/4` and with independent DOP853. Do not re-optimize at each resolution. Check station fuel, correction outcomes, event classifications and complete-interval clearance. At visitor arrival, require event-left position and velocity residuals, each including independent numerical allowance, below `1e-7` and the configured capture tolerances. Pay residual capture fuel. Show that substituting the nominal or unmaintained target breaks the arrival gate.

3. **Ownership and endpoint witnesses.** Exercise capture at both maintenance endpoints, interior capture, dwell crossing a burn, undock at burn start and attachment through the final horizon. Verify atomic rejection, maintenance/exchange tank separation, dwell co-location and undock continuity. Include a retained visitor followed by a later correction as a negative case.

4. **Failure, compatibility and replay.** Cover insufficient fuel, mid-arc depletion, unsafe targets, exhausted node/solver budgets, malformed programs, expired validity and incompatible provider revisions. Require identical committed states, events and fuel under reordered queries, rewind and save/reload. Test old-reader rejection of the new domain and unchanged execution of existing fixtures.

5. **Bounded presentation and human review.** Retain station display samples once, with its fuel/thrust/events and exact boundaries; include steering keys and cap transitions in sampling. Add aggregate preparation, serialized-size and display-memory limits alongside per-Runner limits. Demonstrate actual versus unmaintained motion in a useful rotating view, with numerical/display error below the visible difference. The human gate is whether the maintenance and visitor choreography are legible and worth watching.

The genuine human choices are phase locking versus orbital maintenance, whether freight exchange belongs in this first exhibit, and the desired visual prominence of corrections. My recommendations are phase freedom, arrival/dwell/departure first, and visible but restrained maintenance. Provider ownership, endpoint ordering, version rejection and numerical gates are engineering decisions.

The camera proposal introduces no necessary stationkeeping conflict: it can consume disposable presentation states while physical targets remain canonical. Its feel remains a separate viewing gate.

No files were modified, and no agents, reviewers, paid processes or optimizers were launched.
