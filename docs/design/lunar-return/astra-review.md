# Astra review: bounded return planning

2026-10-10. Read-only architecture/source review and calculations over the existing
four numerical witnesses; no new solver results are claimed here. This review is
for the accepted moving-Selene ground service and the next return-planning experiment.

## Recommendation

Keep the existing pad, depot, ascent and physical admission contract. First compare
several nearby departure times using the current return family against a small
**deorbit / coast / terminal braking** family. Choose among complete, physically
admitted programs using readable motion and service cadence; fuel is a useful
secondary discriminator. Ship only the smallest family/search change that visibly
improves the bad returns. Do not add a second pad or a general constrained optimizer
in this pass.

The current return is nine free controls for six terminal equations. Clearance and
adjacent-key turn penalties add constraints only when violated. Successful fitting
therefore leaves freedom to retain the seed's large steering excursions. Arrival
accuracy does not imply a readable or economical return. A structural coast creates
a useful different candidate family without changing physics or inventing guidance.

The current pad is already synchronous: its rate is 1, equal to the binary rate.
Across the witnessed returns it rotates only about 3.5–5.2 degrees. Its Moon-relative
tangential speed is about 0.0235, versus a local orbital speed scale around 0.75.
Fast Moon spin is not an explanation of these existing returns. The powered family,
seed branch and departure geometry are the first variables worth testing.

## Existing numerical evidence

Calculated from `docs/evidence/lunar-service-input.json`, first grid of each case:

| Occurrence | Return duration | Return delta-v | Sum of adjacent steering turns | Rising altitude sample intervals |
| --- | ---: | ---: | ---: | ---: |
| 0 | 0.061749 | 2.37115 | 340.31 degrees | 0 / 64 |
| 1 | 0.066067 | 2.53699 | 356.81 degrees | 0 / 64 |
| 4 | 0.090512 | 3.47566 | 388.86 degrees | 9 / 64 |
| 10 | 0.083814 | 3.21847 | 394.01 degrees | 0 / 64 |

The return delta-v equals roughly 38.4 times powered duration in this acceleration
capped fixture. Much of the opportunity may be removal of unnecessary powered time,
but lower delta-v alone must not be equated with a better visible flight. Even
monotonically descending flights have large steering excursions. These 65-point
altitude samples are shape diagnostics, not continuous safety proofs.

The retained full-calendar evidence reports 68 round trips, 71 refused attempts and
3.4 deliveries through epoch 64. Integer snapshots also contain several multi-unit
intervals without another admitted voyage, including epochs 58–61. At the default
0.01 rate one simulation unit lasts 100 seconds. Preserving only total delivery
count could hide long, visually quiet gaps.

## Bounded comparison

Use cases 0, 1, 4 and 10 as a paired experiment: same outbound, depot trajectory,
arrival stock and top-up, then vary the return only. Include later poor-service
phases before production promotion; the early four do not cover all 64 units.

1. Baseline: original departure and current full-throttle five-key return.
2. Timing only: a fixed small set of offsets around that departure, initially on the
   order of fractions of the existing 0.06–0.09 return time. Use absolute epochs and
   stable ordering. A phase root is a seed, not an acceptance condition.
3. Same timing set with one short deorbit arc, a bounded explicit coast and terminal
   braking. The proposed two-key deorbit / three-key terminal split and a fixed
   powered-duration fraction are reasonable first experiments. Try only a few fixed
   coast durations; fit durations and headings within the existing restricted domain.

Keep candidates inside the existing owned one-unit episode horizon, after completed
orbital service and before the paid landing plus its existing post-landing tail.
Do not extend the search or wait another orbit solely because that lowers fuel.
Only expand to another crossing if the first experiment demonstrates a meaningful
geometry or reliability benefit within the same bounds.

Measure and retain each candidate's physical result, departure delay, total trip
time, powered/coast time, actual fuel and delta-v, landing reserve, steering variation,
Moon-relative path/altitude trace, trial work and admission storage. Inspect the
trajectory and thrust direction separately. Late surface-relative lateral travel,
altitude reversals and excess path length are useful diagnostics; none is by itself
a sufficient aesthetic objective. A curved 3D path can be appropriate.

For the first production selector, prefer a small transparent rule over a weighted
fuel optimizer: require a bounded return time/dwell and physical feasibility, reject
clearly defined pathological low-altitude wandering if the experiment exposes it,
then compare a chosen shape measure within that activity envelope, using fuel and
stable candidate identity as tie-breakers. Select thresholds from the paired plots
and owner viewing, not from arbitrary universal notions of an ideal descent.
The experiment can keep a Pareto table instead of prematurely choosing weights.

## Curvature regularization

