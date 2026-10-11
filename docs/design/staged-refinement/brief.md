# Staged mission aesthetics refinement

2026-10-11. User explicitly requests Astra review and a small parameter search.

Goal: improve two visible artifacts in the recently accepted staged Apollo-like exhibit while retaining compact Outer Wilds/orrery scales. Odyssey's lunar insertion near t29.7 appears to pause around L1 and flip in inertial view; Eagle's ascent overshoots the orbiter radius and burns back toward Selene to dock. Favor coherent lower-cost, lower-acceleration or longer burn arcs, not numerical fuel optimality at any cost. Existing fullscreen UI accepted; speed slider independently gets more physical width.

Environment: /home/s/code/orbital-logistics, natto, branch codex/model-set-viewer, HEAD2ab92ec. uv/SciPy authoring, TS canonical Runner, production Chrome browser tests and existing4178 preview. Preserve unrelated untracked reports/research_notes. Review read-only; authoring work will live in docs/design/staged-refinement. No 3D physics migration, solver framework, runtime scheduler changes, softening, capture-tolerance relaxations or cosmetic physical trajectory smoothing.

Verified by source/fixture:
- src/model-set/staged-apollo.ts compiles strict fixed graph; atmosphere boost/upper, lunar arrival/descent, real all-field parking orbiter, paid Eagle dock, return with attached actual lander mass, two atmospheric recoveries.
- Aster mu1 radius1; moon mu.03 radius.2 on radius5 circular prescribed rail; planet spin.03. World87. Single compilation repeated by exact planar synodic symmetry103.3853 in src/staged-service. Moon scale/spacing supports accepted visual extent.
- Booster split.78; lunar split37.43518675, landing38.66440509, liftoff40.66440509, dock44.5. Departure47.15; return entry75.0323, recovery79.51386. Canonical h1/1024.
- Existing Eagle ascent and final braking each turn through nearly a full revolution of thrust directions. docs/design/staged-apollo/author.py least-squares residual weakly regularizes against a seed that already contains large turns; endpoint residual alone cannot reject looping solutions.
- Existing offline authoring constants mostly inherited prior single-vehicle expedition. All changed lunar insertion changes downstream descent/lander target/return. Simply changing arrival controls without retargeting downstream is invalid. Dock-only changes still change attached lander fuel and return mass, so full mission recompilation and return retargeting may be required.
- Three tanks and exact no-kick splits/docking; physical capturepos/vel2e-6 with unchanged error allowances; independent wholegraphDOP853 and h/h2/h4 supported1e-4 fullmission accuracy.
- Accepted owner viewing is evidence of liking current scale, not a claim current maneuvers are globally optimal.

Options/current lean:
1. First bounded search with unchanged world, outbound arrival and lunar descent; retarget ascent into real coasting orbiter with simpler heading family, softer thrust, flexible dockepoch/dwell. Use explicit radius-overshoot, turning and fuel metrics; verify actual launch outward and whole-interval clearance. Lean this; reject brute unregularized20angle search because it reproduces wild spirals.
2. For lunar insertion, first measure inertial near-stop and lunar-relative radius/speed against burn timing. Try moderate insertion-duration/heading/target-radius changes retaining compact scale, but only adopt when whole mission can be retargeted; alternatively shift broader approach phasing if stopping is encounter geometry rather than a localcontrol defect. Lean narrowtime/geometry changes then broaden only if clear payoff.
3. Consider slightly larger lunarparking orbit or timing vs change planet/moon mass/radius/distance. Lean keep worldscale first. Reject new dynamicsmodel/artificialtrajectorylerp; current complaints are choreography.
4. Acceptance: rank smoothness perphase in inertial and rotating frames, engineaccel/propulsiveDeltaV, radialovershoot vs actualorbiter, thrust totalturn/keyturnrate. Constraints dominate objective; no relaxed capture or free resets. Aesthetics remain agent-viewed until human nextlook.

Open decisions: Which candidate families are likely to reduce the awkward stop/flip without simply hiding it? How to constrain landerascent while preserving launchfromsurface and exactdocking? Does lowering peakacceleration necessarily improvevisual path, or should curvature/overshoot be first? Bound search to a handful of topologyfamilies and seeds. Recommend order and concrete scoring/guards. Audit overlap: arrival and ascent may needcoordinatedparking geometry rather than independent tuning.

Depth budget: one focused source/physics taste pass. Do not redo entire originalarchitecture or author optimization. Verify load-bearingclaims first, label verified/inferred/unknown, prioritize critique and provide concrete parameterbounds/acceptance. User has already authorized implementation, so leave only meaningful tastes forks to human. Return review text; no edits.
