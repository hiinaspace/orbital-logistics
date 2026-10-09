# Responsive adaptive playback — 2026-10-09

Historical16-unit configuration; see the subsequent
[sensitivity/32-unit/4× measurements](sensitivity-planning.md) for current behavior.

User accepted the economical routes, then reported multi-second simulation holds
at1x and timeline highlight flapping. Physical fidelity was retained for this fix.

## Changes

The planner reuses its canonical unloaded incoming guide prefix and its controls
through the quiet capture/transfer block. Controls following attachment solve with
the new aggregate mass. Admission still reconstructs a frozen coupled program,
checks block anchors/event-left-right ownership, pays captures, validates clearance,
fuel delivery and reserves. Dense grid equality is a regression oracle rather than
repeated sorted JSON work during each admission. Shared guide/best candidate storage
is included in the speculative budget, and dead temporary incoming replays are dropped.

The adaptive worker primes16 physical units before ready. Live playback advances
on presentation time through acknowledged committed states while it refills toward
cursor+16, one request/maxone unit outstanding. It discards underflow time instead
of catching up afterward. The engine/route calendar is unchanged. Known-at forecasts
remain separate, pauses stop new work, and faults stop computation while retained
history can play to the exact fault head. At full lead the128-unit total window leaves
112 units behind the cursor. Fast warp can consume the reserve.

Timeline rows/selection and interactive controls retain identity during updates;
selection classes use stable object IDs and are present atomically. There was no
automatic selection mutation in the inspected source. The initial short browser
probe did not reproduce the user's exact Meridian/Tern flapping; regression coverage
checks both visual selection and retained control identity across live updates.

## Measured planning and physical parity

The initial Node CPU profile through64 recorded26.1627s total, initialization9.233s,
and13.173s/3.706s holds near56/64. Optimized probe:19.3924s total,7.926s initialization,
8.594s/2.737s holds. These are wall timings on the same host under other activity,
not an isolated microbenchmark. The original timing artifact was accidentally copied
after the optimized probe overwrote it; `baseline-timing.json` restores the captured
initial command output and agrees with `baseline.cpuprofile` (~27s including startup).

The final512-unit rollout matches all7 historical coupled programs, station controls
and committed events **exactly**, including retries and later admissions. It completes
6 returns,0 controller failures and zero reported fuel conservation error. Trial
controller evaluations9666→5010 (48% fewer); visitor evaluations remain3866. Total
speculative evaluations13532→8876. Wall time155.73→100.58s, with the same caveat about
host load. The pre-existing independent original-anchor DOP853 witness therefore
still applies to these identical controls/programs; no new dynamics oracle is claimed.

The numerical tests retain dense canonical grid comparison, exact early programs,
read-only incoming prefixes under exhausted visitor budget, request/yield partitions,
paid capture/transfer/release failure and older-history scrubbing after a later fault.
Cached descriptors sampled across departure/capture/delivery/release/refuel agree with
fresh committed queries. An Astra read-only probe discovered the stale refuel and
late-fault history failures before these fixes.

## Browser observations

Production installed Chrome, headless, native worker, same host:

| 1x observation | Through72 | Through240 |
| --- | ---: | ---: |
| Longest gap between published display-time updates |116.8ms |116.8ms |
| Minimum computed lead |9.8336 |9.7836 |
| Maximum computed lead |15.9835 |15.9835 |
| Returns / retries at sampled head |1 /1 |3 /3 |
| Retained view bytes |4,062,831 |5,529,333 |
| Page errors |0 |0 |

The final72-unit scene startup took2.904s, including buffer priming.
No multi-second display hold was observed in either measurement. The state is
published on the100ms panel cadence; this measures playback stalls, not per-pixel
render latency. The four-minute case passed its performance/resource thresholds and
pause-pose checks, then failed a harness scrub input containing extra floating digits
in a range with.001 step. That input is rounded in the corrected test; the separate
fast retained-history browser case validates the corrected scrub/catch-up path.
`browser-timing-240.json` is the measured performance artifact from that run, not a
claim that its entire original test completed. Normal-speed success on this host
does not guarantee arbitrary warp or slower hardware.

## Research and review

[Astra review/disposition](../design/responsive-service/README.md) records verified
gpt-6-astra/xhigh/CLI0.153.4/read-only/exit0. It was architecture review, not a final
diff or independent browser review. The [primary-source literature report](../../reports/Efficient%20orbital%20stationkeeping.md)
recommends propagated finite-pulse sensitivities as the next numerical experiment,
then a separate element/deadband maintenance policy study. Real GEO/NRHO assumptions,
phase objectives and indirect third-body conventions cannot be copied blindly into
this nearby prescribed-perturber model. Neither alternative controller is implemented.

Reproduction: `node --import tsx docs/design/responsive-service/rollout.ts`,
`node --import tsx --test tests/sim/responsive-service.test.ts`,
`PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/responsive-service.spec.ts`.
Opt-in longer measurement: prefix the last command with `RESPONSIVE_THROUGH=240`.
The CPU profile, timing summaries, review and research notes are bounded durable
artifacts; no ongoing profiler or telemetry collection is required.

Full numerical run:157 pass; final focused3 pass include one additional budget
regression (158 distinct). TypeScript/production build and configured Ruff-format,
Ruff-lint and ty checks pass. Final viewer suite31 pass/one opt-in profiler skipped,
including retained-history/error/selection cases. The final corrected1x case also
passes separately (32 distinct browser checks), including paused pose, retained
scrubbing/frame invariance and return to buffered live playback. Its measurements
and the longer performance observation are recorded above.
