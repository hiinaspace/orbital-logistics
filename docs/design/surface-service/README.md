# Continuous airless surface service

2026-10-08. The user accepted finite landing and requested continuous surface
service, plus exhaust-side thrust whiskers whose lengths reflect actual force.
**Selene · continuous surface service** is one Swift alternating Cairn and Lantern.
It retains the accepted eight-arc launch/descent witnesses, fixed hardware/loadouts,
finite buffers, explicit external flows and integer synodic departure windows.
Watching and exploring remain sufficient; no mission editor or optimization gate.

## Review and disposition

[Brief](brief.md), [Astra report](astra-review.md),
[transport](astra-transport.json). Codex CLI 0.153.4 actually ran gpt-6-astra/xhigh,
exit 0, session 01a11d28-8f37-7da1-b00f-81fb7afb881a; owner verified transport before
reading the report. Subscription cost unavailable; CLI reported 76,074 tokens.
The compact log preserves transport/completion metadata; original verbose-log hash
is retained. Review covered the design, not the final implementation diff. Owner
spot-checks independently rebased both flights and inspected the named code seams.

| Recommendation | Disposition and implementation |
|---|---|
| Private support prelude and explicit episode commit contract | Adopted. Surface bundle starts at-h with exact initial dock, then launch(0). Actual serviced fuel/cargo are supplied once. Fleet owns attachment/resources; no local transfers, public negative-time facts or synthetic surface undock. Arrival requires the designated operation ID, kind, destination and exact original local epoch. Terminal is epoch+duration. |
| Predicted versus committed drawing coverage | Adopted with bounded specialization. Production prediction/execution share one immutable Runner, so dense prediction can represent committed coverage through the frontier. A divergent test executor supplies separate actual dense samples, boundaries and arcs. Fault commits the actual paid prefix once. Historical cursors before fault knowledge retain the original forecast. |
| Replace tentative 32,768 dense-sample budget | Adopted 65,536 per worker/main cache,16,384 per pending episode plus exact boundaries. One bounded pending reply may retain one extra episode while history is held. Full dense coverage stays queryable; only the recent 12 units expand into the render list. Trail alpha buckets and subpixel path compaction reduce paint work. |
| Late-window precision, narrow domain and independent admission | Adopted. Explicit airless-surface-v1, one ship, fixed supported pad/circular depot and force 5/cap 3/dry 1/ve 3. Original local operation/arc/cap epochs survive global translation. Test both legs at indices 1/64/last admissible below 1m, three steps and independent DOP853. |
| Whiskers independent of physics | Adopted. Exhaust direction; positive actual force length 3+15sqrt(F/Fmax) px, bounded 3–18. Zero force omitted. Existing plan layer/selected ship/future-only semantics remain. |
| Human decisions | None blocked this slice. Appearance remains available for normal hands-on feedback. |

## Ownership and playback

`TrafficEngine` owns global scheduling, shared stocks, service completion, berth
occupancy and committed resource/event history. A finite local Runner owns each
flight and unchanged launch/land safety. Admitted controls are rotated, not solved
against display samples. The dispatcher uses actual serviced loadouts and reruns
physical admission. Planning/stock failures wait for later windows; in-flight
failure retains a last-known marker and paid usage. Missing designated arrival
faults once instead of stalling the event queue.

History remains128 units; fleet drawing grid remains 1/16. Surface episodes carry
1/2048 disposable drawing coverage with exact event-left/right states and cap epochs.
All retained coverage is queryable even when older than the recent trail; it never
restarts physics. Pause holds the cursor and accepts at most one pending reply;
Play catches up through retained history, Live returns to the head, Restart starts
the selected definition again. Millisecond slider bounds stay aligned as the
history watermark slides. Neither landing nor launch changes camera or speed.

Cairn imports cargo/fuel; Lantern exports cargo/imports fuel. Capacities and actual
clipped flows are explicit. Shortages can change cadence; continuous does not
promise an uninterrupted timetable. This is a memory-only fixed-route service
within the tested 1m calendar, not general steering, persistence, demand dispatch,
staging, atmosphere or stationkeeping. The finite ascent/round-trip sets remain.

## Reproduction and retained artifacts

```sh
node --import tsx docs/design/surface-service/assemble.ts
node --import tsx docs/design/surface-service/episode-probe.ts
npm run evidence:surface-traffic
npm run test:sim
npm run build
PLAYWRIGHT_PREVIEW=1 npm run test:browser
```

`assemble.ts` freezes existing accepted programs as the service fixture;
`episode-probe.ts/json` retain the initial feasibility experiment. These small
files survive as provenance. The exploratory runtime probe was removed after
replacement by the reproducible soak. Evidence JSON and screenshots are permanent
admission artifacts; temporary logs are removed after validation. User-facing
preview4178 is intentionally retained. See [evidence](../../evidence/continuous-surface.md)
for measured bounds and their limits.
