Two findings remain before a clean release sign-off:

1. **P1 — Event-boundary interpolation produces NaN telemetry and incorrect cumulative fuel use.**
   [survey.ts:46](/home/s/code/orbital-logistics/src/binary/survey.ts:46) adds mass and cumulative fuel usage to samples, but returns unnormalized Runner boundaries. [model.ts:236](/home/s/code/orbital-logistics/src/model-set/model.ts:236) interpolates toward those boundaries. At `t=36.49999`, I reproduced `NaN` mass, thrust and acceleration; fuel used was `1.014892e-6` instead of `6.183160e-6`. [mission.ts:43](/home/s/code/orbital-logistics/src/binary/mission.ts:43) has the same cumulative-fuel mismatch across upper-stage episodes. Normalize event-left accounting alongside samples and test immediately before boundaries. Canonical physics remains unaffected.

2. **P2 — Initial survey packets are not bound to the admitted seed.**
   [survey-store.ts:16](/home/s/code/orbital-logistics/src/binary/survey-store.ts:16) checks internal seams and the supplied endpoint, but never compares the first state with the frozen initial state. Shifting every sample and anchor by `+0.01` in x was accepted, advanced the store to 32, and published the displaced initial state. Check initial state/fuel identity before committing. Transactional mutation itself is correctly staged.

Core claims otherwise checked out: exact state/fuel continuation, separate v7 admission, zero-kick separation, **191,938 nodes / 8,273 rows / 2,356,719 bytes**, and native halo closure **2.23e-8**. The recorded 2600-unit rollout supports the stated fuel and retention figures; I did not rerun it.

The brief’s mission times are stale: the current [departure burn starts at 24.5](/home/s/code/orbital-logistics/fixtures/model-sets/observatory-mission.json:388), and insertion ends at **37.5**. The independent oracle report appeared during review; its frozen controls match the fixture, but I did not rerun that oracle.

Typecheck and the three focused simulation test files passed. Browser tests were inspected, not rerun. A stack-mass admission issue was fixed concurrently; I verified the counterexample now rejects. **I made no edits.**
