Proceed with the supported-COM model and a single curated ascent. **The highest-leverage decision is an atomic transition from supported motion to powered flight.** A general contact solver is unnecessary for this slice; a successful near-surface probe alone is insufficient to admit an orbital delivery.

I used the senior-review skill directly, without delegation or file edits. Transport metadata confirms `gpt-6-astra` at `xhigh`. The checkout advanced from `0cdf307` to `2cd91af` during the parallel worker work; the reviewed simulation, model-set and traffic modules were unchanged.

Evidence labels below describe observations. Recommendations remain proposed behavior.

- **[verified: execution]** The headless simulation suite passed. An in-memory reproduction matched all six retained boundary cases exactly. Exact-surface starts terminate with `collision`; weak thrust stops with a paid prefix and positive remaining clearance.
- **[verified: independent numerical check]** DOP853 reproduced the two successful probes with altitude disagreement below `2.7e-15` and fuel disagreement below `5.6e-16`. This verifies those half-unit vertical segments, not an ascent.
- **[verified: code]** Positive-clearance guards, anchored propulsion and paid capture behave as described. Constrained dwell already has a separate propagation path. See [dynamics.ts](/home/s/code/orbital-logistics/src/sim/dynamics.ts:11) and [runner.ts](/home/s/code/orbital-logistics/src/sim/runner.ts:217).
- **[unknown]** A complete surface-to-depot witness, its resource margin and launch-view readability. I did not rerun browser checks or the historical traffic soak.

The dispositions, ranked by leverage:

| Priority | Disposition | Recommendation and evidence |
|---|---|---|
| 1 | **Adapt contact/release lean** | Use positive physical COM height and unchanged free-flight guards. Make release and initial thrust activation one validated transition. **[verified: code]** Existing service completion, undock and thrust startup are separate phases. |
| 2 | **Adapt authoring lean** | Solve ascent to a chosen circular orbit first; choose the new depot’s fixed phase to meet that insertion. Freeze the resulting complete scene before admission. **[unknown]** Feasibility remains unproved; arbitrary depot phase would add an unnecessary constraint. |
| 3 | **Adopt additive versioning, with explicit gates** | Add a new logistics model version admitting surface and circular ports; retain top-level schema/model v3 if old replay remains identical. **[verified: code]** Current logistics versions select homogeneous port families, and unknown fields can disappear during reconstruction. |
| 4 | **Expand the scale work slightly** | Launch preset, slower manual playback and denser local display sampling belong together. **[verified: code and probe]** Current zoom and sampling limits are insufficient for the closest proposed views. |
| 5 | **Adopt the small staging seam** | Launch preserves the existing ship identity and all masses. Document future separation ownership, including carried vehicle fuel, without implementing hierarchy or staging. **[verified: code]** Runner currently owns one ship with immutable dry mass. |

The first decision deserves the deeper specification.

**Represent supported motion explicitly.** For fixed body center \(c\), radius \(R\), COM height \(h_c>0\), and physical pad rotation \(\omega\):

\[
\theta(t)=\phi+\omega t,\quad
n(t)=(\cos\theta,\sin\theta,0)
\]

\[
x_{\rm pad}=c+(R+h_c)n,\qquad
v_{\rm pad}=\omega(R+h_c)(-\sin\theta,\cos\theta,0).
\]

Use the existing absolute-time phase convention. A camera’s rotating frame must never supply this physical rotation.

Validate finite values, a representably positive clearance (`R + centerHeight > R`), the admitted fixed-primary/XY domain, and slow rotation below the rate requiring tensile support without thrust. The surface mark is at \(c+Rn\); the supported COM is at \(c+(R+h_c)n\).

**[verified: source and calculation]** The proposed scale is reasonable: NASA’s lunar radius and rotation data give normalized \(\omega\approx0.002754\), and `1e-6 R` is about 1.74 m. That supports a fictional Moon-like reference. It does not establish vehicle geometry. [NASA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)

The honest model is a supported point COM outside a spherical collision boundary. It does not certify hull or leg clearance. Record that once in optional model details; retain schematic glyphs.

**Give initial attachment its own narrow branch within `dock`.** Reusing the event is sufficient, provided surface docking means:

- `t === scenario.epoch`;
- the initial six-state exactly matches the shared analytical pad-state helper;
- no capture displacement, residual impulse or fuel charge;
- no later surface docking.

Generate that initial state through the same helper when assembling fixtures. Do not use ordinary orbital capture tolerances here: at this scale, those tolerances could silently move a ship by many COM heights.

While attached, evaluate the pad provider analytically. Support supplies the constraint force; thrust remains prohibited until launch. Existing finite loading/refueling semantics can remain.

**Bind launch to its first arc.** I recommend:

```ts
{ id, kind: 'launch', t, portId, thrustArcId }
```

