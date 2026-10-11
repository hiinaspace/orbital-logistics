# Finite Aster–Selene expedition evidence

Input: `fixtures/model-sets/aster-selene-expedition.json`.
Independent replay: `spikes/numerics/apollo_oracle.py`.
Retained reports: `apollo.json` and `apollo-oracle.json`.

Preparation retains 92,153 physical nodes, 30,151,944 serialized physical bytes and a 7,913,349-byte display packet. It measured about 3–4 seconds on natto. Odyssey starts with 6 fuel units and recovers at t=83.559592 with 2.115321 remaining. Independent dense observations find at least 0.157713 clearance above atmospheric top during vacuum flight; runtime interval certificates guard crossings between observations.

Runtime lunar landing residual: position 5.85e-8, velocity 1.29e-7, paid fuel 6.56e-8. Independent continuous replay reaches position 3.45e-7 and velocity 8.59e-7 against the same support provider and pays its own correction. Admission reserves position 5e-7 and velocity 1e-6 numerical allowance inside 2e-6 limits. Independent observed solid-body clearance is 1e-5.

Whole-trip independent difference is at most 3.32e-4 in state components, 6.66e-4 in recovery epoch and 1.64e-4 in terminal state. Independently paying the landing residual changes fuel by 3.72e-7, affecting subsequent force-limited flight and accumulating return phase difference. The retained mission-level gate is 1e-3, separate from local landing admission. The coarser 1/512 vacuum replay is checked against production 1/1024 before paid capture with a 4e-6 state-difference bound. Its larger residual is not admitted as a substitute landing program.

Tests check exact seams, burn ownership, support geometry/dwell, capture, splashdown boundaries, compensated absolute-clock ephemerides, rejected vacuum air crossings, rejected excessive ascent load, rewind and switching. Browser captures: `apollo-launch.png`, `apollo-transfer.png`, `apollo-moon.png`, `apollo-entry.png`.

This is a finite single-vehicle witness. User aesthetic acceptance and online recurrence are separate next gates.
