# Aster–Selene crossings

The accepted single continuous expedition remains available. A separate
`apollo-fleet-v1` exhibit adds Argosy from Farpoint and the local orbital craft
Wren. Odyssey and Argosy share one compiled mission; each owns its tank, consumed
fuel and funded ground turnaround. One fleet owner publishes the shared clock,
resource anchors and events.

## Authored overlap

The admitted phases are exactly 0 and 1/2. With relative Moon/pad period T,
Argosy starts at delayδ=T/2=51.69265824. Its trajectory rotates by
β=ωMoonδ, plus the existing indexed recurrence angle. Farpoint is antipodal
to Cairn: its planetary pad phase advances by (ωMoon−ωPad)δ=π.
The global body rails and atmosphere spin stay unchanged. Beforeδ, Argosy
is supported and selectable at Farpoint with full seeded fuel and zero usage.

Exact global indexed thresholds restore canonical local epochs before querying.
This includes physical boundaries, steering arcs, entry/braking, recovery/fade,
transport and refill. There is no epsilon snapping. Actor/cycle control and
event IDs are unique; canonical home-port IDs remap to the actor's own pad.
Physical and drawing queries use the same schedule adapter while retaining
different providers.

Both vehicles visit Tranquility. Admission checks the half-open lunar
[landing,liftoff) intervals over neighboring periods. Each stay lasts 2 units,
well below their 51.69-unit separation. Shared berths are certified by the
authored timetable rather than allocated by an online optimizer.

The fleet preflights all due refills in chronological order. Every import/debit
is assigned to its recipient and home pad; all facts publish together. Warm
advances are bounded to 8 units (the first initialization can advance 32).
The maximum calendar remains 1,000,000; future resource forecasts do not mutate
actual stocks before the common head reaches an event.

## Local motion

Wren is a passive low-orbit craft with a slightly inclined initial state. It
propagates under both actual gravity sources; it never resets to an approximate
circle or performs an uncharged capture. Eight-unit canonical Runner chunks use
h=1/256 and carry exact physical endpoints into their successors. The planetary
exclusion radius expands to atmospheric top for vacuum admission, preserving
gravity and the rendered body radius.

The worker retains canonical chunks covering the actual head through its 32-unit
forecast. Older physics is evicted, while 32 Hz disposable display history retains
the 128-unit rolling window and its bracket. A local fault preserves the actual
prefix and last known marker; later physical/frame queries reject. The independent
expeditions continue. This does not certify indefinite orbital survival.

## Worker and view

Both actor stores share one display template. The worker builds global rotated
cycle strips privately before publishing; subsequent packets contain only newly
needed strips. Frontend stores require prepared rows and reject a missing strip.
They verify actor/template/index ownership and assemble the retained window
without rebuilding or reserializing strips. Sent-index tracking is evicted with
the cache. The common forecast end is head+32 for every actor.

Worker and frontend caches have separate aggregate 72 MB strip ceilings. Each
owner also enforces sample and assembled-view bounds. Local physical ownership
is included with the Apollo cache in 115,000-node/40 MB guards. Initial packets
are bounded to 32 MB; warm packets to 12 MB. One outstanding viewer request limits
the pending clone and held-head extension. These serialized-byte counters bound
ownership; they are not browser heap measurements. Initial template copies,
both strip owners, the pending reply and disposable assembly coexist, so peak
whole-process memory is larger than any one counter.

Hidden ground transport breaks paths and hit targets independently per actor.
Camera presentation blending stays separate from physical frames. Timeline,
entry/surface inspection and the planet–Moon rotating frame remain shared.
A coast approaching splashdown now says “Returning · Aster” instead of an
undefined station destination.

[Source review](astra-review.md) and [evidence](../../evidence/crossings.md)
retain the numerical, playback and performance gates. Libration stations and a
separate staged mission remain subsequent slices.