The reference must identify the next finite-thrust arc, starting at exactly the launch epoch. Reject ordinary surface `undock`, launch from an orbital port, launch while servicing, and unsupported combinations at the same epoch. For this first slice, require launch after the initial attachment epoch.

**Evaluate release using the actual post-service mass and capped thrust.** At release, let:

\[
m=m_{\rm dry}+m_{\rm cargo}+m_{\rm fuel},
\qquad
F=\min(F_{\max}u,\;a_{\max}m).
\]

For inertial unit thrust direction \(d\), the initial radial separation acceleration is:

\[
\ddot r=\frac{F}{m}(d\cdot n)-\frac{\mu}{r^2}+\omega^2r,
\qquad r=R+h_c.
\]

Require positive fuel, positive effective thrust and positive \(\ddot r\) beyond a documented numerical comparison margin. Author the demonstration comfortably above that boundary.

The \(\omega^2r\) term comes from inherited tangential velocity when differentiating radial distance. **Do not add centrifugal acceleration to inertial dynamics.** Likewise, total TWR above one is insufficient when the heading has too little outward component.

**Commit release and thrust startup together.** Preserve the existing ordering for old programs. For a surface launch:

1. Finish any service completing at that epoch.
2. Construct and validate the launch candidate and its mass-law anchor without changing attachment.
3. On success, release support, activate that exact mass law, advance the relevant cursors, and emit `launch` then `thrust-start`.
4. Preserve position, velocity and fuel across the instantaneous transition. Subsequent integration consumes fuel normally.

On rejection, remain attached with unchanged launch-related mass, state and cursors; emit the failure diagnostic. A transfer that legitimately completed earlier in the same epoch stays completed. “No side effects” must mean **no partial launch**, rather than rolling back prior completed service.

This distinction matters because [the current event implementation](/home/s/code/orbital-logistics/src/sim/runner.ts:132) performs departure before [thrust startup](/home/s/code/orbital-logistics/src/sim/runner.ts:190). Simply adding `launch` beside `undock` risks releasing the vehicle before discovering an invalid engine state.

**Keep free-flight safety unchanged.** Positive initial separation acceleration is a release condition, not a trajectory certificate. Every subsequent interval must pass the existing powered clearance check. An arc may still turn downward, exhaust fuel or fail later; retain its paid prefix.

Propagate the new departure event through berth accounting and presentation. **[verified: code]** [stockAt](/home/s/code/orbital-logistics/src/model-set/model.ts:70) currently decrements occupancy only for `undock`. A new `launch` event otherwise leaves the pad permanently occupied. Update departure ordering, event labels, exact event sides and the independent oracle too; do not emit a second synthetic undock and accidentally count departure twice.

For compatibility, **a top-level v4 is not presently justified**.

**[verified: code]** The current parser branches on logistics model version before parsing rail types; adding a surface union alone will not admit mixed surface/circular ports. See [schema.ts](/home/s/code/orbital-logistics/src/sim/schema.ts:163). Add a distinct logistics discriminator, such as `surface-ports-v3`, restricted initially to the new fixed-primary surface/circular domain. Preserve the existing two versions unchanged.

Reject surface features in raw v1/v2 input **before conversion**. Validate all physical fields of the new rail and the `launch` arc reference. This is particularly important if the design later introduces an initialization field: **[verified: probe]** adding an unknown `ship.initialAttachment` to a v3 bundle currently results in that field being silently discarded.

Existing snapshots can remain v3 if old snapshot structures and replay results remain identical. [Restore already verifies deterministic replay](/home/s/code/orbital-logistics/src/sim/runner.ts:300), and old readers will reject the new logistics discriminator. Gate this with pre-change snapshot artifacts; a new-code serialize/deserialize round trip alone cannot prove backward compatibility. Bump the model only if implementation changes old accepted semantics.

For authoring, exploit the freedom of a curated scene.

Choose a depot radius and bounded arrival-time range. Solve the three planar insertion conditions:

\[
r=r_{\rm depot},\qquad v_r=0,\qquad
v_t=\sqrt{\mu/r_{\rm depot}}.
\]

Then choose its orbital phase from the achieved arrival longitude:

\[
\phi_{\rm depot}=\theta_{\rm arrival}-\omega_{\rm depot}t_{\rm arrival}.
\]

This is an offline content decision. The saved depot must follow that rail throughout the entire scenario; no runtime relocation or arrival snap is introduced.

Retain fixed inertial arcs. Start with a short outward departure arc and a small parameterized pitch/braking family; expand toward 6–16 arcs only when the residuals justify more freedom. Bound evaluations and attempts explicitly. Admit the final **unchanged program** through Runner, independent DOP853 replay and three numerical resolutions, including actual unloading and attached dwell.

