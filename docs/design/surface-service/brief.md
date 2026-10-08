# Continuous airless surface service — verified design brief

2026-10-08, owner gpt-6.1-sol. User accepted finite landing, explicitly asks continuous
surface service and reversed/thrust-scaled future whiskers. Earlier authorization:
use Astra senior reviews for consequential architecture forks. Solo local prototype;
not an enterprise scheduler. Watching is sufficient. 3D viewer, atmosphere, hull
contact, stages, demand routing and general targeting stay deferred.

## Environment and verified facts

| Item | Verified owner evidence |
|---|---|
| Checkout | /home/s/code/orbital-logistics, natto, branch codex/model-set-viewer, HEAD1e77eb27babe4b360aba69fc4487c19642bc0118, no remote, clean before this brief |
| Reviewer transport | Codex CLI0.153.4; run read-only gpt-6-astra/xhigh, verify header/exit before reading |
| Baseline | Prior slice115 sim/16 production browser, three-step independent landing oracle; docs/evidence/surface-landing.md. Not rerun this turn yet. |
| Existing runtime | src/traffic/{planner,engine,view,resources}.ts; finite local Runner owns physical episode, fleet owns global resources/services/commits.128 history,1/16 drawing grid, one bounded worker request, held-head Pause/Play/Live. |
| Existing dispatcher restrictions | Fixed mu1 origin primary, two XY prograde circular ports, dry1/ve3/thrust1 uncapped,2 arcs per template. Calendar1m. nextWindow uses relative rail rate, integer synodic index. |
| Existing fleet arrival | Commits only dock; source departure emits synthetic undock; source episode has no attachment operations. Arrival commits paid usage once, advances route, starts service. |
| Existing display | Actual1/16 frames; projected episode1/32 samples. Too sparse for close surface zoom. Surface view only enabled for finite set loading. One hardcoded continuous definition and restart ID. |
| Valid surface witness | fixtures/model-sets/selene-return.json. Fixed mu=R=1, padR+1e-6 spin.003, depotR1.25/rate.7155417527999327. Outbound .3→1.7207514043249135,8 arcs; cargo.1/fuel1.4. Return7.829865668956577→9.986868695074584; coast then8 arcs; cargo.05/fuel1.1492926425505117. |
| Landing contract | schema3/surface-ports-v3 explicit land, full3D envelope min(configured position,actual clearance/4), paid exactrocket residual. land forbids simultaneous impulse/new arc/other ops except one same-pad transfer; ending thrust allowed. Old surface dock exact initial epoch only. |
| Launch contract | launch requires attached state, ended service, first arc at exactepoch with outward acceleration; statically rejects any other operation at that epoch. Physical pad spin inherited, guards unchanged. |
| Local time | Schema epoch can be negative. Runner grid is anchored at scenario epoch; exact local event timestamps must survive global translation. |

## Proposed bounded extension and open forks

1. **Restricted surface template domain.** Keep old orbital mode exact. Add an explicit
   traffic domain/discriminator for this fixed airless pad+circular depot world,
   dry1/ve3/force5/cap3 and eight arcs. Surface departure first arc starts0; orbital
   return can coast first. Frozen loadouts and existing phases. nextWindow generalizes
   to circular/surface rail rates and source-rate rotational symmetry. Revalidate each
   episode from actual serviced loadout, certificate/capture+1e-8<1e-7 and reserve.05.
   Reject generalized ballistic/maneuvering targets and arbitrary launch solvers.

