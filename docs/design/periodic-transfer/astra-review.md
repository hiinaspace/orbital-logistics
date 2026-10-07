Model: `gpt-6-astra`; reasoning effort: `xhigh` — verified in the caller’s transport log.

I recommend proceeding with a **bounded, repeated service recipe and timeline**, while deferring runtime event insertion. The highest-leverage decision is the recipe’s timing contract: what an edit changes, which departures remain fixed, and how readiness conflicts appear. That determines whether the player is designing a transport machine or maintaining timestamps.

I verified checkout `617fdc2` on `codex/m4-puzzles`, inspected the named simulation, targeting, editor and evidence files, and ran the logistics/puzzle test suites successfully. An in-memory reproduction matched the archived aligned and failed schedules exactly; timestep refinement and query-partition checks passed. I inspected the existing oracle reports but did not rerun their independent integrations or conduct a playtest. I modified no files and launched no agents.

1. **Highest priority: merge decisions 1, 2, 3 and 6 around one explicit timing model.**

   The proposal currently distributes departure ownership across Transfer, Wait docked, service readiness and timeline dragging. “The next departure respects readiness” could mean either moving that departure or reporting a conflict. Those produce substantially different games. The later hard-miss rule helps, but does not fully specify editing behavior. [Proposal](/home/s/code/orbital-logistics/docs/design/periodic-transfer/proposal.md:75)

   Choose **authored departure commitments, arrival-relative service, and derived waiting** for the first slice. Moving a transfer changes its authored departure; resizing it changes its duration. Arrival and destination service follow. Subsequent authored departures stay fixed and can become impossible. Do not introduce a separate editable Wait block yet.

   Likewise, editing an occurrence should edit the recipe and regenerate both voyages. The phrase “affects later instances” suggests live program mutation, which is unnecessary here. Keep accepted execution immutable; recipe edits produce a new draft.

   Two voyages are sufficient to test this authoring contract. They are insufficient to establish sustained service or meaningful cadence optimization. Keep that distinction rather than expanding the first experiment into an infinite simulator.

2. **The study proves a useful scheduling fact, but not the adaptive-programming or cadence claims needed for the next product gate.**

   The reproduced result is sound: the patient route misses the next identical outbound geometry and succeeds when repeated at `2S`, completing at `51.334523` with `0.264619` gross fuel consumption.

   Three qualifications matter:

   - The script copies the same radial/transverse burns at rotated recurring geometry. Gravity and commanded impulse velocity changes are mass-independent in this model; mass changes fuel accounting and affordability. This fixture therefore does not require numerically different burns to demonstrate correct reuse. [Dynamics](/home/s/code/orbital-logistics/src/sim/dynamics.ts:11), [burn application](/home/s/code/orbital-logistics/src/sim/runner.ts:63)
   - The second Home load receives an extra `0.05` fuel, so the experiment is not literally the same service recipe twice. Removing that exception still completes, at the same time, consuming `0.259747567` fuel and retaining approximately `0.140252433`. The extra refuel is optional reserve, not evidence of a reuse requirement. [Study](/home/s/code/orbital-logistics/scripts/periodic-study.ts:21)
   - Patient returns at `19.626757`; express returns at `18`. Both miss the next outbound opportunity at `16.353883`, even before reloading. Their established completion-time tradeoff does **not** establish a different departure cadence. [M4 evidence](/home/s/code/orbital-logistics/docs/evidence/m4.md:47)

   Before promising “cheap cadence versus faster costly cadence,” retain witnesses that actually differ in delivery spacing or opportunities served. I tried three bounded early-return requests; all stalled near the helper’s radial bound. That establishes a limitation of those attempts, not physical infeasibility.

   Also narrow the immediate-repeat interpretation: its miss disproves copying those burns at that shifted epoch. It does not disprove a freshly targeted departure after returning Home.

3. **Defer runtime scheduler surgery; compile the bounded recipe from simulated prefixes first.**

   The proposed runtime seam is technically coherent, but it solves a problem the first experiment does not yet have. With fixed initial conditions, deterministic dynamics, two repetitions and no live intervention, a compiler can forward-simulate each preceding leg, resolve the next from that state, and produce a complete static program.

   This is materially different from copying first-voyage burns. Every occurrence uses its own computed fuel, cargo, time and service state. It simply performs resolution before playback. The current editor already validates an entire draft before execution, and snapshots restore through deterministic replay. [Execution acceptance](/home/s/code/orbital-logistics/src/editor/session.ts:87), [snapshot restoration](/home/s/code/orbital-logistics/src/sim/runner.ts:215)

   Reuse the existing helper against an accumulated prefix, excluding obsolete downstream events. Its current implementation already replays prefixes and validates whole proposals; extracting a local propagator can follow measured cost rather than precede the authoring experiment. [Targeting](/home/s/code/orbital-logistics/src/planning/rendezvous.ts:59)

   **Kill terminal-velocity-only matching as the first reusable transfer abstraction.** It cannot repair arrival position. Retain it later as an explicit low-level operation.

   One verified architectural caveat: “failed departure remains docked” is a new compound transaction guarantee. With insufficient departure fuel, the raw runner currently commits Undock and then rejects Burn; I reproduced that state. Existing editor preflight prevents accepting it as a normal executable plan. If runtime resolution is introduced later, validate the complete departure expansion before committing Undock. Preserving event order alone does not provide this guarantee. [Event ordering](/home/s/code/orbital-logistics/src/sim/runner.ts:117)

