# Responsive service planning

User wants ambient 1x service without multi-second simulation freezes and a
stationkeeping literature pass; preserve physical routes/resources and scrubbing.
Solo prototype: no general asynchronous fleet scheduler required.

## Verified facts

- Main gpt-6.1-sol/high; branch codex/model-set-viewer, natto, baseline f1c8bc0.
- `src/adaptive/engine.ts` blocks its frontier at every control-boundary generator.
  Worker yields24 units per message; DOM responsive, simulation time held.
- Initial Node CPU profile through64:26.16s,9.23s initialization,13.17s hold near56,
  3.71s near64. `baseline-timing.json`, `baseline.cpuprofile` are measured artifacts.
- Whole-grid sorted JSON equality in `buildPlanJob` and duplicate unloaded
  controllers are expensive. Current in-progress patch reuses immutable incoming
  guide runners/controls, solves loaded controls afresh, checks replay event/block
  anchors instead of every1/256 point. Full canonical reconstruction/capture/
  clearance remains. Not yet validated; no physics simplification intended.
- `src/main.ts` live playback currently sets `t=traffic.frontier` on worker replies.
  Target grows from frontier, so it has no ahead buffer. Paused/scrub playback
  already increments wall-time independently through retained committed frames.
- AdaptiveViewStore.view(cursor) filters chunks/visits by knownAt<=cursor, actual
  samples by engine frontier, history128; conditional fault truncates all future.
- Existing pause semantics: stop requesting, pending worker may acknowledge one
  request; cursor/pose held by heldCurrent. Restart resets seed/resources; switching
  kills prior worker; Live currently jumps to actual engine head.

## Proposed decision

Lean: keep simulation/frontier physical contract untouched, add **16-unit bounded
playback lead** for adaptive live viewing. Worker computes committed canonical
history ahead, viewer advances t by wall dt*rate through that committed history.
Never display fabricated/extrapolated states. Desired worker target is cursor+16,
requests still max frontier+1 and one outstanding. Prime lead before displaying
initial scene; pause stops work except pending ack; scrub+Play catches up to the
buffered live edge; Live joins frontier-16 (clamped oldest/0), not raw unbuffered
worker frontier, so selecting Live does not exhaust the buffer instantly. Label
simulation-head/frontier stays actual computation head; do not introduce product
prose caveats. UI need not expose compute lead as separate setting yet.

16 is fixed in physical scene units, adequate at1x after optimizations measured;
fast warp may consume buffer, then slow honestly. Buffer uses existing bounded
retention and immutable canonical chunks; no new engine schedule/deadline or
wall-clock physics, no coasting past a conditional ownership failure. Faults may
be known before the playback cursor reaches their physical epoch; preserve ability
to play up to halt (currently halt immediately stops requests but view must not
stop the cursor prematurely).

Rejected for this slice: wall-clock-dependent admission, computing a new route
while advancing beyond its departure, changing stationkeeping force/phase model,
approximate docking or replay provider. Cheaper element controllers/STM are
research directions, not needed before measuring waste elimination.

## Review questions

Verify code facts first; prioritize concrete playback/fault/pause/history pitfalls,
whether fixed lead+priming is enough or a different bounded strategy is better.
Should Live semantics join buffered edge vs head? Any invariants broken by prefix
reuse or reduced redundant replay checks? Main will run independent replay and
same-plan comparison. Scope: inspect only relevant adaptive files/main/view and
existing tests, no broad old milestones, no edits, bounded review ~10 minutes.
