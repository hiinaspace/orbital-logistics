# Responsive continuous viewing

The subsequent [sensitivity-planning slice](../sensitivity-planning/README.md)
supersedes this slice's16-unit lead with32 and caps flexible service at4×. The
review and measurements below retain their original16-unit configuration.

The user accepted the flexible routes but found planning pauses disruptive even at
1x, requested another stationkeeping literature pass and reported timeline flapping.

Astra gpt-6-astra/xhigh reviewed the verified architecture brief read-only before
final playback implementation. CLI0.153.4, session01a121dc-fe04-7091-a889-7cb85ca5a958,
exit0; transport fields are in `review.log`. This was an architecture review with
two in-memory fault/resource reproductions, not final browser acceptance.

| Recommendation | Disposition |
| --- | --- |
| Preserve committed states across the display clock | Adopted: descriptors retain committed right brackets and exact resource boundaries; refresh before exceeding their physical frontier/validity. |
| A halt only shortens view validity | Adopted: early scrubbing retains its known-at coverage; playback can drain to the physical fault before stopping. |
| Separate cursor, frontier and join edge | Adopted: cursor runs on presentation dt through committed history; frontier refills at most one unit per outstanding request. Live joins the buffered edge without rewinding or jumping while already live. |
| Prime before displaying, stop priming on terminal/error | Adopted in adaptive worker setup. No physics clock or admission change. |
| Structural incoming prefix reuse | Adopted: definition/anchor/contiguity/committed prefix checked; quiet ownership occurs after reused controls. Loaded subsequent controls solve afresh. |
| Keep runtime block/event before-and-after comparisons | Adopted; dense whole-grid equality moved to regression tests. Canonical replay, clearance, capture, funding and reserves remain. |
| Count resident guide and best candidate | Adopted in the220,000-node speculative guard, with shared guide prefix counted once. |
| Retain128 total, not128 behind cursor | Adopted: at full16 lead,112 units remain behind the viewing cursor. No new larger retention budget. |
| Measure buffer adequacy through multiple windows | Browser timing/rollout artifacts record the tested bounds; no smoothness promise at arbitrary speed or hardware. |
| Baseline artifact discrepancy | Corrected: the first profile command's timing output was overwritten by the optimized probe before a copy completed. `baseline-timing.json` restores that captured output (26.1627s) and matches the initial CPU profile; optimized `timing.json` is19.3924s. These are host wall timings, not isolated CPU microbenchmarks. |

The16-unit lead is a presentation constant, scoped to adaptive service. The viewer
never extrapolates through missing physics, accumulates underflow catch-up debt, or
changes route selection with wall time. Higher speeds can consume the buffer.
Pause/hidden stops refilling except the pending acknowledgement; switching/restart
retain their worker generation semantics. Original analytical, surface and maintained
runtime clocks retain their behavior.

See [literature synthesis](../../../reports/Efficient%20orbital%20stationkeeping.md)
for orbital elements/deadbands, analytic control sensitivities and force-convention
limits. Those are future numerical/policy experiments; this slice removes redundant
work and buffers actual committed execution without simplifying the dynamics.
