**Hold continuous release for one reproduced P1 defect.** Review stayed read-only, within the eight-file scope plus relevant main integration; no delegation.

**P1 — Pausing across a cycle boundary permanently loses required drawing data.** [store.ts:13](/home/s/code/orbital-logistics/src/compact/store.ts:13) prunes incoming cycles against the held window, while [engine.ts:35](/home/s/code/orbital-logistics/src/compact/engine.ts:35) considers those cycles delivered and suppresses retransmission.

Reproduced against the latest source:

- At frontier **111**, retained window is **15–143**.
- The pending reply advances to **112**, introducing cycle **2**, starting at **144**.
- Held ingestion discards cycle 2.
- `release(); view(80)` throws **“Missing prepared compact drawing cycle”**.
- The next reply throws **“Missing compact cycle coverage”**.

This is reachable by pausing with a worker request outstanding, then selecting Live. Preserve the incoming row in a bounded pending slot until release, or explicitly arrange retransmission before expanding the visible window. Add this exact boundary-crossing regression; the existing 2048→2049 held test misses it.

Verification otherwise supported the numerical claims: native/oracle position disagreement **1.80e−11**, velocity **4.77e−12**; event-time fuel/cargo balances within **3.56e−15 / 2.78e−17**. The simulation test command passed. The calendar-limit row also built successfully after a concurrent source change.

The inspected browser log failed at slider automation before completing held/reverse/set-switch checks; that is incomplete evidence, not an additional demonstrated application defect. Require the boundary regression and completed browser gate before shipping continuous playback. No second concrete blocker found within scope.
