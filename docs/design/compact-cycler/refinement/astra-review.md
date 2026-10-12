Two actionable findings:

1. **P2 — v2 admission rules leak into v1.** [prepare.ts:30](/home/s/code/orbital-logistics/src/compact/prepare.ts:30) applies grouped routes and configurable pad phases to both versions, contradicting the brief’s “exact old v1 admission” claim. I reproduced acceptance of a v1 profile with its carrier coast split into two segments—eight segments total; the old reader required seven. Preserve v1’s seven singleton routes, original control-presence rules and zero pad phases. Add a regression proving the expanded profile requires v2.

2. **P2 — the morphology gate does not establish local taxi connections.** [compact-cycler.test.ts:51](/home/s/code/orbital-logistics/tests/sim/compact-cycler.test.ts:51) checks aggregate aboard time, which hides directional differences:
   - Inbound: **10 units flying independently, 7 aboard**.
   - Outbound: Pipit travels from radius **1.00 to 4.81 before boarding**, while Selene’s orbital radius is **5**.

   Literal coasts and shorter carrier burns address part of the feedback, but the Aster connection still spans much of the system. Record each direction’s boarding geometry and taxi/ride split, and keep “local access” pending the human viewing gate. This is an acceptance gap, not a demonstrated physics error.

Verification was otherwise strong: **all seven current native tests passed**; fresh DOP853 replay of all 15 frozen segments matched stored oracle positions within **1.8e-15 at identical epochs**. Native convergence, late-epoch rotation, paid captures, reserves and endpoint continuity passed. The retained browser log now reports both tests passing; I did not independently inspect the screenshots.

Recommend fixing the v1 boundary before admission and presenting the directional geometry honestly at the taste gate. No edits or delegation.
