# Atmospheric arrival evidence

Implemented finite **Aster · Atmospheric arrival** after verified gpt-6-astra/xhigh senior review. Transport, brief, critique and disposition are retained under [design/entry](../design/entry/). The review was architecture advice, not a final diff audit.

## Witness
Petrel begins at1.5R with prograde velocity.73. A co-rotating exponential atmosphere and bounded regularized lift reshape the descent. Feedback propulsion engages below.025R, saturates force/acceleration, and uses actual stage mass. Ocean contact occurs at t=4.37526223836 and1+1e-5R. Speed relative to water is.05179327, admitted against.06 with1e-7 numerical allowance. Remaining fuel.16995143 of initial.2; freight.2 remains onboard. Water contact records impulse and.0013009682 relative kinetic-energy removal. These are normalized fictional quantities, not real-vehicle survival claims.

No pad/berth/ground logistics is introduced. Recovery ends thrust and follows the body's surface rotation. Replay rewinds prepared history; continuous atmospheric service is not part of this exhibit.

## Independent numerical gates
`npm run evidence:entry` integrates the complete seven-state flight/controller from the original initial state using an independently written DOP853 oracle. No production helpers or propagated state seed. Regular/tight oracle disagreement is8.16e-11. Canonical grids1/512,1/1024,1/2048 have maximum sampled component errors2.32e-11,1.73e-11,1.43e-11; contact epoch error≤4.30e-11. Limits were fixed in the evidence script before final witness admission.

The oracle checks peak dynamic pressure, total non-gravitational load, thrust and the heating proxy. Production maxima are conservative checked-trial/RK-stage observations, including the last exterior trial before refining contact; they are not continuous peak certificates. Air-relative drag power stays nonpositive, and lift power magnitude is≤5.46e-17. Mass, fuel, event sides, impulse and recovered corotation are independently consistent. Source model version freezes controller, regularization and fades.

The final run retains8965 physical nodes; checked propagation work116728 evaluations/8969 trial intervals/48 root iterations. Prepared display is6.13MB with12290 samples.12000 off-grid checks show3.76e-8R maximum drawing position error,0.038px at maximum zoom1e6px/R. Preparation is roughly1.3s on the measured host while other checks were active; this is not an isolated throughput benchmark.

## Automated validation
- Full simulation suite:182/182 pass. Six new tests cover air-frame power, moving-body/rotation invariance, vacuum parity, powered mass, domain rejection, deterministic event/query replay, unsafe load/impact/fuel/missed-recovery/work rejection.
-20 distinct production Chrome checks pass across entry, staging, viewer, camera and tracking. The initial layer case expected only four controls; it was updated for the three added entry layers and passed separately. Entry's final repeat also exercises actual playback through water contact.
- Entry checks: optional density/force/glow layers, correctly projected drag/lift directions, close Follow, rotating/3D/Chase, future thrust whiskers, exact event-time recovery, rewind, unchanged physical states across toggles, continuous/staged-set switching and no console/page errors.
- Build/typecheck, all-file configured Ruff-format/lint/ty and diff whitespace checks pass.

Screenshots [overview](entry-overview.png), [close entry](entry-close.png), [terminal braking](entry-terminal.png) were inspected by the agent. Human acceptance of choreography remains separate.

## Presentation
Starts0.1×; choose **Entry view** to follow close up. Layers contains **Atmosphere**, **Aerodynamic forces** and **Entry glow**. Density shading and faint decade contours show the atmosphere; blue drag and violet lift arrows share a bounded nonlinear force-length scale. Glow is qualitative sqrt(density)*airSpeed³, not temperature. Frame/layer/zoom changes never alter propagation.