2. **Surface departure attachment seam (highest uncertainty).** Lean a documented
   local support prelude: local epoch=-h, exact initial dock at-h, launch at0. Both
   have actual serviced cargo/fuel already; no local transfer or replenishment.
   Source rail local phase equals global departure phase, state at-h is analytical
   supported COM; by0 it reaches actual global departure state. Exclude negative-time
   initialization from fleet facts/forecast/berths; the fleet already owns attachment.
   Only Runner launch and thrust-start at0 become fleet departure facts, no synthetic
   undock for surface. This reuses unchanged launch physics/schema. Alternative adding
   initialAttachment to canonical schema/Runner gives a cleaner abstract boundary but
   incurs version/replay surface area for one adapter; later launch as positive local
   time would move the global departure epoch and complicate windows. Reviewer may
   prefer a different concrete seam; do not silently bypass launch with a free start.

3. **Arrival and resources.** Treat dock/land as arrivals; exactly one paid usage
   commit, one berth, then fleet-owned service. No local transfer in episodes. Initial
   fleet surface berth remains an initial dock fact. Ship returns with about.08fuel,
   next service refuels to1.4; explicit finite external fuel flows and cargo flows
   sustain watching. One Swift first, not simultaneous rockets/pad reservations.
   Shared inventory/shortage/retry/fault semantics unchanged. Consider second ship only
   if it adds evidence without berth/scheduling expansion; lean one to bound slice.

4. **Close drawing versus bounded history.** Do not change physical grid or retain
   dense actual fleet frames forever. Lean keep bounded dense disposable episode
   samples (2048/unit,16k/episode,32768? total budget must account128history), with
   exact local/global event boundaries. At cursor, overlay committed flown portions
   from episode records onto coarse actual frames, including during historical
   scrubs, using only admitted plans; truncate at fault and use actual fault endpoint.
   Source record exists until arrival<history cutoff. Predict and executed episode
   same Runner in production; tests inject faults. Alternative increase whole fleet
   drawing grid to1/2048 explodes history/main packets. A compact segment representation
   or query-driven zoom refinements might be better but should be sized to this slice.
   Surface world angular speed and1e6px zoom need full-flight interior/frame evidence.
   Need explicit total retention/node/sample/packet/render cost budget, not only count
   of episodes. This may overlap the episode ownership decision; merge if appropriate.

5. **Canonical/global event precision.** Retain local events. localAt should include
   operation epochs, original thrust/cap events and exact arrival. Avoid t=global-local
   round trips losing exact touchdown. First support sample atnegative epoch must not
   leak into public chronology. Late-window tests atindex1/64/10000, three numerical
   steps plus independent DOP853; same controls/loadouts. Retain calendar1m ceiling.

6. **Whiskers (independent reversible UI).** Reverse tips along projected thrust
   direction to agree with existing exhaust schematic. Bound screen-space length
   with small positive visibility floor + nonlinear thrust/engineMax ratio, e.g.
   3+15sqrt(clamp(F/Fmax,0,1)) px; zero no whisker. Compute actual F at sampled epoch,
   including acceleration-cap taper and throttle. Same selected-route/layer semantics,
   anchored arc samples; no extra physics. Need direct direction and varying-length
   browser assertions plus screenshot; final taste can be user feedback.

## Admission and depth budget

Recommend concrete minimal contract and prioritize forks by leverage. Verify code
claims with focused reads/probes, not full historical suites. Bound review to these
seams (roughly10k reasoning tokens, concise report); no web, subagents, dependency
installation, broad rewrite or implementation. Read-only sandbox. Do not re-review
accepted propulsion/landing numerics or suggest another product direction.

Owner may implement independent whisker change while you review architecture. Main
will spot-check load-bearing findings and record adopt/adapt/reject disposition before
traffic engine changes. No required human decisions currently known.

Gates: repeated launch/land and local/global event order; no negative prelude facts or
free launch; atomic finite service/resources/conservation, shortages retry, paid fault
isolation; partition/display-query invariance; historical plans known at cursor only;
close interpolation and event sides even at late epochs/aftereviction; bounded soak
including dense sample/delta/main retention and actual render/packet cost; later-window
independent3-step/DOP853, original Orison regressions; production browser continuous
surface play/pause/rewind/Live/Restart/frames/layers/closeview/set switches.
