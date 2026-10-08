# Bounded lunar freight experiment

Authorized after the spatial foundation gate passes. 2026-10-08.

First demonstrate free-flight rendezvous in the existing synthetic binary, rather
than widening docking first. Target is the accepted burn-free DRO; departure family
is a planet-centered r=.5 osculating circular orbit at initial phases0,pi/2,pi,3pi/2.
Departure t=.5; flight durations2.5,3,4,5:16 seeds. At most64 coast evaluations per seed,
damped two-velocity shooting in the XY plane, independent DOP853. Seed velocity is
osculating departure velocity plus a prograde Hohmann-sized estimate; this estimate
does not select an unverified physical route. Bound departure delta-v to1.2, total
delta-v to1.6. Ship dry1/cargo.16/fuel.9/exhaust3; budget requires at least.05 remaining.
Minimum surface clearance.03 at both sources. No general spatial/multi-body solver
claim; offline bounded authoring only.

Success: both target and visitor independently propagated and tightened; explicit
paid Cartesian departure and matching burns; canonical RK4 h/h2/h4 agrees before
capture; survive at least.75 after arrival. A converged co-located free-flight pair
is an honest intermediate result. If no seed succeeds, report the searched domain;
do not infer global infeasibility. Attempt this before using an inclined fixed-primary
fallback. Only extend docks after this result supports safe burn-free ballistic
station ephemerides, finite validity intervals, paid residual capture and undock continuity.

The first search found seven paid free-flight witnesses. After canonical validation,
the return experiment takes the three lowest-cost outbound witnesses and searches
16 returns each: wait.5,1,1.5,2 after arrival and flight2,2.5,3,4, at most64 evaluations
per seed. Targets are their original burn-free planet-orbit carriers propagated over
the full horizon. Unload at the DRO, explicitly refuel to.85 from finite station stock,
then require return total delta-v≤1.6 and at least.05 fuel. These are48 bounded return
seeds, not a global route/launch-window optimization. Only complete trips become content.
