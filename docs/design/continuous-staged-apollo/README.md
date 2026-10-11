# Continuous staged expedition

`staged-continuous-v1` wraps one admitted `staged-apollo-v1` compilation. It does
not use the single-ship expedition schedule: Atlas, Odyssey and Eagle retain
three persistent hardware identities, three tanks and two separate recoveries.
The retired launch stack is an assembly glyph, never a fourth inventory.

The frozen mission rotates by the relative Moon/Cairn period. World rails stay
on their original global clocks. Canonical queries and disposable drawing queries
share the indexed calendar adapter; positions, velocities, attitude, thrust and
all aerodynamic vectors rotate together. Every local physical seam is mapped by
an indexed epoch. Period, reassembly and refill seams use `(index+1)*period`
directly so cancellation cannot change their event sides near the calendar end.

Visible flight follows the finite ownership intervals. Attached Eagle remains
inspectable at its carrier's actual pose and retains its own residual tank.
Attached drawing queries use the carrier's dense history; protected child fuel
stays child-owned, while pre-split booster fuel follows the active stack tank.
Atlas and the returned Odyssey/Eagle assembly fade after their own recoveries,
then have separate supported ground transport at recovery+4. Hidden ground
transport changes physical support at an explicit boundary; `frameOrigin` holds
the recovery pose and blends toward Cairn during stack reappearance, so camera
following does not inherit a hidden transport jump.

Once every part is home, the stack reappears at period−3. At period−2 one private
transaction measures and imports all three fuel deficits, debits the standing
ground supply into each supported tank, and publishes the aggregate resource
anchor plus three part-specific transfer events. Its combined deficit must fit
`maxImport` and every tank must fit its own capacity. Refilling never changes
lifetime consumption. Reassembly and the next cycle preserve dry hardware and
reserved child fuel; there are no airborne resets or replacement parts.

The engine's `accounts` query counts each physical part once. Sum of initial fuel
and explicit imports equals remaining fuel plus cumulative consumption. The
stack's booster-active sample and the orbiter's carried lander mass are useful
assembly readouts, but summing the four glyph samples is not an inventory audit.

One worker owns one cached finite physical context. Drawing cycles are prepared
there and sent once, then retained by the main-thread store. Dense copies cover
visible flight intervals; attached inspection uses immutable finite templates.
Each copy counts toward drawing storage. Position-only state/display-origin
queries avoid cloning telemetry or evaluating aerodynamic forces for each
historical path vertex, while exact event-seam lookup uses binary search. Rolling playback retains 128 units with
32 units of committed lead. A held worker reply preserves the prior cursor's
resource anchor and drawing rows until release. Calendar 1,000,000 halts exactly;
final samples, boundaries and rendering arcs stop there.

Admission checks source symmetry, completed recoveries, enough turnaround,
measured supply, physical storage, prepared-row storage and packet sizes before
publication. The measured template is about 15.8MB and one rotated visible-flight
cycle is about 12.7MB. A regular worker reply usually adds only one cycle;
a bounded long jump can need three, about 38.4MB. Packet caps are therefore
48MB after the cache and 64MB for a late first cache reply. Physical context
remains capped at 160,000 nodes/60MB, and retained drawing at 240,000 samples/84MB.
Each cycle also has a 28MB admission cap. No reply copies all historical cycles.
Unexpected failures retain the caller's last published frontier.
This domain is one authored reusable mission, not general staging, docking,
fleet dispatch or a replacement-hardware economy.

The synthetic recurrence tests isolate calendar/accounting behavior. The
canonical integration test compiles the real mission, compares drawing and
canonical samples, audits later cycles and the final calendar, and emits optional
measured evidence with `STAGED_SERVICE_EVIDENCE=1`. Its flight accuracy still
requires the finite mission's independent oracle and refinement evidence.
