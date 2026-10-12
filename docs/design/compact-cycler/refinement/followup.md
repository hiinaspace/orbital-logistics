# Follow-up to the two P2 findings

Same authorized cycler refinement, main gpt-6.1-sol; reviewer gpt-6-astra/high read-only.
Actual first review session01a12ec8-acf5-7181-97ea-8237591845f5/exit0 verified.
Read the prior astra-review.md and inspect only fixes/updated candidate, no broad audit
or delegation. Around4k token scope.

[verified] Fixed v1 shape leak: exactly7 singleton routes, original control-presence
pattern, zero supported phases. tests/fixtures/compact-cycler-v1.json preserves the
real original3121643 profile; native acceptance and three extension refusals pass.

[verified: fresh independent full replay + native] Tighter candidate addresses geometry
critique: pad longitude1.2 (not.8), Moon launch6→board9, Aster release16→land19.5,
launch21.5→board25, Moon release65→land69. Thus inbound independent6.5/aboard7;
outbound independent7.5/aboard40. Carrier boarding radius~3.19, formerly4.81.
Directional geometry bounds now explicit in native tests (Aster release<3.1, board<3.3;
Moon-relative boarding<1.3, release<2.5), not just aggregate aboard time. No direct-route
optimality or mathematical necessity claim. Human taste remains open.

[verified] Source profile-v2 candidate changed while uncommitted. Both fuel tanks/dry/cargo
and reserves unchanged; restored exhaust4 still passes half fuels.749/.638. Shorter
local bursts need shuttle cap4/force16.6 instead3/12.45; actual Bernstein peaks3.589
and3.614 on Aster connections, lunar1.76/1.64. Carrier stronger.6/6 unchanged from
first refinement. Literal taxi coasts1.5,2,2,2; total flight14, aboard47, carrier coast
64/74. Parent delta-v1.5504 remains higher thanv1; maintenance duration halved, not
claimed to be cheaper. Field unchanged; common rotation reuse unchanged, actual
port phases/rates explicit. Group controls propagate canonical actual endpoints.
Source fork/version guard rejects old readers/legacy reinterpretation.

[verified] Eight native tests passed prior to adding the new directional geometry assertion;
full coupled DOP/native/resolution/late-epoch,2048 resource/held/fault and legacy gates.
Final numerical/browser rerun pending; initial less-local candidate production browser
passed. Main inspected inertial/rotating images of that candidate. Current source producer
spikes/numerics/compact_cycler_refined.py, frozen refinement/refined-controls.json and
fresh replay.log. Review only src/compact/prepare.ts, native tests and producer/frozen
candidate if a claim depends on it. Other physics/engine unchanged.

Please verify and indicate whether prior findings are resolved or identify a concrete
remaining blocker. No need to rerun expensive homotopy or repeat whole first review.