Do not append a nonzero smoothness cost to the current residual vector while keeping
the current norm-based convergence gate. That gate requires essentially zero residual;
a positive preferred-shape residual would prevent convergence, and a finite combined
weight can trade away terminal accuracy. Endpoint feasibility must remain distinct
from aesthetic ranking.

Candidate ranking plus a structural coast is the simplest useful remedy. If this
produces too little variety, the principled next experiment is a bounded secondary
step in the terminal Jacobian's null space, followed by projection back to endpoint
feasibility and canonical revalidation. Accept it only when shape improves and all
physical conditions still pass. That adds solver machinery and is not a prerequisite
for this pass. Unscaled sums of spherical key turns also penalize different key counts
unfairly and become especially misleading across an engine-off coast.

## Admission, ownership and determinism

- **Trial versus authority:** every complete winner still runs through the inertial
  canonical Runner. Preserve six-state capture, paid residual correction, continuous
  clearance, finite fuel/stock, return reserve and exact depot lease identity. Trial
  clearance samples do not replace canonical safety.
- **No free coast:** propagate the exact deorbit terminal state through both gravity
  fields to terminal-burn start. Mass stays constant during coast. Integrate and split
  exactly at arc/key boundaries. Do not restart at a fitted or displayed waypoint.
- **Pinned dynamics:** the trial code hard-codes normalized acceleration 1.2. The
  proposed full-throttle/coast family preserves its acceleration-capped domain;
  throttle/hardware generalization would require revisiting trial dynamics and domain
  admission instead of silently reusing that constant.
- **Memory:** old measured preparation peak is 39,448,182 bytes against 40 MB.
  Stream canonical candidates one at a time, retaining only compact immutable programs,
  metrics and provenance for contenders. Release the outbound runner when its necessary
  facts have been extracted. Do not retain winner and challenger Runner trees together.
  Reconstruct the selected program if necessary; account for that replay's work.
  Include rejected candidates, target extension and every overlap in peak accounting.
- **Resources:** freeze the starting stock/fuel snapshot for all comparisons. Commit
  exactly one winner's resources and accepted seed only after final admission. A rejected
  return does not debit or deliver anything; existing complete-trip atomicity remains.
- **Work:** retain per-shot caps and add an aggregate per-planning-attempt cap. Count
  failed finite-difference probes, line searches, abandoned families and final replays.
  Yield between bounded probes; never let measured wall-clock time change the winner.
  More candidates multiply latency even if memory is streamed.
- **Seeds:** freeze the candidate seed pool at attempt start. Enumerate cold reference
  and last accepted seed deterministically if both are used. Do not warm a sibling
  candidate from whichever candidate finished previously. Record family, departure,
  seed identity, durations and final controls. Update persistent warm seeds only from
  the winner. Current source uses the original for bootstrap and then the last accepted
  seed; it does not currently retain an original fallback for every later attempt.
- **Retries:** distinguish candidate refusals from whole-attempt planning failures.
  Try the bounded return alternatives against the same outbound before skipping an
  entire ascent window. Exhaustion advances the existing deterministic retry boundary;
  canonical identity, unsupported-domain and shared-stock errors remain explicit stops.
  Ensure a retry cannot rediscover the same exhausted set indefinitely.
- **Publication:** keep the canonical planning boundary frozen during all candidate
  yields. No losing candidate or partial top-up enters viewer packets. Keep the old
  held-cursor, resource and known-at contracts.

## Validation seams that need deliberate updates

The existing independent `lunar_service_oracle.py` assumes each arc after ascent
starts from the depot and ends in a pad capture. A two-arc return invalidates that
assumption. The oracle must carry state/fuel continuously across deorbit, coast and
terminal burn, and perform capture only at actual dock/land operations. Otherwise
it tests a different mission. It must continue propagating the depot independently
from its original epoch-zero state.

Current flight witnesses probe individual powered arcs. Add the intervening coast,
its event-left/right boundaries and close-to-surface portions to oracle, convergence
and display-error probes. Existing 4096-per-unit coast drawing samples may suffice,
but their half-pixel claim must be remeasured for the new coast rather than inherited
from an attached orbital dwell. Keep 65536-per-unit powered sampling bounded, with
exact start/end and landing events represented.

After choosing a family, require:

- Identical accepted programs, resources, failures and winning candidate IDs for
  budget 1 versus 128 and small versus large advance requests, including a failed
  first candidate and seed fallback.
- Canonical/oracle and parent-step agreement for an ordinary return, a difficult later
  return and an approach near the new shape/clearance bounds.
- Full-calendar conservation, minimum reserve, failure reasons, maximum idle gap,
  trips/deliveries, solver work, and aggregate physical/view storage.
- Browser timing at the existing maximum speed, including minimum playback lead,
  plus coast/start/end/pause/rewind/frame checks. The present 0.1 lead may be consumed
  by a much larger candidate search even when all numerical gates pass.
