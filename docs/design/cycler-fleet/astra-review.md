The direction is sound for a finite exhibit, but I would resolve the berth calendar and correct the cost baseline before numerical authoring.

Verified against the current source, frozen profile and retained evidence at `25b97e8`: the field, period, current event epochs, exact native handoffs, paid captures and work limits match the brief. The recorded 212,249 advances and 14,996,014-byte scene agree with the evidence; I did not rerun admission or browser tests.

1. **P1 — Single-berth occupancy conflicts extend beyond lunar dwell.**
   [Brief line 7](/home/s/code/orbital-logistics/docs/design/cycler-fleet/brief.md:7) proposes two staggered riders sharing single-berth pads. Current admission gives each rider supported history before departure and after its final return ([prepare.ts](/home/s/code/orbital-logistics/src/cycler/prepare.ts:97)). Preserving that behavior places both riders at Cairn initially and again after their returns.

   There is also a concrete lunar constraint: δ≈60.252338 makes rider 2 land at Haven at **133.752338**. Simply delaying rider 1’s old ascent by δ launches it at **134.752338**, creating one unit of overlap.

   **Recommendation:** explicitly admit two Cairn berths for this exhibit, while retaining single-berth Haven and requiring rider 1 to depart before rider 2 lands. If Cairn must remain single-berth, separate initial and final parking histories become required scope. Validate occupancy over the entire admitted horizon, including initial/final support and both sides of simultaneous events.

2. **P2 — The ascent baseline is wrong, and “lower cost” needs a complete comparison.**
   [Brief line 5](/home/s/code/orbital-logistics/docs/design/cycler-fleet/brief.md:5) gives ascent Δv≈0.736. The [frozen profile](/home/s/code/orbital-logistics/fixtures/model-sets/pass-through-profile.json) records **0.842684**; lunar connection departure plus arrival is **0.861004**. Their combined baseline is therefore **1.703688**, before tiny paid capture allowances.

   **Recommendation:** report both connection-only and complete surface-to-carrier Δv/fuel. Include any parking insertion or correction costs. A cheaper final connection should not silently move its cost into ascent; retain the full return landing-reserve gate.

3. **P2 — Drawing simplification needs an accuracy gate.**
   [Brief line 7](/home/s/code/orbital-logistics/docs/design/cycler-fleet/brief.md:7) proposes thinning disposable coast samples. Those samples drive Hermite position/velocity queries ([query.ts](/home/s/code/orbital-logistics/src/cycler/query.ts:17)); lunar parking can have substantial curvature despite zero thrust. Physics could remain correct while close-view motion becomes visibly wrong.

   **Recommendation:** preserve phase boundaries, event sides and control knots, and bound drawing error against native states across the admitted camera scale. First examine shared-template duplication: the scene references the same template globally and per vessel ([view.ts](/home/s/code/orbital-logistics/src/cycler/view.ts:22)). Distinguish JSON size from structured-clone sharing when deciding what to reduce.

Two architectural points deserve explicit guards, but do not require a different design:

- **The phase-shift construction is appropriate for this field.** Apply the constant rotation to both inertial position and velocity. The positive-time alternative relies on numerical periodic closure, so treat it as a seed and independently admit its full forward history. “Keep Aster controls” should mean shifted/rotated control shapes, freshly replayed against actual carrier nodes—not retained absolute epochs or assumed endpoints.
- **Carrier identity must govern admission as well as display.** The current query hardcodes carrier 0 and one rider’s carried mass ([query.ts](/home/s/code/orbital-logistics/src/cycler/query.ts:19)). Require each ride to name a valid carrier, match its paid boarding and release events, and contribute mass only to that carrier over the attachment interval. Reject wrong-parent and overlapping-ownership fixtures.

Later-pass feasibility and whether the resulting dwell/parking feels relaxed remain unverified. The proposed bounded numerical witness followed by a visual gate is the right way to resolve those uncertainties.

No files changed, delegation performed, or simulations run.
