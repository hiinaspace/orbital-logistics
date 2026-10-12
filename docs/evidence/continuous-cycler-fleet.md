# Continuous stabilized cycler fleet

**Aster–Selene · Continuous cycler fleet** preserves the accepted two carriers and
two riders, including later-carrier returns, 46.75-unit lunar ground visits and
10.75-unit parking before lunar boarding. Each rider repeats every two natural
carrier circuits (241.009352654 units), with funded ground turnaround.
This is an authored stabilized recurrence, with explicit numerical phase projection;
it does not demonstrate indefinite free-flight or physical feedback stability.
The owner explicitly accepted artificial stabilization at this exhibit scale.

## Dynamics and resources

- Full native macrocycle: 346,911 advances / 346,919 enclosure checks,
  within the reserved360k/600k caps. The same moving-body safety enclosures admit
  all carrier/rider flight and steering; finite v1 admission and its source remain.
- Independent DOP853 position/velocity disagreement each<1e-8, with h/2 and h/4
  whole-macrocycle calibration. Paid rider capture and all four landing reserves
  preserve the previous gates.
- Wayfarer/Nomad corrected only in the final four units while both riders are
  supported. Independent uncorrected errors are ~3.07e-10/6.99e-10 position;
  commanded maintenance Δv~1.70e-10/5.13e-10. The independent remaining projection
  errors are ~6.26e-12/7.55e-13 position. Native remaining errors are ~1e-10 and
  are separately measured before the admitted numerical projection.
- Total carrier macrocycle Δv (commands + residual matching +1e-8 allowance):
  1.0189444e-08 / 1.0527684e-08, each≤1e-5.
  These measured commands are not evidence that thrust alone stabilizes the orbit;
  the declared numerical projection supplies recurrence.
- Carrier fuel is permanently derived from cumulative Δv. There are no orbital
  refills or tank resets; at20 macrocycles combined remaining fuel is
  11.999998964. Rider resources repeat only after paid,
  explicitly funded ground reloads. Refuelling carriers from riders is a future
  option if upkeep becomes operationally relevant.
- Independent fixture regeneration was byte-identical, source 1,421,392 bytes,
  SHA256 `7690b7a5324bba49311d581f42f2ad4e6aceabbc9fc014113fd43272d17bfdb7`.
- Separate actual absolute-epoch native replays at0,4097.16 and999706.79 agree
  with the admitted rotated command/geometry witnesses to at most
  2.19e-08 six-state error (<8e-8).
  This version declares a canonical phase grid; it does not assert that a
  non-dyadic macrocycle preserves the legacy absolute grid.

## Runtime and failure gates

The20-macrocycle rollout completed80 deliveries/12 cargo units with one physics
compilation and no replanning. Worker/frontend histories contain clipped eight-unit
chunks,32 lead,482.018705 actual history and514.018705 total retention. Peak retained
serialized drawing 11,473,311 bytes/23,411 core samples,
within24MB/40k limits; chunk count≤68. Peak incremental packet
500,793 bytes. Source/template, pending chunks, held prefixes and
resource anchors have their own caps; serialized sizes are not heap-size guarantees.

Funding or capture/maintenance failure stops this dependent service at event-left;
packet preflight failure never advances published head. Held/rewind/Live preserve
one resource clock. Duplicate/replacement chunks, NaN vectors, negative counts and
dishonest budgets reject without altering held history. Admitted chunks are cloned.
Zero-Δv drawing queries clamp roundoff-only tank overfill to their anchor.

Astra's implementation probes found two real long-time defects, now fixed and
covered: cycle-boundary aliases could produce negative local phase, and exact
repeated reload arithmetic could undercount imports. Explicit constructed-epoch
comparisons handle both sides and operation counts. The formerly failing chunk3916
and exact boundaries through cycle4096 now pass.

All41 targeted simulation/regression tests pass, including original finite fleet,
pass-through, legacy compact, solar, camera, attitude and trail behavior. Ruff, ty,
typecheck/build and byte-identical producer replay pass.

## Browser and presentation

Production Chrome at3840×2160 ran beyond900 units at16× without exceptions, halts
or planning pauses. Draw p95 9.5ms/max
18.5ms; frame-gap p95
33.4ms/max
50.1ms. Drawing-history reconstruction has an
independent100ms cadence: fixing redundant reconstructions reduced refresh count
from1147 to483 in the measured run and improved observed frame gaps. These figures
are this host's observed envelope, not a general60fps guarantee.

Browser gates cover funded repeat deliveries, history retention, long trails,
reverse, held/Return to live,3D/inertial/rotating frames, timeline resizing and clean
finite/full-system/continuous set switching. The finite fleet browser regression
also passes, as does full Aster–Selene service playback after the shared refresh
cadence change. Reviewed rotating and inertial screenshots.

Cyclers recommend two-loop trails. Layers now has a per-set remembered0.25–2×
trail multiplier; fade decays with the selected span rather than a four-unit cap.
Timeline height is vertically resizable, capped30dvh with overflow scrolling.
Carrier stabilization does not add distracting exhaust/glyph changes. Extra
carriers/riders remain a later density/content gate.

Evidence: [rollout](continuous-cycler-rollout.json),
[late-epoch replay](continuous-cycler-late.json), [browser](continuous-cycler-browser.json).
[Design](../design/continuous-cycler-fleet/README.md),
[Astra dispositions](../design/continuous-cycler-fleet/disposition.md).
