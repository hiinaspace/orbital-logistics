# Observatory extensions — 2026-10-13

User accepted the three finite L2 exhibits, requests continuous Lissajous with long
figure-drawing trails, and a Webb-inspired mission with staged ground launch and
parking orbits before departure/insertion. Rename bodies/stations to fictional
scheme. Also reported chase cuts/relief inversion at Selene flyby; source audit
found dominant-body reference switching and sign-changing r×v normal. Proposed
camera fix uses stable first-source-relative velocity and orbital north (pole
fallback), deterministic display only. It has no physical influence.

Verified starting point: eed27fa, /home/s/code/orbital-logistics, branch
codex/model-set-viewer. Untracked user reports/research untouched. General Runner
supports both moving binary sources. Binary fixtures use .997/.003 mass ratio,
separation4, rate.125, radii .65/.1. New metadata display domain no legacy edits.
SceneView binary flag preserves true z. Finite Lissajous already has a60-unit BVP
witness; no true torus or recurrence proven. Measured perturbation growth large.
Old staged-flight/atmospheric domains admit fixed primary; do not loosen them.
Moving-surface-ports-v6 in schema/logistics supports surface support on either
moving body, with a second surface support to satisfy port-count contract.
Existing separate stack mass split/separation accounting in model-set/staging.ts
is reusable method, not a ready general mission schema. Traffic worker supports
new separately admitted runtime/store through one bounded outstanding request.

Mostly-worked lean:
1. Continuous orbit: fit a small two-frequency spatial Fourier *survey reference*
against CR3BP acceleration collocation, retaining quantified residual (prototype
.007 horizontal/.025 vertical leading amplitudes gives .000453 dimensionless
accel residual; not an exact dynamical torus). Real ship remains canonical,
control-free coast except short paid correction pulses. A radial pulse .5units
once per4-unit episode controls the growing mode: local linear unstable-left
projection, phase estimated continuously from center-subspace scaled6-state
error with bounded local phase changes, no global closest-position jumps. Shoot
scalar acceleration against actual Runner4-unit endpoint, bounded ≤6 candidates,
maxAccel .002, high-Isp50, finite .4 propellant, deadband and positional envelope.
No projection/reset/seed wrapping/refill. Deadband/gains/envelope feasibility still
unverified: first bounded long rollout, then runtime if it holds. Reference owns
no ports/resources and is never a physical target.
2. Continuous contract: new libration-survey-v1 runtime. Immutable4-unit canonical
chunks with exact initial epoch/state/fuel/policy/control identity.32-unit committed
lead; total1024 retention with8-per-unit Hermite drawing plus exact control epochs,
max one held extra chunk; one worker request. Physical Runners only current
candidate/accepted episode, discard old physical nodes after drawing publication.
No template reuse. Permanent fuel use; refuse candidate/halt at last good head if
fuel/safety/drift/control budget fails. Calendar ≤1e6. Long trail default512, slider
up toretention. Restore held/rewind/Live semantics from existing stores, not a new
playback engine. No rescue/visitors/imports. Packet/window/node/held caps explicit.
3. Finite mission: new binary-observatory-mission-v1 composition, using existing
Runner and moving-surface support rather than retagging old staged-flight.
Airless launch first (user asks staged launch, does not explicitly require air).
One supported stack, paid smooth ascent; zero-kick exact mass/fuel/momentum split;
booster finite-thrust return to same pad; upper enters real low parking orbit,
coasts roughly two circuits, departs from its actual state and inserts into halo.
Separate private episodes per active actor with exact6-state/fuel handoff, no
provider/docking at halo. Frozen offline solve, independent oracle, canonical
refinement and whole-assembly resource/separation checks. Keep no hidden orbit
matching/reserved fuel use, no air/crossfade approximation. Strict own schema.
Ground scene feasibility unverified. First solve launch/parking/booster return,
then actual-state departure. Existing atmospheric mission remains unchanged.
4. Names: Helion (star), Orison (planet), Cairn (pad), Prism (halo observatory),
Lumen (survey); descriptions mention Webb/Gaia/WMAP inspiration only. Existing
finite IDs can remain stable while display names change; masses/physics unchanged.

Please verify load-bearing source claims then review risks and right-size scope.
Can one radial pulse preserve useful center motion without forcing clock phase?
What controller/cache/held-history and staging ownership gates are essential?
Any must-change before implementation? Finite/long-rollout gates precede release.
Read-only; no edits/delegation/expensive experiments. Not general Nbody/torus proof,
new atmosphere model, arbitrary fleet scheduler, docked maintenance or full launch
vehicle simulation. Focus on physical truth and practical robustness.