- Owner viewing of side-by-side representative motion; automatic path metrics do
  not establish aesthetic acceptance.

## Second-pad decision

Defer it. A second pad adds origin/return identity, distinct stocks, a ground-state
checkpoint at the actual landing pad, subsequent departure policy and different seed
histories. The current engine hard-codes Northhaven attachment after every mission;
changing a target ID alone is not a safe extension. A second longitude also does not
necessarily solve the inclined depot's plane/latitude mismatch.

If bounded timing/profile search still gives unacceptable waits or returns, compare
alternate pad geometry offline at those exact bad phases first. Consider two pads
only when that controlled comparison shows a visible cadence/approach benefit. At
that point use one vessel and explicit per-pad stocks, return identity and dispatch;
no new fleet or general route system is needed.

## Follow-up on the first 60-candidate spike

Reviewed the implementation owner's `spikes/lunar-return/comparison.json` and the
257-point canonical paths in `spikes/lunar-return/paths.json`. These are the owner's
new integrations; the following geometry calculations were independently derived
from their saved paths in this review. They are still four paired occurrences, not
an online/full-calendar or independent-oracle acceptance.

A fixed 0.012 coast succeeds at nominal departure for occurrences 0 and 10 and at
nominal minus 0.012 for occurrences 1 and 4. Nominal plus 0.012 fails for all four.
That supports an even smaller production trial: **nominal phased return, then the
one earlier phased return, then nominal original-family fallback**. Stop at the
first physically admitted candidate satisfying the chosen narrow shape/time domain.
There is no current evidence requiring an online 15-candidate ranking search or the
later offset. Add either only if later phases expose a specific unmet need.

| Occurrence | Old / phased delta-v | Old / phased path turn | Old / phased path length, Moon radii |
| --- | ---: | ---: | ---: |
| 0 | 2.37115 / 1.95409 | 183.9 / 167.2 degrees | 0.9463 / 0.9634 |
| 1 | 2.53699 / 2.15643 | 208.5 / 180.9 degrees | 0.9702 / 1.2161 |
| 4 | 3.47566 / 2.47479 | 362.2 / 225.0 degrees | 1.5666 / 1.4600 |
| 10 | 3.21847 / 2.17726 | 322.0 / 200.7 degrees | 1.2542 / 1.0360 |

Here path turn sums angles between consecutive displacement segments in the
translating unrotated Moon frame; it is not accumulated thrust steering or an
attitude requirement. It is sample-resolution dependent and diagnostic. The old
occurrence 4 has 33 of 256 rising-radius intervals; its phased counterpart has none.
Occurrence 1 gets a longer path despite lower delta-v and less bending, so the owner
still needs to view that tradeoff. Compared with the actual saved old programs,
delta-v reductions are approximately 17.6%, 15.0%, 28.8% and 32.4% respectively.
Do not use re-solved nominal candidates as an unlabeled substitute baseline.

Keep a separate accepted warm seed for each family, plus immutable original/cold
reference. Freeze both at planning-attempt start, deduplicate identical seeds and
try them in a documented stable order. The four spike cases seed from their
individually accepted historical flights; they do not establish that a sequence of
new phased winners will remain on a good branch. The full online rollout with actual
seed succession is therefore the decisive next technical gate.

## Integration follow-up: retiring completed depot physics

The proposed `LunarWorld.retirePhysics(frontier)` at the deterministic start of a
planning attempt is architecturally sound. Retire only complete chunks whose end is
strictly before the frozen frontier, preserve the chunk containing the frontier and
all future owners, and keep their immutable drawing data through the normal history
cutoff. Every new plan's physical query/lease starts at or after its episode epoch,
which is at or after that frontier. Historical `current()` and anchor presentation
already consume drawing samples, not the old depot Runner.

Preserve the final canonical `#state`/`end` used to extend the world; never reconstruct
that state from retained drawing data. Update physical byte/node totals only for
actually live owners. `state(t)` must find a live owner or explicitly reject a retired
lease; it must not silently interpolate a physical result or accidentally select a
retired chunk at a shared boundary. Keep the independent drawing retention/allocation
bounds unchanged. This is removal of redundant historical physics, not relaxation
of the 40 MB physical admission ceiling.

The focused gate is a retired versus unretired world: save historical drawing and
held-cursor results, retire, prove those results unchanged and physical ownership
reduced, reject an epoch belonging only to a retired owner, then compare current and
future grid/off-grid states and an actual episode lease bitwise. Cover exact chunk
boundaries and repeated retirement. Request/work partition invariance still applies
because retirement occurs only at the same planning boundaries.

