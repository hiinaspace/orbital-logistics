# Astra review disposition

2026-10-13 client date. Transport checked before final-review content: gpt-6-astra/high, CLI read-only, session01a137cc-2732-73b1-b1d6-ba32fcb4c443, exit0 and nonempty output. Reviewer inspected source/baseline; it did not run new numerical or browser tests. Main-loop source spot checks and follow-up controlled browser probes are recorded below. The human's answers in clarifications.md supersede tentative Studies/floating options read during dispatch.

| Recommendation | Disposition |
|---|---|
| Extract session publication, not merely globals into classes | Adopt. Only session ingests/advances/releases; resolve pane transitions before drawing. |
| Worker revision is insufficient as display freshness key | Adopt after verifying TrafficViewStore.view(cursor) uses admittedAt≤cursor and cursor-dependent dense/future coverage. Preserve adapter freshness rules and once-per-session bounded refresh. |
| First baseline confounds camera+epoch with relief | Adopt. Label original data an experience comparison, then run held16/rotating/oblique off-on-off probe. Controlled1080p stays~60fps,4K relief~30fps; playing4K relief remains slower. No isolated GPU attribution claim. |
| Relief already has1024px longest-edge cap | Verified source and adopted. Remove simplistic lower-resolution-relief cure; investigate actual surfaces/refresh/composition. |
| Full-system refresh~10.9ms p95 can itself matter | Verified baseline and adopted. Compute publication/timelines once per session, measure copying/query/refresh separately. Don't sum noncoincident percentiles. |
| Disposal and aggregate accounting precede duplicate panes | Adopt. Add/remove close loops cover worker/context/buffer/listener/canvas ownership before multiview release. Two bounded independent instances first; defer general shared-GPU/cache scheduler. |
| Metadata catalog and entry boundary early | Adopt. Separate pure metadata from loaders; viewer+existing worker chunks first, per-domain chunking only when measured. |
| Keep20normal/23Studies and search archives | Superseded by human direction. No Studies UI. Revised source-composition audit proposes11current exhibits and32retirements; Git preserves old content, shared regression/build inputs remain as needed. |
| Independent selection, explicit activation, pinned tracking target | Adopt. Active selection only; pointer crossing doesn't retarget inspector. Wheel may affect hovered view without switching inspector. Separate targetId avoids accidental camera cuts while inspecting another actor. |
| Horizontal/vertical two panes, no recursive/floating manager | Adopt and strengthen from human layout clarification: docked library/inspector/timeline, small local pane controls, collapse/maximize for spacious observation. |
| Frame changes preserve physical viewing pose, Fit explicit | Adapt. First extraction preserves established frame-choice behavior for parity. Eliminate accidental refits on resize and mutations from render; named presets intentionally recenter. Decide finer frame-choice pose policy at the first viewing gate rather than silently changing accepted behavior. |
| Poster first, then tiny hero after lazy boundary passes | Adopt. Semantic HTML, explicit viewer entry, reduced motion/noJS/static-subpath/Back tests. Hero imports cannot bring full simulation dependencies. |
|8.3Mpx is a proposed ceiling, not performance evidence | Adopt. Whole-workspace budget plus explicit surface accounting; exact values calibrated against real two-view/frame-gap tests. Rendering quality never changes canonical physics/time. |
| Concrete desktop/mobile/semantic gates | Adopt with honest scope. Three30second runs on named desktop, ordinary1080p p95≤18ms and heavyconfiguredfallback≤35ms, interaction≤100ms; lifecycle20cycles. Current3second headless data is only a baseline. Mobile commitment initially landing360CSSpx; real-device viewer30fps gate later. |
| Broad schema/domain rewrite or renderer migration | Defer. Keep Runner/services numerical semantics. Narrow application interfaces, retire unreachable presentation loaders; change expensive representations only after profiling. |

## Source spot checks

- src/traffic/view.ts:36–67: cursor admission/dense rows and predictions vary inside one worker revision.
- src/view/relief.ts:60: existing1024longest-edge allocation; hide() retains resources, motivating true dispose.
- src/main.ts:799: Relief from Top changes camera to oblique, explaining the initial confound.
- baseline.json:4K full-system refresh p95~10.9ms and draw~9.1ms; DOM273–374. Heap is page-only and sequential/GC-dependent.
- Controlled probe: sameheldtime/frame/camera off-on-off,3second samples,DPR1; all metadata retained. No actual phone/GPU-process measurements.
- Parsed source equality independently confirms the staged and lunar-ground duplicate composition claims in catalog.md.

The first implementation gate is one-session/two-pane docked workspace with local controls/selection and shared playback. It includes the loading seam and disposal, not a numerical-engine rewrite. Layout spacing and preset ergonomics still need owner viewing after real implementation.
