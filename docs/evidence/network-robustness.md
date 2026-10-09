# Relay network robustness follow-up — 2026-10-09

User accepted the multiship exhibit at2×, then reported a sidebar fuel/freight cursor
flicker and `Network invariant failed: Candidate physical storage budget exceeded`.
This repairs accounting and presentation without changing the set or physical
transfer/control/capture admission.

## Reproduction and change

The original runtime reproduces the exact error preparing time696, retaining its
last fully published head at695.9375. Its accounted transient peak was262,224 nodes,
retained peak133,744, against network limits400k/140k. The inherited220k candidate
sum counted guide, retained best, candidate owner and proof hub intervals repeatedly.
It also provided a second partial storage authority beside the global registry.
[Baseline log](../design/network-robustness/baseline.log) intentionally records the
failed assertion; [summary](../design/network-robustness/baseline.json) records the
exact stopping state.

Network admission now uses only the deduplicated registry at candidate handoff.
Legacy single-lane planning retains its220k guard. No limit was raised. Network
short world/seed/piece/baseline and hub runners enforce their reserved grid-plus1024
node caps rather than inheriting the scene-wide65,536 maximum. Genuine refusal,
unsafe intervals and ownership failures still halt at the published state. A failed
final trip registration unregisters itself and its private world before propagating
the error.

The chart was emitted with a cursor atx0 when each SVG replaced the previous graph;
the next100ms panel update positioned it again. The new template immediately carries
the same exact cursor transform and window bounds as the panel calculation. A DOM
mutation observer catches the replacement before another panel tick and compares a
finite position with the actual displayed epoch. [Before](../design/network-robustness/chart-before.log)
fails on52 missing transforms; [initial fix](../design/network-robustness/chart-after.log)
passes, and the final assertion also rejects stale/nonfinite positions.

## Review and checks

[Astra review/disposition](../design/network-robustness/README.md) records verified
gpt-6-astra/xhigh read-only CLI, exit0. Review accepted the network-only authority
switch and added enforced allocation caps, exception-safe registration and the
stronger cursor assertion. It inspected the initial patch before final continuation;
the final results below come from separate validation.

The scoped tests cover stable actual allocation, input/request/work partitions,
cache-on/off physical equivalence, all six pair dependency faults, retained historical
fault validity, unchanged legacy single-lane behavior, shared Runner deduplication
after cache eviction and forced final-registration cleanup. Production browser cases
cover selection, pause/scrub/live, switching, stopped-station frames and actual chart
replacements. Build/typecheck pass. Logs and numerical continuation live in
`docs/design/network-robustness/`.

The final original-anchor runtime soak reaches1,536 with38 completed returns,
45 bounded failed opportunities and zero station-control failures. Peak retained
physical nodes139,253 remain below140k; accounted transient peak262,224 remains
below400k. Fuel conservation is asserted at every eight-unit observation; final
balance error1.78e-15 and funded station fuel delivered2.196024934. Every retained
summary's frontier/counters matches the preliminary authority-switch run after
reserved-cap enforcement. The preserved512-unit prefix passes28 plan-entry and95
resource-entry exact comparisons against the original validated replay. See
[final summary](../design/network-robustness/final.json) and
[log](../design/network-robustness/final.log).

Ten distinct focused numerical checks pass: eight initial runtime/definition checks,
five final storage checks (two new), plus final atomic parity and all three final
network runtime cases repeated after cap enforcement. Three production browser
cases pass; the optional isolated performance case is skipped. Build/typecheck and
configured all-file Ruff-format/lint/ty hooks pass. This continuation verifies the
reported late halt is repaired; it does not equate a bounded soak with indefinite
service guarantees.

## Reproduction

```sh
node --import tsx docs/design/network-robustness/soak.ts 1536 docs/design/network-robustness/final.json
node --import tsx --test tests/sim/network-definition.test.ts tests/sim/network-runtime.test.ts tests/sim/adaptive-runtime.test.ts
PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/network-service.spec.ts
```

The2× cap is retained. The previous independent original-anchor DOP853 evidence is
unchanged; this repair does not claim a new independent long-horizon oracle or a
new isolated throughput measurement. Node counts bound owned physical data, not a
measurement of JavaScript GC timing or total browser heap.
