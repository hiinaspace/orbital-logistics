# Synthesis: an orbital model set

2026-10-07. Codex synthesis of the recovered Fable consultation. Historical synthesis; the user subsequently accepted the viewer direction and
authorized implementation on 2026-10-08. See [current scope](../../model-set.md). See [recovery status](README.md) for the interrupted
final review and [original recommendation](consultant/recommendation.md) for the full
independent advice.

## Recommendation

Treat watching and exploring the orbital scene as a sufficient experience. The user
chooses a set and viewpoint; the computer may supply trajectories and schedules.
Maneuver editing and dispatch policies can remain optional tools. Neither courier
reorganization nor solving a puzzle needs to be the next acceptance gate.

Separate trajectory production from viewing. Initially use prepared programs and
initial states, executed through the existing canonical Runner. Later producers may
use analytic transfers, numerical targeting, enumeration, or optimization as needed.
Automatic selection is compatible with the user's latest preference; keep its model
and chosen result inspectable without requiring the user to author the policy.

For the next implementation discussion, recommend **one prepared scene, good time
control, and a rotating frame**. The DRO is a compact candidate: already checked in
both an independent integrator and the application Runner, and visually different in
inertial versus rotating coordinates. The two-tug shuttle is an alternative if ship
activity matters more than orbit shape; it requires multiple overlaid runs. Choose
between those experiences before adding a general fleet schema or schedule generator.

The practical question is simply whether the user enjoys watching and exploring it,
and what they next want to change. No mandatory three-day return test, engagement
metrics, or optimization assignment is needed for this hobby project.

## What the experiments support

| Witness | Supported conclusion | Boundary |
| --- | --- | --- |
| Two staggered shuttles | Existing programs can supply simultaneous traffic without new route calculations | Independent runs plus a merged stock check; no joint fleet runtime |
| Synthetic 2:1 cycler | A deliberately commensurate ballistic set can repeatedly meet two ports | Not an Aldrin Mars cycler; boarding and alighting still cost delta-v; no app execution |
| Planar DRO | The existing moon fixture and Runner can host this rotating-frame periodic orbit through t=24 | Synthetic mass ratio, no insertion transfer, no long-term stability proof |

Full numerical output and reproduction commands are in the
[consultant artifact index](consultant/README.md). The four commands were rerun
successfully during recovery.

## Qualifications to the independent advice

- **Keep the first slice smaller.** Three scenes, manifests, event auto-slow, and a
  general set bundle are possible improvements, not prerequisites for trying one set.
- **Frames stay presentation-only, but need validation.** Rotate each sample at its
  own epoch and include the rotation term when displaying velocities. Physics
  independence does not mean an implementation has zero risk.
- **An overlay has declared independence assumptions.** The stock check is necessary
  for the shuttle witness, not sufficient for every possible fleet. Berth contention,
  shared decisions, mutual gravity, or ship handoffs would need their own treatment.
- **Distinguish the type of recurrence.** The ballistic cycler and its chosen port
  geometry recur; adding consumable transfers would not reset fuel or cargo. The
  current shuttle's relative geometry also recurs up to a global rotation, even
  without an exact inertial reset of the whole world.
- **Keep model details on demand.** Preserve provenance and physical assumptions in
  an optional details view and documentation. Avoid recurring caveats in captions,
  subtitles, and footers, consistent with the user's earlier UI feedback.
- **Do not infer competitor absence from a brief survey.** The claims that other
  viewers lack fleets or what-if features are not established by this research.
- **Do not assume real trajectories require an immediate engine rewrite.** A
  read-only trajectory viewer or 2D projection is a separate, narrower option than
  forward integration of a fully self-consistent 3D system. No provider framework is
  needed now. A planar DRO is an orbit-family analogue, not an exact Artemis replay;
  planar dynamics cannot reproduce a 3D NRHO.
- **A pleasing loop may be enough.** Cargo changes, conflicts, multiple ships, and
  automation can add interest, but are not requirements established by the user's
  stated enjoyment of the existing viewer.

Keep the existing prediction/execution implementation, canonical time boundaries,
paid maneuvers, and independent numerical checks. Defer dynamic commands, shared fleet
execution, solver choice, and a periodic programming language until a wanted scene
actually needs them. The prior topology and periodic-service studies remain useful
design branches and content sources, rather than obligations on this direction.
