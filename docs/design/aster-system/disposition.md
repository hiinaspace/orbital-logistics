# Astra disposition — 2026-10-11

Requested Astra reviews ran through Codex CLI 0.153.4, `gpt-6-astra`, high effort,
read-only, exit 0. The preserved transport headers identify sessions
`01a12c0d-f755-7730-8221-4addf544d3cd` and
`01a12c1f-9eb7-7962-910f-a6c7c867859b`. CLI metadata was checked before synthesis;
model identity does not establish that its advice is correct.

| Recommendation | Disposition and checked consequence |
|---|---|
| Begin with one staged mission, courier and two free satellites | Adopted. Seven selectable actors/four ports; no second mission cache or hidden legacy fleet. |
| Extract narrow reusable courier clock | Adopted. Beacon and the combined exhibit share CourierService and CourierViewStore. Existing Beacon conservation and browser regression checks retained. |
| Publish complete snapshots; permanently halt after unexpected private failure | Adopted. Forced final-packet rejection after child advancement leaves the published frontier and frontend poses/resources unchanged; retry refuses. |
| Check frontend combined storage before publication | Adopted after implementation review reproduced a late rejection. Component and aggregate sizes now admit before any store swap; injected oversized cold rows reject while the prior scene remains usable. Courier presentation takes explicit composition limits instead of inheriting Beacon's 84 MB ceiling. |
| Count tanks once and keep separate calendars | Adopted. Stack has assembly identity, not another inventory; long rollout checks three staged tanks plus courier fuel/parcel conservation. |
| Measure construction/cold packet, raise fixed-composition physical cap | Adapted to separate 220k/80 MB construction and 200k/70 MB retained caps. Measured construction ~172k/53.42 MB; cold three-cycle packet 59.25 MB. Templates counted separately. |
| Admit lunar satellite separately | Adopted. Trial r=.48 failed around t=631; r=.35 passed a 2,048-unit search rollout and 1,024-unit integrated exhibit test. h/2 and independent DOP853 check through128. No eternal stability claim. |
| Fixed epoch markers, not a rolling sample-array phase | Adopted. Dyadic absolute grid, bounded prepared queries, faint support curve. |
| Marker visibility must also come from fixed epochs | Adopted after implementation review reproduced reassembly flapping. Added queries reconstructed on either side of reassembly and reverse playback; presence/opacity now comes from the prepared provider. |
| Separate CPU reconstruction/projection from renderer migration | Adopted. Frozen/bodies-only, 1x inertial and16x rotating cases at1440 and4K. Optimized measured CPU costs and offscreen clipping; kept Canvas and existing scrolling timelines. Normal playback meets30 FPS at1440p/24 FPS at4K; the extreme close4K Chase case improved from17 to23.9–24.7 FPS and remains borderline, rather than an unconditional24 FPS pass. |

Spot checks matched the reported dash origin, moving cursor insertion and late
aggregate guard locations. Both implementation findings were independently exercised
by regression tests. Free-flight fault-history and event/resource checks passed.
Human visual preference for activity/density remains the next gate; no pending
architecture approval is required for this admitted slice.
