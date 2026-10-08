---
tags: [charter, games, simulation]
project: "[[orbital-logistics]]"
created: 2026-10-06
updated: 2026-10-06
---

# Orbital Logistics — initial charter and local Codex brief

> Superseded product direction: the user accepted an orbital model-set viewer on
> 2026-10-08. Read [current direction](model-set.md) and [tactical plan](plan.md).

> Historical charter snapshot copied on 2026-10-06 from
> `/home/s/org/projects/orbital-logistics/charter.md`. Current repository state,
> decisions and evidence are in `README.md`, `docs/plan.md` and `docs/evidence/`.

[Project state, next action, and pickup](../orbital-logistics.md)

Prepared from the ChatGPT conversation on 2026-10-06. Working title only. This is a design and implementation proposal, not a claim that a repository, prototype, solver, benchmark, or playtest exists. The current request authorizes these vault documents; a subsequent local Codex assignment should establish its actual checkout and scope. Numerical tolerances, performance budgets, scenario parameters, and task boundaries below are proposed engineering choices unless explicitly marked otherwise.

## 1. Product hypothesis

**A Zachtronics-like logistics puzzle game in which ballistic trajectories are the moving parts of the machine.** Fixed scenarios supply bodies, ports, equipment, inventories, recipes, and delivery requirements. Players author maneuvers and schedules, synchronize ships and cargo operations, run the system at an appropriate playback speed, inspect failures, and improve their solution along independent cost axes.

The target experience is: notice a useful orbital opportunity; construct a route around it; arrange the handoffs and return journey; then watch the complete transport machine execute. The choreography should be worth watching and sharing even after the numerical objective is satisfied.

Three hypotheses govern development:

1. A spatial trajectory editor with frame selection, scrubbing, burn handles, and limited targeting assistance makes orbital reasoning expressive rather than numerically tedious.
2. Cargo, reusable vehicles, and synchronization turn a good individual trajectory into an interesting logistics machine without requiring a general programming language.
3. Different valid solutions yield meaningful time, propellant, and hardware tradeoffs, and produce visually distinctive executions.

Correct integration is not evidence that these hypotheses hold. The first gate is a hands-on maneuver-editing experience; the first product gate is a complete finite-batch puzzle with understandable alternative solutions.

## 2. Direction and boundaries

### User decisions to preserve

- Browser-first, single-player, mouse/keyboard, 2D/in-plane. A future 3D/VR version is contingent on the 2D game working.
- Miniature-solar-system aesthetics with visible ballistic arcs and gravity assists. Do not substitute straight routes with hidden travel-time modifiers as the primary navigation model.
- Fixed logistics objectives, rather than an open-ended strategic economy: for example, deliver electronics between ports or move raw material to a processing station.
- Pause, scrubbing, restart, and adjustable playback speed are allowed. The earlier real-time/no-warp requirement is deliberately relaxed.
- Numerically integrate spacecraft under multiple gravity sources. Prescribed planetary/moon motion is acceptable; ship trajectories should still be caused by the simulated forces and burns.
- Use the user's Children of a Dead Earth experience as the main authoring reference: selected-object predictions, explicit reference frames, future-body preview, directional burn handles, event snaps, local matching assistance, and an executable maneuver queue.
- Add explicit pickup/dropoff/transfer and synchronization. Preserve the player's responsibility for the larger route and the helper's responsibility for precise local targeting.
- Distinguish finite completion, terminal-state constraints, and sustained throughput. Do not reward unacknowledged depletion/reset tricks.
- Equipment progression should introduce propulsion, cost, capacity, and operating-environment tradeoffs, not merely a strictly better engine at each tier.
- Exportable solution animations/replays are part of the product appeal, not just debugging output.

### Proposed implementation defaults

