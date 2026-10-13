# Continuous survey / staged fictional observatory release review

2026-10-13. Read-only Astra review requested by the ongoing user-authorized senior review flow. Verify sources before critiquing. Scope the actual release risks; do not redesign other viewers or old sets.

User accepted finite spatial halo/Lissajous/insertion and now requests continuous figure-drawing Lissajous, fictional names, staged observatory launch + parking, and coplanar flyby chase cuts. Design review extension-review.md led to a separate mission-surface-v7 single empty moving pad domain (old v6 unchanged) and measured growing-mode feedback with retained phase continuation.

Read src/binary/{survey,survey-engine,survey-store,mission}.ts, the changed camera.ts/main.ts/schema.ts portions, fixtures/model-sets/{libration-survey,observatory-mission}.json, tests/sim/libration-extension.test.ts and tests/browser/chase-flyby.spec.ts. Design sources under docs/design/libration-orbits/continuous/ and mission/. Avoid giant JSON or broad repository reads. Can run focused cheap probes without modifying files.

Evidence: continuous/rollout.json is 2600 physical units (4 phase beats, over2 history windows), no control refusal, fuel .39969, bounded ~2.94MB retained rows. Mission/native-probe.json is 191938 physics nodes/8273 display rows/2.36MB; prepare ~2.1s in worker, paid zero-kick split and landing, 23.5 departure after true parking,37.5 halo insertion,80end and one-period closure2.3e-8. Independent seven-state DOP853/frozen-control oracle running via scripts/libration-extension-evidence.ts then spikes/numerics/libration_extension_oracle.py; report docs/evidence/libration-extension-oracle.json when ready. Orbit controls aren't reset to reference, exact masses/fuel carried across private upper episodes, guided survey reference is a fitted finite-residual guide, not an exact torus. All unsupported envelopes halt atomically. Main display is Hermite, never targeting.

The current chase fix removes r×v roll flips for reported coplanar flybys and uses one primary velocity basis. Near-pole fallback remains a known unaddressed spatial seam; release doesn't claim globally seamless spatial Chase.

Questions: identify actual correctness/resource/ownership/continuation or visual state leaks blocking this scope. Check admission and store transactional validation. Give concise severity-ranked findings and source locations; distinguish gate limitations from bugs. Do not commit or edit. If no blockers say so; include any test evidence actually run.
