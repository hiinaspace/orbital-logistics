# Continuous survey, fictional observatory mission and flyby Chase

2026-10-13, local production build. User accepted the finite spatial witnesses before this extension. Chooser now uses Helion/Orison, Prism/Lumen and Cairn; Webb and Gaia/WMAP are inspiration in optional descriptions. Historical fixture IDs stay stable.

## Continuous survey

`Helion–Orison · Continuous survey` keeps actual six-state free flight with finite fuel. A small two-frequency collocation guide (not an exact torus or a physical target rail) supplies phase and shape references. Its normalized acceleration residual is about4.54e-4 on the fitted grid. Every4units, bounded full-state phase fitting excludes the linear growing/decaying modes; actual canonical finite-pulse response determines a paid radial correction. Horizontal/vertical center amplitudes, full center error, radius, actuator conditioning, fuel and solve-work gates prevent quietly replacing a lost orbit with a drawing. Rejection stops at the last complete physical/controller anchor.

Unwrapped two phases, actual state and remaining fuel continue together. No wrap/reset, target snap or fuel import. The pulse requests force from initial mass and acceleration; the normal fixed-force/acceleration-cap/depletion law owns subsequent mass and fuel. The frozen descriptor is a dynamically consistent accelerating circular binary; its five equilibria are genuine CR3BP reference equilibria.

32units of prepared lead,1024total rolling retention; default512trail and the existing trail slider allow long figures. Held history, reverse playback and Live reuse the shared semantics. The worker admits at most one4-unit warm request; one held reply may extend drawing storage once. Bounds:7candidate solves,8192nodes each (at most two candidate Runners simultaneously referenced),48rows/50KB perchunk,258retainedchunks/10000rows/8MB,1MBreply. Historical physical Runners are discarded after each episode. The frontend validates whole packets before publishing.

`continuous/rollout.json` records2600units (~4phase beats, >2retention windows), no refused controls,8217retainedrows, maximum2.973MB, finalfuel0.399691 from0.4. Its ~111s wall time is a nonisolated CLI measurement, not a frame-time promise. `scripts/libration-survey-rollout.ts` reproduces this rollout. A second1320unit rollout and independent frozen-control replays at32and1304 are retained in the oracle report: full position/velocity errors below1.1e-13, fuel below1.3e-15.

## Staged mission

`Helion–Orison · Observatory mission` is a finite80unit Webb-inspired airless witness. Kestrel launches at0.5, separates Prism without a kick at1.5, and returns to the actual rotating Cairn pad at6. Prism completes parking insertion at2.5, coasts through several genuine local circuits, departs at23.5, inserts into the halo at37.5, then coasts for more than a complete halo period. All burns are paid finite thrust and the launch steering is smooth. Parking/departure solves use the actual coupled field and endpoint; neither insertion nor private canonical continuations reset the state.

A narrow `mission-surface-v7` admits exactly one empty moving pad in a two-circular-source field, zero freight objective, and no transfers. Old moving-surface-v6 restrictions remain. Surface support and flight retain the existing safety/integrator implementation. No atmosphere, hull/contact dynamics or actual Webb mission reconstruction is claimed.

The stack carries upper dry mass and0.4reserved upper fuel as ballast. Only the booster tank funds the first burn. At separation mass/momentum are conserved exactly; child six-states match. The recovered booster remains supported on the moving pad; upper private episodes hand over exact state/fuel. Registry admission reserves under220000nodes; actual191938,8273displayrows/2.55MB. Local preparation ~4.6s happens in the preparation worker. Final booster fuel0.975005 and Prism0.351369.

Independent seven-state DOP853 replay starts from support, then branches using its own unsnapped parent endpoint and continues through all upper episodes. Position/velocity agreement is about1e-11 through the outbound phase,2.1e-8 through64, and1.5e-6 at80 as the unstable halo magnifies the initial integration difference. Fuel disagreement ≤1.1e-11. Native full-state one-period rotating closure is2.3e-8. Late-coast oracle allowance3e-6 is separate from1e-7 physical surface capture guards. Dense Hermite midpoint probes are <0.25pixels against canonical queries at60000px/unit for launch and4000elsewhere; drawing states never become physical targets.

## Chase regression

The reported planar cut came from using the sign of instantaneous angular momentum as camera up, plus changing the velocity source near the moon. Chase now projects fixed world north perpendicular to forward and retains the primary velocity reference throughout the passage. Nomad/Wayfarer8.10–8.18 in inertial and rotating frames with relief remain upright (up.z=1, adjacent forward dot>.995); Odyssey28–32 in Crossings also remains upright. This is a coplanar flyby fix. Existing near-polar fallback/zero-speed ambiguity is not a general spatial continuity claim.

## Verification

- Focused camera and extension tests:8pass; request partition, phase-anchor continuation, atomic malformed-packet refusal, held history, fuel admission/reserve refusal, stage ownership, exact continuation, pad recovery, halo closure, bounded storage and Hermite accuracy.
- Independent frozen-control and complete unsnapped staged replay: `libration-extension-oracle.json`; controls/samples input retained (80KB).
- Production browser regressions: flyby/relief, survey >256at16×, Pause/held seek/Live, launch/separation/parking/insertion, rewind and switching finite/continuous. Screenshots visually inspected at1920×1080.
- Complete simulation suite:305pass; final new-domain focused regressions:8pass.
- Five production-browser cases pass on the final build; fixture compilers reproduce six outputs byte-for-byte. Configured Ruff/ty hooks pass.
- Astra design and implementation review records/dispositions in `docs/design/libration-orbits/`.