The integrated return implementation preserves separate family seeds and commits
only the winner. Its shared coast budget is explicit. One narrower behavior should
be documented or improved: trial-quality early exit occurs before canonical admission,
so if that single phased candidate fails physical reserve/clearance/storage admission,
the engine can go directly to the original-family fallback without trying unused
cold/earlier phased attempts. This remains physically safe, but it is not equivalent
to first *physically* admissible phased candidate selection. Record canonical refusal
reasons so a later service-gap regression can distinguish these cases.

The upgraded independent oracle now carries deorbit terminal state and constant coast
fuel into terminal braking. Its clearance witness must also include the coast; the
reviewed minimum-clearance assertion still covered powered pieces only. Canonical
Runner safety remains authoritative, but the independent witness should cover the
new free-flight segment explicitly.

## Allocation reservation review

The later diagnostic identified a refused pathological return allocating a 44.7 MB
candidate (32,768 ship nodes plus 5,822 target nodes), rather than historical world
ownership being the main cause. Retiring redundant physics is still valid, but cannot
by itself bound such a candidate.

The new per-Runner node reservation is the right remedy for this narrow domain.
Runner checks its node quota before each retained-node push, including recursive
clearance subdivisions. Reducing the quota changes which candidates may finish; it
does not coarsen the canonical step, reduce safety checks or relax captures. A
work-limit candidate must refuse and allow the bounded fallback/retry policy.

Source inspection and serialization probes support the proposed 2400 bytes per
ship node, 512 per ballistic target node and 64 KiB fixed envelope for these generated
programs. A five-key powered snapshot with every numeric field replaced by the
25-character JSON number `-0.0000012345678901234567` serialized to 1984 bytes. A phased
three-arc bundle with its 17 ledger rows and 10 event boundaries, padded the same way,
serialized to 27,322 bytes before adding the small ballistic target fixed envelope.
The unpowered target node was 334 bytes with slightly shorter 24-character numeric
padding. These are structural serialization probes, not JavaScript heap measurements
or a general schema-wide memory proof.

Pin the reservation's domain explicitly: original/bootstrap ascent and source seeds
must have the expected arc count and at most five steering keys; generated operations,
IDs and the two-port structure stay bounded. General schema validation permits up to
64 steering keys, while the reviewed `validateLunar` did not itself pin the source
program's steering shape. Passing only `Scenario` to the reservation helper cannot
establish that program-side condition. Keep the measured post-allocation checks as
invariants even after pre-reservation.

The target's grid-node count plus two is supported by the world's existing exact
4097-node-per-half-unit invariant and global-grid lease matching. If target safety
subdivisions ever invalidate that property, fail explicitly rather than silently
changing the target budget or reconstructing it from samples.

Required regression: preserve the exact bad epoch/candidate, demonstrate canonical
work-limit refusal below the reservation, then successful bounded fallback or retry
without crossing the 40 MB aggregate cap. Also validate a normal phased winner and
original-family fallback against unchanged numerical/oracle controls.

## Revised reservation: count actual retained node bytes

The static worst-case-per-node quota was too conservative for service activity:
valid flights mix small attached/coast nodes with large steered nodes, and the first
valid occurrence alone needs 15,311 ship nodes. Replace that quota with the reviewed
optional preparation-only `Runner` byte allowance, while restoring the original
32,768-node ceiling and retaining the same canonical step/subdivision tolerances.
This supersedes the static ship-node reservation recommendation above.

The implemented `#retain(next)` accounting is structurally correct: before each push
it settles the previous last node's current serialized size, then charges the new
node and separator. Only the latest node changes during event handling; earlier
states and shared mass-law anchors are immutable. The initial node is settled at
the first push. The no-option Runner path keeps its previous behavior. JSON/UTF-8
work remains linear in retained node count rather than repeatedly serializing the
whole growing tree.

One detail is essential to the bound: event handling and grid-index increments occur
*after* insertion and may enlarge the new last node, particularly at thrust start.
A run may stop or reach its horizon without another push to settle that growth.
Therefore the insertion allowance requires a separate mutable-last-node envelope;
it is not itself an exact hard limit on the final nodes JSON. The lunar caller's
64 KiB reservation covers the measured approximately 27.3 KiB fixed ship envelope,
small fixed target data, final-node growth and refusal events in the pinned domain.
Make that ownership explicit in comments, or subtract a separately named 2400-byte
mutable-tail reserve for clarity. Retain measured complete-tree/aggregate checks.

Acceptance should exercise a cap just before thrust start, a cap in pathological
terminal safety subdivisions, and ordinary limited versus unlimited successful
trajectories. Check both accepted and refused results under different advance/query
partitions. The exact failing candidate must refuse before crossing the aggregate
allowance and allow fallback/retry; normal service needs the full-calendar cadence,
latency and numerical gates. With these checks, the actual-byte cap is a better fit
than a static worst-node charge and introduces no new trajectory approximation.