Use a small static web application: TypeScript, Canvas 2D for the orbital viewport, and ordinary DOM controls for panels/timeline. Vite is a candidate build tool, not a required engine. Keep the numerical core independent of rendering, the browser DOM, and the authoring interface. Longer prediction/targeting jobs can run in a worker; start with the simplest arrangement that makes the first interaction responsive. See the official [Vite guide](https://vite.dev/guide/) and [Web Workers documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

Choose versions and a test runner against the actual checkout; retain a lockfile and exact run commands. Do not assume a local Node version, package manager, browser, host, or existing repository from another project. No runtime Python, server, LLM, native build, GPU compute, or user account should be necessary to play the first scene.

### Explicitly outside the first greybox

Full solar-system generation; live planet–planet N-body integration; spacecraft gravitational backreaction; a full Lambert/multiple-gravity-assist optimizer; the Interplanetary Transport Network as a complete mechanic; arbitrary scripting; fleets of hundreds of ships; procedural economies; multiplayer; a Factorio mod; cockpit flight; combat; atmospheric physics; full engine design; deformable construction; VR; production art; and global leaderboards.

Preserve the tour-company/story and Factorio-adapter ideas as later applications of a useful core, not parallel deliverables. Do not build generic 3D or cross-engine abstractions merely to prepare for a possible extension.

## 3. Player loop and authoring contract

The basic loop is **inspect → compose → target → run → diagnose → revise → share**.

A scenario presents an intelligible objective, available components, initial state, and explicit scoring rules. The player inspects future body positions, places maneuvers, tests encounters, arranges cargo operations, and executes the saved solution from a reproducible start. They can accelerate quiet coasts and slow down encounters without changing the physical model.

### Spatial editor: the first playable feature

The user's detailed Children of a Dead Earth description is firsthand design input. It is not a requirement to copy that game's visual design or all its features. Adapt the interaction as follows:

- Select a ship or station and select the visualization frame independently. Support an inertial overview and a nonrotating frame centered on another body or ship first. Add a planet–moon rotating frame when the encounter fixture benefits.
- Display a prediction horizon in simulation time, not a hardcoded number of real-world days. Show all relevant bodies at the scrubbed epoch. Past state, live execution time, and hypothetical future preview must be visibly distinct.
- Click a predicted path to create a maneuver at the corresponding time. Drag radial/tangential handles, edit signed numeric values, change the epoch, and see both the altered trajectory and incremental/total Δv. Undo/redo and maneuver deletion matter early.
- Snap a node to a selected periapsis/apoapsis event relative to a named body. Show which occurrence was selected; a future branch must not silently become a different encounter after an edit.
- Show baseline and edited paths together, with a close-approach inspector and clear unresolved/truncated predictions. Display the last complete prediction while a replacement is being computed, marked as stale rather than presented as current.
- Execute the maneuver queue automatically and compare its observed path with the prediction. Save and reload the scenario/program.

**Frame correctness is part of usability.** Transform each trajectory sample using the reference object's state at that same sample time, not its current position. Changing a view frame must not change the physical solution. A rotating-frame velocity display needs the rotation-rate term; subtraction of origin velocity alone is not enough.

**Name burn axes accurately.** A radial/transverse basis is not identical to radial/velocity-aligned controls on an eccentric trajectory. Start with a documented orthogonal in-plane basis; a separate prograde/retrograde mode can follow. Store the reference object and basis semantics in the maneuver. Decide explicitly whether its vector is frozen inertially or recomputed in that basis at execution; never let changing the viewing frame change the burn. Off-plane control does not exist in the 2D greybox.

### Assistance: precise execution of a player-selected idea

Offer two distinct outcomes:

- **Orbit matching:** adjust the local orbital state toward the target's, without claiming that merely similar or intersecting orbits imply docking. In multi-body fields, any osculating-element comparison is local/instantaneous, not a guarantee of identical long-term paths.
- **Rendezvous:** reach the target at the same time with acceptable relative position and velocity, including the cost of the arrival adjustment.

Implement rendezvous targeting first if that is the simpler complete feature. Never offer a success indicator solely because two path lines intersect on screen.

The player chooses the target, encounter branch, rough time interval, and editable maneuver(s). A local numerical helper may adjust those variables inside stated limits. A proposed first implementation is bounded shooting with finite-difference sensitivities and damped least-squares updates; the actual method can change if tested. It must not silently add a new assist, choose another planet, select a different number of revolutions, or redesign the whole itinerary.

Expose permitted time changes, resulting burns, arrival error, and Δv/propellant cost. A failed or cancelled solve leaves the previous plan intact. The proposal becomes authoritative only when accepted and validated through the same forward simulation as execution. Define iteration/work limits and clear failures rather than blocking the UI indefinitely.

**Edit-time targeting and runtime correction are separate mechanics.** Saved burns do not gain invisible autopilot accuracy. A later reusable policy may allocate a correction budget; those corrections become logged, fuel-consuming events and can fail.

### Debugger requirements

An encounter inspector should distinguish wrong place, wrong time, and wrong velocity. Show closest-approach epoch, miss distance, relative velocity, fuel available, correction required, and the first blocking condition. Clicking a failure jumps to the relevant event and identifies the upstream maneuver or dependency.

The desired difficulty is composing a good physical plan, not entering extra decimal places or guessing why the simulator stopped.

## 4. Maneuver queues, synchronization, and cargo operations

Begin with a chronological maneuver list. Add a small event language only when the first delivery puzzle needs it. The graphical program remains a queue/timeline with explicit dependencies, not a mandatory text editor or unrestricted bytecode.

| Operation | Meaning | Boundary to preserve |
|---|---|---|
| Burn at epoch / selected event | Apply a specified in-plane impulse in a named basis | Consume propellant; event identity and basis are explicit |
| Coast until event | Evolve physically until the armed event occurs | No stopping in space or pausing the rest of the world |
| Rendezvous / dock | Reach a compatible target and satisfy capture tolerances | Position and relative velocity both matter |
| Load / unload / transfer | Move a stated quantity between connected inventories | Capacity, ownership, docking, and duration are checked |
| Await readiness / named handoff | Wait for a condition relevant to this voyage | Waiting in flight continues the trajectory |
| Launch in phase window | Depart a prepared docked state during an allowed interval | Later feature; finite windows and missed-window policy are explicit |
| Repeat service | Execute a validated reusable recipe | Later feature; environment phase and replenishment are accounted for |

A first recipe can be: load at A; depart at an authored epoch; execute burn; dock at B; unload; return to A. A second ship introduces one named handoff and a requirement that transfer finishes before departure. This is enough to test synchronization before adding general sensors, branching, or circuit logic.

**Event semantics:** detect crossings rather than floating-point equality. Define direction, arming epoch, occurrence identity, and timeout. Mark missing events as missing, not infinite silent waits. Use a deterministic order for simultaneous events and reserve a single docking port or inventory transfer atomically. Completion signals should be scoped to a particular voyage so an old acknowledgement cannot trigger a new departure. Detect cyclic waits and zero-time repetition.

**Prediction semantics:** once ships exchange cargo or depend on one another, predict the joint program, not unrelated individual paths that assume every handoff succeeds. A blocked or unspecified future action should appear as blocked/conditional. Do not quietly draw a successful continuation after a failed transfer. Discrete logistics state belongs in simulation snapshots alongside positions and velocities.

**Docking contract:** prescribe a small capture radius and relative-speed tolerance in scenario units. Any residual velocity matching must be bounded and charged under the chosen capture/propulsion model; do not grant free substantial capture burns through snapping. A small attachment-position tolerance is an explicit interface approximation. Test sensitivity to tightening it. No pickup at arbitrary range, duplication during simultaneous transfers, negative inventories, or capacity-free storage.

## 5. Physical and numerical model

### Start with a small, explainable environment

M0 uses a fixed central body for calibration. M1 adds a prescribed circular planet–moon system, preferably expressed barycentrically so the fixture can represent a clean circular restricted three-body problem. A star and extra worlds are later level content, not prerequisites for a lunar assist.

In an inertial simulation frame, ships obey

\[
\ddot{\mathbf x}=\sum_i\mu_i\frac{\mathbf r_i(t)-\mathbf x}{\|\mathbf r_i(t)-\mathbf x\|^3}+\mathbf a_{\mathrm{thrust}}.
\]

Use prescribed source trajectories consistently. Nonrotating/rotating views are coordinate transformations, not alternate force models. Spacecraft and later free stations are gravitational test bodies but retain real accounting mass. Ignore their gravitational pull on one another; ordinary docking/transfer interactions remain explicit.

Planet/moon rails simplify long-term environmental motion; they do not require patched-conic ship paths. Two-body formulas, Lambert solutions, or patched-conic approximations may seed fixtures and targeter guesses, but the accepted path must be revalidated in the actual model.

Choose normalized internal units or consistently documented SI-like units. Record the length/time scales and gravitational parameters in each fixture. If a reference circular radius and period are chosen, derive the shared central parameter consistently rather than arbitrarily prescribing an incompatible period for each planet. Rendering scale, collision radii, and numerical units must not become interchangeable hidden constants. Display-only exaggeration of bodies must be labeled.

### Propulsion and mass

Start with instantaneous impulses. These are an explicit approximation that makes the authoring problem smaller. Track dry mass, propellant, cargo mass, tank capacity, and effective exhaust velocity. For an ideal impulse, a possible accounting model is

\[
m_{\mathrm{used}}=m_{\mathrm{before}}\left(1-e^{-\|\Delta\mathbf v\|/v_e}\right).
\]

Apply it sequentially using the actual mass before each burn, including current cargo. Reject an unaffordable burn; do not partially apply it without a defined policy. Replenishment debits a source inventory and appears in the score ledger. Total Δv remains a useful planning quantity but is not interchangeable with propellant use across different masses and engines.

Finite-duration burns belong in a later gate. Only then compare thrust-limited performance, long low-thrust arcs, power/mass tradeoffs, and atmosphere-dependent operation. An impulse-only prototype cannot substantiate those claims. Fix available equipment per puzzle; progression should expand the set of useful designs rather than erase earlier tradeoffs.

### One simulation contract for preview and execution

Start with a small transparent integrator, such as fixed-step RK4, plus event refinement and explicit impulse boundaries. This is a proposed greybox default, not a claim that it is ideal for all long-term orbit work. Choose the timestep through convergence tests and narrow the fixture if necessary. If close approaches or long horizons require an adaptive method, change the shared core and rerun the acceptance suite.

Use canonical integration/event ordering independent of render frames, browser scheduling, and playback multiplier. Time warp processes more simulation, not larger unvalidated physics steps. Seek by restoring a checkpoint and replaying forward; do not integrate dissipative docking, manufacturing, and transfers backward. Display interpolation and trail decimation must not change the authoritative integration sequence.

Store scenario, program, solver/model version, tolerances, seed when randomness is introduced, and relevant discrete state. Aim for repeatability in the same build/runtime first; do not promise bitwise cross-browser determinism. Numerical tolerances and platform comparisons must precede any competitive server verification scheme.

Collision with a body's specified surface terminates or follows an explicit landing rule. No singularity traversal, hidden gravity softening that changes ordinary flybys, infinite energy near the origin, or free teleport through a surface. Stationkeeping must not be a tax on numerical drift.

### Minimum numerical evidence

| Fixture/check | Required evidence |
|---|---|
| Circular and eccentric two-body orbit | Period/apsides and bounded state error against an independent analytic reference; timestep convergence; no-burn energy and angular-momentum checks |
| Isolated hyperbolic pass | Correct sense of deflection and converging inbound/outbound trajectory against a two-body reference |
| Planet–moon fixture | A visible, converged encounter under the actual multi-source field; use a Jacobi check only for a fixture that genuinely satisfies the circular restricted assumptions |
| Maneuver/event boundary | Exactly one impulse at the specified event, including when a large playback advance crosses it |
| Frames | Same physical state/burn outcome in different displays; sample-time reference transformation is correct |
| Preview versus execution | Arrival/miss/velocity discrepancies smaller than a stated fraction of capture tolerances; identical event and inventory results |
| Resources and docking | Mass/inventory ledger reconciles, rejected operations do not mutate state, and tightened capture tolerance does not expose free-fuel solutions |
| Save/replay and warp | Reload and several playback speeds reproduce outcomes within the documented contract |

Do not demand conservation of a ship's inertial energy in an arbitrary moving prescribed gravitational field: the sources can exchange energy with the ship. Use invariants only under the assumptions that make them valid. A self-consistent predictor and executor can share the same bug, so independent calibration and convergence evidence remain necessary.

## 6. Challenge and scoring contracts

### First mode: finite-batch completion

The level fixes its initial state, delivery quota, available equipment, and allowed operations. Score completion time, propellant consumed, and deployed hardware cost separately. Display cargo received, not merely cargo produced or carried near the destination.

A useful first constraint is returning a designated tug to a named port in a usable state after completing the quota. Make that condition visible from the start. Do not infer that every finite-batch level must recover every component; expendable designs are legitimate when the rules and hardware accounting allow them.

With a fixed quota, quota divided by completion time is only a restatement of time-to-completion. Do not present it as an independent throughput objective.

### Later mode: sustained service

Specify the evaluation horizon, startup interval if any, demand/supply rules, allowed buffers, output measurement interval, and endpoint requirements. Account for starting cargo, propellant, in-process material, abandoned ships, and remaining inventories. A solution that drains a preloaded depot is not evidence of sustainable production unless depletion is explicitly the challenge.

A finite-horizon test demonstrates service over that horizon, not eternal stability. For a claimed repeating cycle, compare the relevant physical and discrete state at the same environmental phase in the stated frame, modulo explicitly allowed changes such as cumulative deliveries and paid external supplies. Include a resource balance over the cycle. A repeating picture alone is insufficient.

Docking, refueling, and waiting can restore a reusable service's departure conditions; the entire free-flight universe need not repeat. Use event/phase-triggered recipes and paid correction where appropriate, not a requirement that every maneuver be an absolute timestamp repeated forever.

### Scoring policy

Maintain a scenario-versioned ledger for burns, delivered items, manufacturing, refueling, deployment, and losses. Make each axis inspectable. Avoid a premature universal weighted score: retain nondominated local alternatives so a fast costly route and a slow economical one both have a reason to exist.

Unexpected but valid solutions are desirable. Change rules for a demonstrated loophole in accounting or physics, not merely because the player found a better route than the author expected.

## 7. Stations, manufacturing, and equipment: gated extensions

The first source/sink ports may be prescribed fixtures. Label their kinematic/infinite-inertia approximation; they do not prove that the same orbit would be free or cheap for a player-built station. Keep finite cargo/propellant stocks even when motion is prescribed.

Later station modules should expose a specified orbit or state, mass, inventories, docking capacity, transfer rate, processing recipes, and an optional reference trajectory/controller with a real propellant budget. Choose whether construction is purchased in a declared starting orbit or must be physically delivered; do not silently switch between those models.

A station is useful through timing, replenishment, vehicle exchange, or processing—not because being halfway between worlds automatically makes matching velocities cheap. Cargo can arrive on one service and leave on another, changing the available logistics connections. Transfers between two mobile craft require compatible relative state and availability.

Prototype one simple recipe only after delivery and synchronization work. Manufacturing changes inventory and carried mass with explicit source, product, waste, and energy assumptions; the recipe cannot silently create propellant or duplicate matter. A moving processing station/cycler is an advanced candidate: manufacture during coast, exchange cargo on encounters, and pay required corrections. It is not needed for the first product gate.

When stations become freely integrated, model capture/undocking momentum consistently for the combined assembly or explicitly retain a constrained-port approximation. Unstable-orbit stationkeeping should respond to actual modeled perturbations or operating requirements. Do not invent a fuel fee merely because the orbit is labeled unstable.

Atmospheric operation and a substantial tech tree are separate future probes. Equipment choices should trade fuel efficiency, thrust, mass, cost, storage, and environment compatibility under a documented model.

## 8. Browser architecture and solution artifacts

Keep the architecture small but make these responsibilities separable:

| Layer | Responsibility |
|---|---|
| Simulation core | Units, ephemerides, gravity, integration, impulses, collisions, inventories, events, snapshots |
| Program/level data | Serializable initial state, maneuvers, dependencies, objective contract, component parameters |
| Prediction/targeting | Forward evaluation, local bounded solves, encounter diagnostics, cancellation/versioning |
| Editor/view | Frame transforms, scrubbing, path hit-testing, burn handles, queue, inspector, undo/redo |
| Scoring/replay | Ledgers, terminal checks, snapshots, saved solutions, presentation/export |

These are modules, not a requirement for separate packages or services. Use plain arrays/typed arrays when useful. A worker is a boundary for responsiveness, not a second inconsistent simulator. Tag jobs with the input/program version; discard stale responses, and do not let a prediction result overwrite live state.

Performance should be measured on the actual development machine. An initial interaction target is immediate handle feedback and a useful short-horizon refresh in roughly 100 ms; longer results may arrive progressively with a visible pending state. This is a provisional target, not a benchmark or promise. Keep cancellation responsive. First reduce needless recomputation or shorten the preview horizon, then consider a different integrator, WASM, or renderer if profiling justifies it.

**Replay is an early data product.** By M1, save scenario/program JSON and a repeatable run. By the finite-puzzle gate, support a clean viewing mode and a portable replay/export route. Start with JSON plus the local player or self-contained playback bundle; capture/encode GIF/video only after browser support and dependencies have been checked. Do not make encoding block gameplay validation.

The export should show the frame, playback scale, cost axes, and enough context to understand the choreography. Distinguish a verified operational cycle from a clip that restarts from the initial state. An attractive reset-loop is fine when labeled; do not present it as proof of steady production. Offline rendering should sample the same authoritative trajectory, not alter physics for smoother pictures.

Future 3D/VR can reuse conceptual separation and saved scenario intent, but will require revisiting controls, reference-frame legibility, and spatial maneuver design. Do not assume an automatic port or build that abstraction now.

## 9. Staged greybox plan and evidence gates

Advance by evidence, not by completing every item in the charter. Each milestone should leave a runnable scene and a durable source/artifact checkpoint. These are bounded assignments, not estimated delivery dates.

### M0 — executable numerical sketch

**Build:** inspect the actual checkout; create the smallest static browser shell and headless test route; add the central-body fixture, ship state, propagation, pause/advance/reset, and scenario serialization. Establish units, impulse semantics, canonical time advancement, and a small independent reference test.

**Evidence:** executable scene, documented commands, orbit/impulse/convergence results, scenario JSON, and actual dependency/host information. No empty framework or long architecture document in place of a moving body.

**Stop/repair:** if simple orbit or event tests fail, fix the shared core before adding UI complexity. Do not spend this gate on long-horizon stability research or planetary system generation.

### M1 — manual maneuver editor, no targeting solver

**Build:** select object/reference frame, predict and scrub future motion, insert/delete/edit a burn, radial/tangential handles, numeric Δv, baseline-versus-edit path, a named-body apsis snap, queue execution, undo/redo, and save/reload. Include a planet–moon fixture with at least one authored encounter; use bounded horizon/ship count.

**Evidence:** in the browser, make an intentional change to encounter altitude/timing, inspect it in two frames, and execute the queue. Retain before/after solution JSON, a short recording, measured preview latency, and prediction-versus-execution residuals. The known encounter fixture may be authored offline, but the displayed ship path must be numerically propagated.

**Human gate:** the user can explain what an edited burn changed and deliberately improve an encounter without a route optimizer. Stop for this review before M2. If not, revise frames, handles, feedback, or the fixture; do not conceal the problem behind more automation.

### M2 — bounded matching assistance

**Build:** encounter candidates, selected target/time interval, a constrained local shooting helper, an arrival-matching burn where appropriate, cost/error preview, accept/reject, and explicit failure states. Preserve the manually authored branch and prior plan.

**Evidence:** compare a rough approach, a better manually planned approach, and their accepted corrections; show a case where the better approach leaves less work for the helper. Include infeasible geometry, insufficient fuel, wrong phase, cancelled solve, collision, and stale-response tests. Do not claim every visually closer approach must be cheaper.

**Gate:** helper removes numerical aiming chores while the user's higher-level maneuver choice still materially changes time or fuel. If solver complexity explodes, narrow its adjustment variables or scenario before adopting global route search.

### M3 — first complete logistics puzzle

**Build:** finite source/sink inventories, cargo capacity/mass, loading/unloading durations, docking and port occupancy, delivery quota, a required return/end state, and time/propellant/hardware results. Then introduce a second ship with one named transfer dependency. Joint prediction must include the transfer and any blocked departure.

**Evidence:** one successful delivery/reuse program, a mistimed handoff with a useful diagnostic, and a repaired solution. Test double transfers, old acknowledgements, cargo/fuel depletion, terminal-state failure, and replay. Keep scenario size small enough to inspect every operation.

**Gate:** synchronization adds a comprehensible logistics decision instead of only bookkeeping. No general logic language or production chain yet.

### M4 — small puzzle set and product test

**Build:** a small authored sequence: basic reusable delivery; timing/phase adjustment; a gravity-assisted route; and a relay/depot alternative. Reuse fixtures rather than generating a universe. Add a clean solution-view/export path and local comparison of distinct valid solutions.

**Evidence:** retain at least two meaningfully different solutions for a suitable level, an explanation of their tradeoff, reproducible score calculations, and a short readable replay. Verify the assisted path in the actual multi-source model rather than labeling any curved route a gravity assist.

**Human product gate:** the user voluntarily revises a working solution for a reason other than fixing UI confusion, can explain the tradeoff, and finds the execution worth watching. Record friction and negative feedback, not just completion. Agent-authored solutions alone do not establish fun or learnability.

### M5 — reusable services and sustained output

**Build only after M4:** phase/event-based dispatch, repeatable recipes, bounded paid correction if needed, and one fixed-horizon service challenge. Define startup, resource supply, buffers, end-state checks, and operational-cycle claims.

**Evidence:** repeated runs under the stated contract; a transient-stockpile solution correctly distinguished from sustainable service; a missed-window failure and recovery; consistent throughput and resource ledgers. Test modest initial-state perturbations only as a declared robustness experiment, not hidden random difficulty.

**Gate:** service design introduces a new architectural choice. Retain finite-batch mode even if sustained operation proves awkward.

### M6 — stations, processing, and propulsion diversity

**Choose one branch at a time:** a player-placed integrated/maintained station; one moving processor/cycler; or finite-thrust engine tradeoffs. Each needs its own resource and numerical tests. Do not combine all three in one task.

**Gate:** the new component changes the useful logistics network or solution tradeoffs for a fixed objective. If it merely adds maintenance chores, revise or remove it. 3D/VR, atmosphere, large campaigns, and strategic/story shells remain subsequent proposals.

## 10. Local Codex workflow and first assignment

### Establish evidence before inheriting a project

Read the local/vault instructions and inspect any actual checkout before scaffolding. Record host, absolute directory, Git branch/HEAD/dirty state, runtime/package-manager versions, and available browser/testing tools. Preserve unrelated work. A suggested repository basename is `orbital-logistics`; no checkout currently follows from this charter.

Copy this charter into the real repository as `docs/charter.md`, with its capture date and a link/path back to the vault. Put concise execution invariants in repository `AGENTS.md`, and keep changing plans/evidence in `docs/plan.md` and `docs/evidence/`. The vault tracks status and pickup; the actual checkout is authoritative for code and test results. Official [Codex AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md) is the configuration reference; this brief does not prescribe a model, entitlement, or unverified CLI flag.

A minimal proposed layout is:

```text
AGENTS.md
README.md
docs/charter.md
docs/plan.md
docs/evidence/
src/sim/
src/planning/
src/view/
src/levels/
tests/
```

Define and document real scripts for local development, type checking, headless tests, browser checks, and a static production build. Names such as `dev`, `typecheck`, `test`, and `build` are suggestions to establish, not commands already verified in this project. Read installed-tool help rather than inventing launch flags. Do not assume access to chat attachments or another project's environment.

### Copyable first assignment: M0–M1 only

> Read the applicable AGENTS.md files, the project note, and docs/charter.md (or the supplied vault charter). Establish the actual local checkout, runtime, Git state, and usable browser/test tools; preserve unrelated changes. Implement only M0–M1 of Orbital Logistics: a small 2D browser scene with a renderer-independent gravitational simulation, independent two-body checks, a prescribed planet–moon encounter fixture, predictive trajectories, selectable reference frames, time scrub/pause/advance/reset, manual radial/tangential maneuver editing with Δv display and one apsis snap, an executable queue, and scenario/program save and replay. Prediction and execution must use the same model and event semantics; time warp must not loosen numerical accuracy. Retain one manually edited before/after encounter and test frame invariance, event execution, replay, fuel accounting for impulses, and timestep convergence. Choose the smallest web stack consistent with the actual environment and make the scene runnable early. Do not implement a rendezvous optimizer, general scripting, factories, station construction, a full solar system, remote deployment, or 3D/VR. Record actual commands, source checkpoint, checks performed and not performed, measured interaction latency, residual numerical errors, and a short browser recording. Stop at the M1 human editor gate, with the exact next pickup action.

### Subsequent assignments

Issue M2, M3, and later milestones separately, carrying forward the last accepted fixture and tests. Keep one primary agent responsible for the authoritative simulation/schema while it is changing. Independent tests, a bounded UI task, or a read-only review can be parallelized after interfaces stabilize; do not start with an orchestration system.

For every checkpoint record what was changed, what was actually run, how to reproduce the scene, which acceptance criteria passed/failed, unresolved numerical/UI assumptions, and the next smallest experiment. Source and solution JSON are primary artifacts; screenshots and model self-assessments are supporting evidence.

If an agent generates a reference solution, preserve its program and provenance. Use those solutions to test numerical feasibility, not to declare that a human-facing puzzle is solved as a design problem. Human editor review and alternative-solution discovery remain distinct evidence gates.

## 11. Level authoring, risks, and open decisions

**Authoring method:** begin with known useful encounters and work backward to level initial states and budgets. Verify the resulting trajectories and costs, then seek alternatives. The earlier chat's orbital-timetable optimization is conceptual background, not a validated N-body module or a license to repeat its numerical results. Any reused artifact must be retrieved, inspected, and tested in the new contract.

Offline tools can later sweep orbital parameters, phases, burn budgets, and demand to find levels with distinct route architectures. Keep that machinery outside the player-facing runtime. Preserve the designer's ability to explain why an assist, delay, relay, or larger tank helps. Exact real Solar System values and naturally minute-scale flight times are not mandatory now that playback speed is independent.

| Risk | Smallest useful response |
|---|---|
| Prediction or reference frames are confusing | Simplify the fixture and add synchronized encounter views before new mechanics |
| Numerical busywork dominates | Improve local handles, snaps, diagnostics, and bounded targeting; do not jump straight to route optimization |
| Solver chooses the game for the player | Lock route/encounter branch and editable variables; expose corrections and reject silent redesign |
| Physics accuracy makes browser editing slow | Profile; cache shared prefixes; reduce horizon; cancel stale jobs; revalidate before changing methods |
| Throughput appears only because of depletion | Explicit horizon, inventory ledger, start/end state, and replenishment cost |
| Kinematic fixtures hide stationkeeping/recoil | Label the approximation and separately test free stations before making construction claims |
| Only one solution feels usable | Alter objective/equipment/initial geometry and inspect alternatives before making the campaign larger |
| Replays are pretty but editing is not fun | Treat this as a visualizer result, not product validation; revise or pause the game layer |
| Optional 3D/VR expands the project prematurely | Finish the 2D product gate; preserve boundaries rather than implementing speculative features |

Open decisions: final title; exact renderer/UI stack; initial integrator and tolerances; chosen planet–moon geometry; solver adjustment variables; whether orbit-match needs a separate action; capture residual model; cargo/service durations; first finite-quota endpoint requirement; deployment-cost accounting; and export format. Local Codex may choose reversible implementation details and document them, but should not silently replace the central player-authored trajectory model.

## 12. References and provenance

The user's Children of a Dead Earth play observations and the conversation's design decisions are the primary requirements source. Public references below supply inspiration or technical tools; none establishes that this particular combination is unique or that this prototype is already feasible at a measured performance level.

| Reference | Intended use and boundary |
|---|---|
| [Children of a Dead Earth](https://www.childrenofadeadearth.com/) | Physics/trajectory-game reference. Detailed interaction requirements above are explicitly the user's firsthand account, not an independently audited specification of every game control. |
| [Opus Magnum](https://www.zachtronics.com/opus-magnum/) | Fixed production objectives, independent optimization dimensions, and shareable animated solutions. Do not require the orbital world itself to reproduce its exact machine-loop semantics. |
| [Gravity assist](https://en.wikipedia.org/wiki/Gravity_assist) and [Interplanetary Transport Network](https://en.wikipedia.org/wiki/Interplanetary_Transport_Network) | Visual/conceptual references supplied by the user; not the sole numerical authority for an implementation. |
| [NASA/JPL Three-Body Periodic Orbits API](https://ssd-api.jpl.nasa.gov/doc/periodic_orbits.html) | Optional later source of orbit-family initial states, periods, and stability information. Record its normalization and rotating-frame convention before using a state. A catalog entry does not establish a playable transport connection. |
| [ESA PyKEP](https://esa.github.io/pykep/) | Optional offline reference for propagation, Lambert/flyby work, and trajectory design. Not a browser dependency or a requirement to build a global optimizer. |
| [Vite](https://vite.dev/guide/) and [MDN Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) | Candidate lightweight browser build and prediction-work boundary. Verify versions and actual support when implementing. |
| [Codex AGENTS.md documentation](https://developers.openai.com/codex/guides/agents-md) | Repository instruction/handoff reference for the subsequent local task. No task was launched by this documentation capture. |

The previous discussion also raised Voyager 2, kOS, the 2009 ICFP orbital programming contest, and Solar Expanse as neighboring references. They are an optional follow-up research list, not implementation dependencies or a claim that their complete capabilities were reverified here.

## Log

- 2026-10-06 [Codex] Created the initial charter through ChatGPT/org-vault, including the user-reported Children of a Dead Earth interaction model, 2D browser scope, consistent multi-source spacecraft dynamics, bounded local assistance, explicit logistics and scoring contracts, M0–M6 evidence gates, and a copyable local M0–M1 assignment. This is documentation capture, not execution evidence.