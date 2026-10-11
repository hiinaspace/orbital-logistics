# Finite Aster–Selene expedition evidence

Input: `fixtures/model-sets/aster-selene-expedition.json`.
Independent replay: `spikes/numerics/apollo_oracle.py`.
Retained reports: `apollo.json` and `apollo-oracle.json`.

Preparation retains 92,153 physical nodes, 30,151,944 serialized physical bytes and a 7,914,087-byte display packet. It measured about 3–4 seconds on natto. Odyssey starts with 6 fuel units and recovers at t=83.559592 with 2.115321 remaining. Independent dense observations find at least 0.157713 clearance above atmospheric top during vacuum flight; runtime interval certificates guard crossings between observations.

Runtime lunar landing residual: position 5.85e-8, velocity 1.29e-7, paid
fuel 6.56e-8. The tightened independent DOP853 replay reaches position 1.76e-9
and velocity 1.17e-8 against the same support provider and pays its own correction.
Admission reserves position 5e-7 and velocity 1e-6 numerical allowance inside
2e-6 limits. Independent observed solid-body clearance remains about 1e-5.

Whole-trip independent difference is at most 5.32e-5 in state components,
1.07e-4 in recovery epoch and 2.63e-5 in terminal state, with DOP853
rtol 3e-14/atol 3e-15. The retained mission-level gate is 1e-3, separate from
local landing admission. The coarser 1/512 vacuum replay is checked against
production 1/1024 before paid capture with a 4e-6 state-difference bound.
Its larger residual is not admitted as a substitute landing program.
The [continuous expedition witness](continuous-apollo.md) retains a rejected
looser-tolerance repeated replay and the improved independent convergence;
production physics and acceptance gates are unchanged.

Tests check exact seams, burn ownership, support geometry/dwell, capture, splashdown boundaries, compensated absolute-clock ephemerides, rejected vacuum air crossings, rejected excessive ascent load, rewind and switching. Browser captures: `apollo-launch.png`, `apollo-transfer.png`, `apollo-moon.png`, `apollo-entry.png`.

This is a finite single-vehicle witness accepted by the user. The separate [continuous extension](continuous-apollo.md) retains its own recurrence and turnaround evidence.

Playback regression: the first user run exposed missing docking metadata during
fuel interpolation immediately before launch. The expedition now retains both
sides of planetary release, and the shared sampler tolerates optional docking
metadata at a flight endpoint. Tests cover both sides of all physical seams,
older packets without that release boundary, ordinary-speed playback across
launch, and complete accelerated playback through recovery.

Accelerated rewind/resume also reproduced a queued RAF timestamp preceding the
Play handler clock reset. Elapsed presentation time is now clamped to zero
instead of querying before the prepared mission begins. The updated browser
regression passes, along with 25 related simulation tests and independent replay.

The viewer's rotating frame now follows the Moon's rail rate and phase rather
than the atmospheric spin. Tests keep the Moon stationary across the mission
and exercise that frame in the browser.

A read-only recurrence probe gives T=103.38531648 for the relative Moon/pad
period and rotation 3.10155949 radians. Sampled production body, pad and gravity
queries at t+T match rotated queries at t to <1e-14. This probe informed the separate
[continuous reuse design](../design/continuous-apollo/README.md); its repeated
powered-flight, turnaround and playback evidence is retained separately.