4. **Move the propulsion comparison ahead of the second ship. Propulsion and scheduling are only partly separable.**

   Dock-to-dock endpoint intent survives a propulsion change. The importance of phase windows, favorable coasts, payload and waiting may change dramatically. A high-thrust regime could make almost every departure useful; treating recurring opportunities as the universal authoring primitive would then constrain the wrong thing.

   There is also an immediate implementation coupling: the port helper hardcodes departure components to `[-0.25, 0.25]`, CCW motion and less than one revolution. More fuel or exhaust velocity alone does not remove those targeting limits. A failed generous-impulse experiment could therefore measure helper restrictions rather than propulsion’s expressive potential. [Targeting domain](/home/s/code/orbital-logistics/src/planning/rendezvous.ts:23)

   Keep the bounded `F`, `F/m`, `−F/v_e` experiment. Specify its steering family and collision checks, and compare useful acceleration relative to local gravity as well as available Δv relative to orbital speed. The physical distinction between thrust and specific impulse is supported by NASA’s separate performance axes. [NASA propulsion survey](https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion/)

   Run that content comparison after the first recipe/timeline gate, before investing in shared berths, reservations and handoffs. Whether direct torch trajectories preserve the desired orbital character is a human taste decision.

5. **Assistance should remove aiming work, but its boundedness does not prove player agency.**

   In the current fixture, itinerary, hardware, direction and revolution count are effectively fixed. The meaningful choices are primarily dates, durations, loading and refueling. Those may be enough; listing future freedoms does not establish that.

   Seeds, iteration budgets and numerical component bounds should normally be implementation details or advanced diagnostics. Requiring the player to manipulate them risks turning solver convergence into the puzzle. Failure messages must distinguish resource rejection, unsupported helper domain and unresolved numerical search.

   Start the opportunity inspector with a bounded departure-cost curve at fixed duration and a duration-cost curve at fixed departure. Show the effect on **return readiness and the next committed departure** alongside fuel. A cheap outbound leg can be an expensive service choice.

   These slices can miss useful combinations, so do not present their minimum as globally best. Keep the 2D survey as an escalation when that limitation is observed. Tudat supports the proposed departure/arrival cost survey, but does not validate this shooter’s coverage. [Tudat example](https://docs.tudat.space/en/latest/examples/tudatpy-examples/mission_design/earth_mars_transfer_window.html)

The concrete minimal spec I would choose is:

| Concern | First experiment |
|---|---|
| Scope | Existing one-tug, two-port circular fixture; exactly two voyages; unchanged impulse dynamics and bounded horizon. |
| Recipe | Load at Home → outbound transfer → unload/refuel at Depot → return transfer. Same quantities and timing rules on both voyages; no occurrence overrides. Initial attachment and final stopping are outside the repeated body. |
| Timing | Each leg has first departure `d_leg` and duration `τ_leg`. Voyage `v` departs at `d_leg + v·k·S`, with one shared integer cadence `k`. Here `S` comes from the calibrated circular-port geometry. This is a fixture-specific opportunity rule. |
| Readiness | Service begins upon attachment and completes after the port’s duration. Waiting is the derived interval before the committed departure. A departure preceding readiness produces a conflict; it never silently advances to another occurrence. |
| Editing | Moving or resizing either occurrence edits the corresponding recipe leg and updates both occurrences. Later committed departures retain their identities. One undo restores the complete edit. |
| Resolution | Sequentially compile all four transfers from their actual simulated prefixes. Preserve the scenario’s canonical grid. Validate paid arrival and capture through the normal runner. A failed compilation leaves the accepted plan untouched. |
| Persistence | Save versioned recipe intent separately from its generated v1 program and occurrence mapping. Regenerate after input changes or loading; reject unsupported versions. Generated burns are inspectable output. |
| UI | One unwrapped ship lane with service, wait and transfer intervals; synchronized spatial selection/scrub; fuel/cargo traces; first conflict with required versus available readiness. No separate Wait authoring, general event language, 2D atlas or shared-port scheduler. |

The acceptance cases should test the intended abstraction:

- **Unexceptional repetition:** complete the patient route twice at `k=2`, using identical service quantities and no special second-voyage Home refuel.
- **Cadence conflict:** selecting `k=1` identifies the second outbound departure at `16.353883` as incompatible with the first return and reload. No hidden retiming.
- **Causal editing:** increasing outbound duration moves arrival/service and can break the committed return departure. Reducing a refuel exposes the first actual fuel deficit.
- **Fresh resolution:** changing departure phase invalidates and resolves the affected recipe. Changing payload updates consumption and feasibility; it need not change impulse components.
- **Determinism:** regenerated events, inventories and execution agree across save/load and warp/scrub partitions. Check pre-capture residuals under refinement; docking snaps must not conceal errors.
- **Human gate:** the user revises a working recipe for a chosen tradeoff, explains the first resulting conflict from the timeline, and repairs it without editing individual Dock/Undock timestamps.

Do not make a faster cadence a required success claim until its numerical witness exists. If both retained alternatives still use `k=2`, report an authoring/reuse result and continue the propulsion/content experiment.

For a later **bounded cadence** claim, use at least three deliveries, explicit delivery windows or maximum gaps, accounted initial stocks and replenishment, and a terminal return/reserve obligation. Three deliveries expose two successive gaps; that still does not prove indefinite sustainability.

The engineerable decisions are timing ownership, resource accounting, deterministic expansion, failure classification and edit consistency. The human questions are whether schedule choices feel authored, whether waiting contributes worthwhile choreography, and whether torch trajectories retain enough orbital character. Grouped blocks can eliminate contradictory timestamps; only the hands-on gate can establish that they produce the intended game.
