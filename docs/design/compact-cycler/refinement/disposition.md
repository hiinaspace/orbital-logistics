# Refinement review disposition

Read-only CLI Astra/high, both exit0 and actual transport/effort verified before
synthesis. Main gpt-6.1-sol. Initial session01a12ec8-acf5-7181-97ea-8237591845f5;
follow-up01a12ed9-bbab-7bb0-91a7-8ae455877208. No edits/delegation by either reviewer.
[Initial critique](astra-review.md), [follow-up](astra-followup.md).

| Finding | Disposition |
| --- | --- |
| P2: grouped routes/nonzero pad phases accidentally admitted by legacy v1 | Fixed. Require seven singleton routes, original control presence and zero phases. Actual3121643 fixture accepted; each extension refused. Reviewer verified fixture byte identity and regression. |
| P2: total aboard time hid inbound split and large outward Aster connection | Adopted. Further timing/longitude search reduces boarding radius4.81→3.198, with directional bounds and time split assertions. Moon launch3 units, Aster access3.5 units each; inbound6.5 independent/7 aboard, outbound7.5/40. Reviewer verified new geometry, while human “local enough” taste remains open. |
| No optimality/necessity inference from morphology alone | Adopted. Record actual costs, geometry and time; no direct-route optimizer comparison or proven natural ballistic cycler claimed. |
| Shorter carrier burns should not be described as cheaper maintenance | Adopted. Carrier delta-v increases1.0718→1.5504; duration halves8→4 per burn. Explicit stronger engine and restored shuttle exhaust4 are design choices. |
| Numerical/physical/covariance/refueling contracts otherwise supported | Preserve. Fresh independent fifteen-segment replay, native/resolution/late-epoch, resource/held/fault gates pass. Bounds unchanged. |
| Reviewer did not inspect final browser/visual gate | Main completed two production tests plus own five-screenshot review, including16×/4K, held/reverse/Live and set switching. Human viewing is next. |

Owner spot-checked protocol admission, physical handoff radii and per-direction time,
paid costs/caps, fresh replay and the final inertial/rotating screenshots. This does
not convert a bounded outside review into proof of universal correctness or taste.
