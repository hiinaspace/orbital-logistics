# Reusable route intent — architectural direction, updated 2026-10-07

The user identified a limit of compiled maneuvers: matching an orbit before
phasing is useful, and reusable/cyclic services must adapt their corrections to
the state at each voyage. Static epoch/component burns alone cannot express that.
This is a direction for the next program design, not an implemented runtime helper.

## Separate intent, resolution and execution

- **Authored intent** names a target port/orbit, a semantic event or arrival window,
  allowed direction/revolutions, adjustable variables, clearance, fuel/component
  bounds, tolerances, and a bounded failure/timeout policy. It has a durable command
  ID and model version. A generic "go there" instruction is insufficient.
- **Resolution** takes the actual preceding physical and discrete state, including
  cargo mass, remaining fuel, port state/occupancy and completed dependencies.
  A pure deterministic calculation returns explicit impulses/events and diagnostics
  or a failure. Work limits count numerical evaluations, never wall-clock time.
- **Execution** applies those resolved events through the canonical runner with
  normal fuel/resource checks. Prediction and execution call the same resolver
  at the same semantic boundary; neither uses a renderer/worker-owned policy.
  A changed prefix invalidates a resolution, not the player's named intent.

The UI should show intent on the route and its current resolved time/Δv/path in
the maneuver view. Precision edits can explicitly detach a static maneuver from
its helper. Failure or ambiguity should be visible at that command and truncate
or condition downstream predictions. A saved preview/cache is explanatory evidence,
not authority to execute a correction from another state.

## Keep the current seams honest

M2's optional `Burn.assist` is provenance for a **static** authoring action. It is
not a runtime command; editing its components clears that provenance. M3a's port
operations are explicit-epoch events, distinct from burns. The canonical scheduler
already owns physical and discrete state at event boundaries. New runtime intent
will need an explicit versioned command variant and snapshot/resolution cursor,
not a reinterpretation of `assist` metadata or silent replacement of saved burns.
Do not discard new command fields on JSON import and then execute their old cache.

The initial terminal-velocity-match-first suggestion is superseded by the
[2026-10-07 reviewed periodic study](design/periodic-transfer/proposal.md).
First compile a bounded two-voyage recipe of complete dock-to-dock transfers
sequentially from their own simulated prefixes. Preserve authored recipe/version
separately from generated v1 events. Resolve before playback for this deterministic
finite experiment; this is state-dependent compilation, not runtime feedback.
Keep accepted execution immutable, regenerate drafts on recipe edits/load, and
use the current full-plan validation. A runtime resolver/scheduler follows only
when conditional joint actions or rolling prediction need it. A terminal velocity
match remains a useful explicit component but cannot repair an arrival-position miss.

For eventual semantic-event commands:
Choose semantic event occurrence/window identity and an ambiguity policy; never
follow whichever mutable numerical bracket happens to be nearest. A complete
rendezvous may need a departure correction, a terminal correction, or both, and
must declare which it is permitted to change. Repeating voyages need scoped
acknowledgements and fresh event arming; absolute time modulo a period is not a
substitute for environmental phase and finite inventory accounting.

"Transfer to orbit" remains an open design decision: which orbital state is the
player naming, what changes may the resolver make, and how much phase choice
belongs to the player? Osculating elements are local in a multi-body field. Begin
in the fixed-primary domain and retain explicit epoch burns as an inspectable
low-level escape hatch. No general language or hidden global route selection.

## M4a absolute-program checkpoint

The user accepted M3a and chose a first puzzle slice before dynamic commands.
M4a port targeting is still an edit-time helper: it receives explicit departure/
arrival epochs and a target port, then proposes static paid burns and visible
Undock/Dock events. It uses the actual prefix's cargo/fuel/service state and
preserves the chosen window. Saved puzzle solutions export these absolute programs.
This exercises the target/resolution/paid-event seam without making `Burn.assist`
a runtime instruction. Retiming an existing leg still requires editing its related
absolute port events; it does not move them silently.

## Evidence required before runtime intent ships

Check prediction/execution agreement for resolutions, impulses, costs and event
identity under different warp/scrub partitions and mid-command save/reload. Vary
cargo, fuel and departure phase. Include missing/ambiguous events, blocked ports,
insufficient fuel, bounds/nonconvergence, stale previews and tightened timestep.
Independently verify accepted trajectories. A second voyage must recalculate from
its real state rather than replay the first voyage's cached correction.
