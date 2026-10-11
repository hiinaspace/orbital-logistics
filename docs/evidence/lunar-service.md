# Continuous moving-Selene ground service

This records the original continuous-descent baseline. The current return profile,
rollout and numerical/browser artifacts are described in [lunar-return.md](lunar-return.md);
the retained original rollout and saved bundles are in spikes/lunar-return.

Set: **Selene · Lunar ground service**. Northhaven is on the moving Moon at 20° north;
Crescent is an evolving inclined ballistic depot. Tern solves each occurrence online,
delivers 0.05 supplies, refuels from explicit depot stocks and lands with paid bounded
thrust. This is separate from the accepted finite Northern ground service exhibit.

## Full-calendar rollout

The production engine completed its 64-unit calendar with **68 complete round trips**
and **3.4 supplies delivered**. There were 71 refused planning attempts; each retained
the ship and stocks and retried a later window. Minimum accepted return fuel was
0.123253, above the 0.1 reserve. The final admitted ship returned before the explicit
calendar stop.

The evidence checks every 1/64 unit:
- total fuel, including ship consumption, external replenishment and capacity exports;
- total cargo, including delivery, import and depot consumption;
- six-state capture tolerances and actual landing status;
- bounded physical owners, view history, sample counts and serialized packets.

Measured maxima in the final run:
- 39,448,182 bytes of physical ownership, including rejected candidate preparation;
- 25,711,484 bytes of retained drawing packets;
- 9,010,601 bytes in one reply;
- 39,662 retained ship drawing samples.

Ceilings are 40 MB aggregate physical ownership, 32 MB per admitted candidate,
36 MB held drawing history and 60,000 retained ship drawing samples. These byte
counts serialize diagnostic data and do not measure JavaScript heap.
The rollout took about 195 seconds on natto; no wall-clock deadline influences
physical admission or scheduled epochs.

At the default 0.01×, the validated calendar lasts about 107 minutes. Maximum speed
is 0.02×. The viewer retains 0.75 units of rewind history and a 0.1-unit playback lead.

## Numerical witnesses

The reproducible command is **npm run evidence:lunar-service**. It writes
[lunar-service-input.json](lunar-service-input.json),
[lunar-service-rollout.json](lunar-service-rollout.json), and the independent
[lunar-service-oracle.json](lunar-service-oracle.json).

Four admitted occurrences include the actual second sortie and later phases beyond
epochs 2 and 6. The independent inertial DOP853 oracle starts the depot at its original
epoch-0 state, propagates both gravity fields, derives the moving pad independently,
executes the spherical steering law and mass flow, and charges capture corrections.
The second trip also has 1/4096, 1/8192 and 1/16384 parent-step witnesses, while its
depot retains the canonical 1/8192 grid. The coarser diagnostic extends only its
post-landing attached horizon to meet duration/grid admission; controls and events
are identical. These offline diagnostics are separate from production storage limits.

A second independent DOP853 integration covers the depot through the entire calendar
and compares every recorded integer checkpoint. Target safety, terminal captures,
flight state errors and stock/fuel balance are executable oracle assertions.

Production-grid witness maxima were 2.13e-11 ship position, 1.08e-9 velocity and
1.39e-10 fuel error. The second trip's maximum velocity error fell from 2.28e-9
at 1/4096 to 8.94e-11 at 1/8192, with an 8.37e-11 floor at 1/16384.
The full-calendar depot comparison measured 2.86e-10 position and 6.21e-9 velocity
error; its minimum Moon clearance was 0.0096944.

Actual global-grid episode leases are checked bitwise at every checkpoint plus
off-grid probes. Trial equations and disposable drawing samples cannot become
physical target or restart states.

At the maximum camera scale 1e6, the sampled off-grid flight drawing error was
0.00161 px and depot drawing error 0.129 px, both under the 0.5 px gate.

## Scheduler and viewer gates

The full simulation regression run passed 224 tests. The final five targeted lunar
tests passed after the last accounting changes, including the added supply-refusal
case. They cover unsupported domain inputs, depot allocation, canonical lease
identity, large versus small time advances, work budget 1 versus 128, cumulative
deliveries, preserved ground fuel, held pose/stocks, later steering IDs and conservation.

The initial production browser test passed 60 seconds near 0.02× with no page errors or
simulation stops. Its minimum recorded lead was 0.0693 units (about 3.5 seconds at
that rate); the ship completed repeated delivery/return cycles while planning ran.
Pause preserves the exact pose; rewind and inertial/rotating/depot/ship/body frame
changes preserve physical state; Return to live resumes; switching among finite
Selene, continuous district and lunar service succeeds.

The finite moving-Selene browser regression and the district/northern-atmosphere
browser regressions also passed. They cover the prior local surface camera,
non-equatorial landing, atmospheric staging and ocean recoveries.

[Browser observations](lunar-service-browser.json) and
[local view](lunar-service-local.png) record this pass.
[Astra review](../design/lunar-service/astra-review.md) records architecture findings
and their disposition. Owner viewing remains the aesthetic acceptance gate.

[Rolling-history follow-up](lunar-history.md) records the later timeline freeze,
retained-window clipping, fade correction and extended browser regression.
