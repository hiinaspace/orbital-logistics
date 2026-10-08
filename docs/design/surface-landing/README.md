# Finite airless round trip — review and disposition

2026-10-08. User accepted landing → continuous surface service, with 3D presentation
deferred. Schematic position/velocity capture and aggregate vehicle statistics are
appropriate; hull contact and KSP-like vehicle detail are outside this slice.

The [verified brief](brief.md) went to an independent read-only **gpt-6-astra / xhigh**
senior review through Codex CLI0.153.4. Actual transport header, exit0 and nonempty
report were checked before reading [the report](astra-review.md). The
[transport record](astra-transport.json) retains session identity and original hashes;
the trimmed log preserves actual model/effort and completion. Subscription transport;
dollar cost unavailable. No reviewer delegation. Owner main loop is gpt-6.1-sol.

| Decision | Disposition | Owner verification and resulting change |
|---|---|---|
| Explicit `land`, preserve initial `dock` | Adopt | Existing exact initial surface dock and canonical v3 replay remain unchanged. Retained before-change snapshots restore. |
| Capture envelope and transaction | Adapt | Full 3D position/speed against rotating pad; effective position tolerance is min(configured tolerance, represented clearance/4). Every nonzero velocity residual is paid before attachment. No radial-sign gate. |
| Same-epoch conflict | Adopt | Owner inspected arrival/start ordering; static validation rejects impulses, new arcs (including zero throttle) and all operations except one same-pad transfer. Ending thrust stays paid. |
| Sequential operations | Adopt | Land commits before service start; failed subsequent service preserves a successful landing. Dedicated fault/relaunch tests exercise this contract. |
| Descent authoring | Adopt with constraints | Existing pad/depot phases and outbound program are unchanged. Bounded backward shooting authors a boundary-value witness, but every admitted run is forward and consumes fuel. Departure window and inertial headings are frozen. |
| Net freight objective | Adopt | Deliver .1 then return .05: Lantern retains .05 net. New fixture objective matches that bookkeeping. |
| Drawing domain | Adapt | Reviewer overturned the proposed two-unit landing window: dense samples cover every free-flight interval, with explicit budgets and quarter/mid/three-quarter checks of transformed paths. |
| Showcase admission | Adopt | Full frozen three-step replay plus independent seven-state DOP853, pre-snap margins, stocks/events and unchanged interval certificates. Numerical agreement is distinct from clearance certification. |

The review independently checked the old ascent replay/oracle and reproduced the
arrival-plus-thrust-start hazard. It did **not** review or validate the new descent,
full implementation or browser. Those are owner evidence in
[surface-landing.md](../../evidence/surface-landing.md).

## Durable authoring artifacts

This directory survives as provenance, not a runtime dependency. `landing-study.py`
uses a bounded eight-heading shooting search and terminal refinement. Reverse-time
mass grows solely inside that offline boundary-value calculation. `landing-study.json`
retains the candidate. `flight-probe.ts/json` forward-replay the phased descent at
three canonical steps. `descent-oracle.py/json` independently integrate its forward
seven-state flight. `capture-probe.ts/json` retain small safe approach fixtures.
`legacy-snapshots.json` was captured before engine changes.

`node --import tsx docs/design/surface-landing/assemble.ts` rebuilds
`fixtures/model-sets/selene-return.json` from the retained witness. It reuses the
entire original outbound prefix and the actual post-delivery fuel to calculate
finite refueling. The old one-way set remains available. `npm run evidence:landing`
regenerates complete flight/resource/drawing evidence. Python runs use uv and the
existing numerics Ruff/ty hooks now include this folder.

Continuous surface dispatch is the next separate slice: committed finite episodes,
finite shared stocks, planner retries and bounded playback history must compose with
launch/land. This fixture is a finite scene; Replay rewinds its inventories.
