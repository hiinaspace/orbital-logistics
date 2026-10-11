# Bounded lunar return profiles

The user accepted continuous lunar ground service and requested a pass on curvy,
high-delta-v returns, prioritizing changing geometry and an active exhibit over a
fuel optimum. The existing synchronous Moon spin, 20° Northhaven pad and inclined
Crescent depot are unchanged. A second pad is deferred: longitude duplication does
not establish better plane access, and the current powered family itself causes
avoidable bending.

## Experiment and selection

The retained spike compares four exact saved flights from commit 6ffa245 against
60 combinations: departure offsets −0.024/−0.012/0/+0.012/+0.024 and coast 0/0.012/0.024.
Each trial is independently admitted by the canonical inertial Runner. A fixed 0.012
coast produced useful paths at nominal or slightly earlier departures in all four
witnesses. Larger coasts and later departures did not earn online search cost.
See astra-review.md and ../../evidence/lunar-return.md.

Production keeps nine steering/duration controls but splits the five directions
into two deorbit keys and three terminal keys. Deorbit consumes 20% of powered time,
then a 0.012-unit free coast, then the remaining 80%. Smooth spherical steering and
actual full binary gravity are unchanged; burn/coast boundaries split trial
integration explicitly. Powered duration is separate from elapsed duration.

Try the last accepted coast seed at the nominal departure (the original descent
seed before the first success), then the immutable original seed there when a
warm seed exists, then that cold seed 0.012 units earlier. Enforce depot service
completion. A good trial (delta-v <= 2.5 and summed steering turns <= 5.8 radians)
ends this bounded enumeration; remaining feasible trials rank by delta-v plus
0.08*turn and a small later-departure penalty. These are exhibit heuristics, not
a certified optimum or visual-quality measurement.

The shared coast-family allowance is 720 evaluations/3 million RK stages, with
360 evaluations per probe. Poor trials can be compared with the original
continuous-descent family. If shortlisted coast candidates fail canonical
admission, fall back to the old family rather than reopening the phased search.
Original-family fallback retains its 720-evaluation/3-million-stage allowance.
Failed probes debit work counters but never resources or accepted seed caches.
Canonical candidates are streamed one at a time, with all six-state captures,
continuous safety, reserve, actual tank law and resource transfers unchanged.

## Physical and drawing lifetimes

LunarWorld retains drawing data through the rolling history, but retires physical
runners of chunks whose end is strictly before the frozen planning frontier.
Retirement occurs at deterministic planning boundaries, preserves the last
canonical checkpoint used for extension, and retains the frontier-containing and
future chunks. Physical queries select only live owners and reject expired leases.
The full-trip target lease still agrees bitwise on/off the global grid.

Before each outbound/full-trip Runner construction, reserve a 64KiB fixed/event/
mutable-tail envelope and 512 bytes per ballistic target node. The target receives
its exact grid-node allowance plus one spare. Runner optionally accounts actual
node serialization incrementally before retaining each new node, reconciling the
previous head's event mutations first. The remaining byte allowance goes to this
node-insertion cap; canonical grid and the 32768-node work limit are unchanged.
The 64KiB envelope includes final head mutations that occur after the last insertion.
The worst-schema padded fixed envelope was 27,322 bytes; a five-key powered node was
1,984 bytes. Original program size is explicitly pinned.

This avoids both an oversized rejected Runner and a static worst-node reservation
that unnecessarily refuses valid flights. Actual aggregate serialization remains
an invariant check after execution; the stricter 32MB candidate gate refuses an
oversized result before publication. An exhausted private candidate releases its
owner before another candidate is tried.

This removes duplicate historical ephemeris storage rather than raising the 40MB
aggregate cap. Oldest/held display uses its retained drawing strips, never retired
physical runners. Admission still publishes a whole validated trip atomically.

## Evidence maintenance

spikes/lunar-return is a retained, bounded authoring experiment; baseline bundles,
comparison controls and path plots survive for the next review. Its trial shooter
is experimental and never imported by the app. Remove/replace these artifacts
when the return family is superseded, not as a runtime cache.

Reproduce the spike with scripts/lunar-return-experiment.ts and
scripts/lunar-return-paths.ts. Production regression uses evidence:lunar-service,
the updated independent DOP853 oracle (including continuous coast state/fuel),
canonical-step convergence, work/request partition tests and browser playback.
