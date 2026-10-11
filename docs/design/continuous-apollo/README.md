# Continuous Aster–Selene expedition

One Odyssey repeats the accepted atmospheric planet–moon mission. The finite
exhibit stays available. The new `apollo-continuous-v1` wrapper compiles that
mission once in the simulation worker, then reuses its admitted physical cache.
This is authored recurrence in a symmetric world, not a general mission planner.

## Reuse contract

The admitted world has a fixed primary at the origin, a prescribed circular Moon,
equatorial planetary support, synchronous lunar support and atmosphere rotation
about Z. The relative Moon/pad period is

`T = 2π / (ωMoon − ωPad) = 103.38531648187275`.

At indexed trip `k`, the source epoch is shifted by `k*T` and all position,
velocity, thrust, steering, attitude and aerodynamic vectors rotate by
`k*ωPad*T`. World rails keep their original absolute-clock definitions.
Every index is calculated from the absolute epoch; repeated additions are avoided.
The wrapper refuses unsupported symmetry, insufficient turnaround and insufficient
ground supply before publishing a ready packet.

The worker queries the original canonical trajectory and exact boundary sides.
The viewer queries the original display template through the same schedule
adapter. Drawing never becomes a physical restart or targeting input. Recurrence
dispatch precedes generic single-entry/recovery overrides, so scrubbing an older
trip cannot accidentally use the current trip's recovery metadata.

## Turnaround and resources

After water recovery, Odyssey stays supported at the recovery pose. It fades out
between recovery+1 and recovery+2. Ground transport is hidden; at recovery+4
support ownership changes atomically to Cairn. The ship fades in on the pad from
T−3 to T−2. There is no rendered flight between ocean and pad.

At T−2 the standing ground supply imports exactly the measured fuel deficit,
then debits it into the supported ship in one transaction. The fixture permits
at most 4 fuel units per turnaround; the measured deficit is 3.88467907687.
Remaining tank fuel is carried through ground transport. Lifetime consumed fuel
continues accumulating; tank level steps at the explicit refuel boundary.
Resource anchors and events commit together. This witness carries no freight.

Cycle-qualified event IDs preserve separate trips; milestone labels remain
human-readable. Exact event-left/event-right pairs also become drawing samples
at their indexed timestamps, preserving the fuel chart's discrete refill.

## Playback and storage

The existing Live/Pause/Play controls apply. The engine keeps 128 units of rolling
history, 32 units of committed lead and a resource anchor preceding eviction.
A held cursor retains its display history through an outstanding worker reply;
returning to Live releases it. The template is sent once, with compact later
worker packets. One bounded request remains outstanding.

The view caches at most four rotated cycle strips for this fixture, with guards
on 120,000 retained samples, 36 MB serialized retained strips and 110,000 assembled
drawing samples. The physical template has independent retained-node/byte guards
from finite preparation. Hidden transport breaks trails and has no glyph/hit
target. Camera tracking may blend its presentation origin during reappearance;
physical frame transformations always use physical state. A hidden ship-centered
frame falls back to inertial while preserving the camera's world position.

A finite admitted calendar ends at epoch 1,000,000 with an explicit halt. The final
partial view is clipped there. An advance rejects nonfinite, backwards,
over 4,096-unit or over 64-operation requests without partial resource mutation.

## Validation

[Astra review](astra-review.md) records architecture findings and their final
source disposition. [Evidence](../../evidence/continuous-apollo.md) records
long-run accounting, retention, independent absolute-epoch numerical replay and
browser behavior. The initial authored mission is still the source of powered
flight, capture and atmosphere admission.