**[verified: code]** [prepareSet](/home/s/code/orbital-logistics/src/model-set/model.ts:85) already admits complete successful horizons without requiring legacy round-trip objective completion. Do not make the launch return merely to satisfy old goal metadata.

Two numerical adjustments improve this gate:

- **Do not inherit `1/8192` as the necessary whole-scene step.** In the vertical probe, `1/512` also completed safely, retaining 282 nodes rather than 4,098, with endpoint position disagreement below `4.8e-13` against `1/32768`. **[verified: execution]** This supports testing coarser canonical grids with existing safety subdivision; it does not select the full ascent’s production step. Loading and final dwell also consume the 65,536-node budget.
- **Treat COM-height sensitivity as a changed physical model.** Doubling the retained height changes final altitude by about `1.24e-6`, already above the capture tolerance. **[verified: retained probes reproduced]** Require smooth sensitivity, safe behavior and reported endpoint changes—not identical capture after changing the launch geometry.

For clearance evidence, retain the normal Runner certificates for every free-flight interval and expose a conservative interval clearance bound in the evidence report. Compare numerical disagreement against the near-pad margin. The old `.03` radius-enlargement test is inappropriate here; sampled minimum altitude alone is also insufficient.

Capture admission should compare both implementations’ pre-snap position and velocity residuals separately, with a justified numerical allowance:

\[
\max(e_{\rm Runner},e_{\rm oracle})+\epsilon < 10^{-7}
\]

for each quantity. Keep the proposed `1e-8` allowance only if the measured refinement supports it.

The launch view needs a bounded extension beyond another camera button.

**[verified: code]** Manual zoom is capped at 5,000 px/unit, minimum playback is about 0.05 simulation units per second, and [prepared display samples](/home/s/code/orbital-logistics/src/model-set/model.ts:94) are uniformly spaced across the whole duration. At the proposed lunar reference scale, minimum playback still represents roughly 52 physical seconds per wall second.

**[verified: synthetic display probe]** Using the existing interpolation with an eight-unit scene’s sample spacing produced `1.91e-6` position error halfway through the first launch interval—about 1.9 px at a million px/unit. This is a demonstrated sampling limitation, not a measurement of an implemented launch view.

Recommend:

- Orbit-fit, pad-centered Launch and existing ship-follow choices, preserving manual pan/zoom.
- A larger zoom range and slower explicit playback range, with labels that do not round small rates to `0.00×`.
- Extra disposable samples around launch, bounded by an error budget at the supported close-view scale. Keep exact event sides and analytical attached motion.
- Fixed-size schematic ship/pad marks plus a scale indicator. Do not enlarge collision geometry to match glyphs.

No mandatory camera or speed transition, and no inset yet.

For future staging, keep the launch operation limited to releasing this vehicle. **[verified: code]** Current `dryMass`, scalar cargo and single-ship snapshots cannot themselves represent separation. The later feature will need an atomic ownership transition that creates another independently propagated state.

Document that carried vehicle dry mass, cargo and reserved propellant contribute to parent carried mass; reserved child fuel must not feed the parent engine. Separation transfers those quantities without duplication. In the colocated point model, zero-impulse separation inherits velocity; any additional separation impulse must conserve total momentum and have an explicit energy/resource model. Nothing in the recommended launch API prevents that extension.

The implementation test matrix should be short and decisive:

| Gate | Executable case and required result |
|---|---|
| Supported motion | Nonzero epoch/phase and rotated launch location; analytical position/velocity throughout loading; zero thrust fuel use. |
| Atomic release | Service completion changes mass at launch; test weak thrust, zero fuel, zero throttle, limiting acceleration cap, wrong arc and unfinished service. Rejected launch stays attached. |
| Event semantics | Launch and thrust start share one exact epoch; no state jump; pad occupancy decreases exactly once; later surface docking and ordinary surface undock reject. |
| Safety | Outward release succeeds; subsequent inward turn/early depletion fails with a paid reproducible prefix; exact-surface free starts still collide. |
| Replay/compatibility | Before/at/after-launch snapshots, reversed queries and varied partitions agree; retained old snapshots replay; legacy surface fields reject. |
| Full witness | Same program at three steps plus DOP853; clearance evidence, fuel/stock conservation, both capture residual gates, completed unloading and final attachment. |
| Display | Bound close-view interpolation error; scrub both event sides; frame changes preserve physics; schematic marks remain readable. |
| Integration | Repeated finite/continuous/launch switching, worker failure handling, zero console errors and unchanged continuous-service behavior. |

Add the simulation cases to a dedicated surface-ascent test file and run the existing simulation suite plus typecheck. After implementation, run the independent ascent oracle and production browser suite.

The main agent can make and test all architecture decisions above. Human taste is needed for the eventual close-view scale, playback feel and glyph readability; it does not block implementation. Full ascent feasibility remains the first admission gate.
