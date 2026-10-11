# Lunar rolling-history freeze and trail fade

The owner reported a frozen scene with responsive buttons but a stationary camera.
The failure reproduced at worker frontier 1.765625, viewer cursor 1.665625 and oldest
retained epoch 1.015625. A retained trip still exposed its earlier event ledger.
Timeline assembly queried the old Crescent dwell at 0.684674237, while Crescent's
retained drawing coverage began at 1.0. The strict provider correctly threw
'Display target epoch outside validity'; the uncaught timeline exception stopped the
animation callback chain. Planning physics and stock accounting had continued normally.

The lunar view now exposes only samples, event sides and ledger events inside its
retained/forecast window, with an exact retained anchor at the left edge. Timeline
assembly also limits event breakpoints to that visible window for every set.
Provider validity stays strict; no clamping or invented target pose masks the error.

The trail fade previously used a four-unit decay against only 0.75 units of retained
lunar history, so the old tail remained bright until eviction cut it off. Opacity now
scales to visible history and tapers smoothly to zero over its oldest fifth. Physical
history and scheduling are unchanged.

Regression gates:
- the exact rolling-history failure is covered by actual timeline midpoint queries
  throughout a two-unit rollout with a lagging live cursor;
- a separate eight-unit probe completes those queries through repeated evictions;
- held pose/stocks, lease identity, scheduler partition invariance and supply refusals
  still pass;
- opacity is zero at/beyond eviction, monotone with age, and consistent under a
  short-history time rescaling;
- the browser run extends beyond the original freeze and verifies camera drag,
  pause/rewind, reference-frame changes, Return to live and set switching.

Seven targeted simulation tests pass. The production browser ran 105 seconds near
0.02×, crossed the original freeze epoch, and passed camera drag, held pose, rewind,
all reference frames and set switching with no page errors. The finite moving-Selene
browser regression also passed. The production browser evidence is recorded in
[lunar-service-browser.json](lunar-service-browser.json) and
[lunar-service-local.png](lunar-service-local.png).
