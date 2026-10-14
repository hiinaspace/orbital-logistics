# Viewer product/architecture review brief

2026-10-13. User requests a planning/polish round and a deeper **Astra** review. This is a solo hobby viewer: an orrery with working spaceships, not a game/editor. Do not implement during review. Verify load-bearing facts before critique. Prioritize your own findings; spend depth on the highest-leverage decision, not every subsystem equally.

See also clarifications.md for answers received after dispatch.

## User goals and human questions

Accepted 43 current sets and simulation scope. Wants a curated hierarchical set library with brief descriptions; simultaneous frames/cameras/relief; improved grouping of camera/layers/trails/presets; architecture/refactoring and runtime/storage/rendering fitness for desktop. Mobile viewer is optional/lower priority. Deployment should be a static descriptive landing page with a lightweight living hero, then explicit entry to the heavier viewer. No deployment target or public name change requested.

User answered after initial draft: primary layouts are overview+ship Chase, inertial+rotating, top+front. Selection must affect only the active pane. Fully superseded sets should retire from the viewer/tree entirely, left to Git history; do not add a public Studies/archive section. Keep genuinely distinct quiet compositions. Separate catalog retirement from safety regression-fixture retention and dead-asset cleanup. The user floated mouse-following active view; current lean is explicit activation on pointerdown/focusin so traversing toward inspector doesn't retarget it.

## Verified environment/source facts

| Fact | Evidence |
|---|---|
| Current commit7e9936b, branchcodex/model-set-viewer; only user research paths were untracked before this planning directory | git status/rev-parse, 2026-10-13 |
| Vanilla TypeScript/Vite, layered Canvas2D foreground + potential backdrop, WebGL relief; no React/DOM/SVG scene graph | package.json, src/main.ts:137, src/view/relief.ts |
| 43 registered entries,27finite/16continuous in one native select | src/main.ts:117–125, source catalog audit |
| One scene/time/continuous request stream but camera/frame/selection/layers/labels/hits/field instance are global | src/main.ts:137–176,490–513,543ff,881–906 |
| Physical frame transforms already pure explicit scene/state/epoch/frame; original per-vertex epochs matter | src/model-set/frames.ts, camera.ts, model.ts |
| Resize refits, which would erase pan/zoom when resizing splitters | src/main.ts:812–817 |
| Inspector/timeline partly frame/selection dependent; selection currently also retargets tracking | src/main.ts:200–219,315–445 |
| Potential field capability currently only compact historical fixed-primary model, not every binary/Solar scene | src/view/potential-field.ts:8, main.ts:565; retain this guard |
| Field instances own workers/cache and relief GL resources; no whole-workspace disposal/aggregate budget | src/view/potential-layer.ts, relief.ts |
| Entry HTML empty untilJS; main eagerly imports fixture metadata/data and both simulation workers inline, loads default set and starts RAF | index.html, main.ts:1–135,906 |
| Built entry990580bytes raw; preview resource encoded267326bytes (local response). Heavy trajectory profiles are separate1–13MB JSON assets | dist/assets, baseline.json |
| Existing canonical model, versioned services, ownership/resource invariants, held-history behavior have extensive numerical evidence | docs/model-set.md; current libration extension evidence; preserve domains, do not rewrite numerical engine |

## Fresh bounded baseline (not a mobile or long-run benchmark)

`profile.mjs` launches isolated headless desktop Chrome against current production4178. DPR1, three-second steady samples, playing at existing default rates; no owner tab interaction. Baseline.json retains exact records. GPU/compositor/worker memory not measured. JS heap is page-only, GC-dependent, not per-set attribution. Single run, nonisolated host.

| View | draw p95ms | frame gap p95ms |
|---|---:|---:|
|1920×1080 orbital freight |2.6|16.8|
|1920×1080 full Aster–Selene |6.8|16.8|
|1920×1080 cycler plain / relief |4.2 /2.9|16.8 /33.4|
|3840×2160 orbital freight |3.6|16.7|
|3840×2160 full system |9.1|33.3|
|3840×2160 cycler plain / relief |4.3 /3.8|16.7 /66.6|

273–374 DOM elements; no evidence that DOM scene count is the limiting renderer. Large-scene preparation6.8–8.3s here, off-thread. Main heap sampled18–121MB across sequential scenes, not a total memory bound or leak finding. Relief frame gaps exceed JS draw cost, so changing DOM framework or moving only JS draw off-thread is not a demonstrated cure. Need GPU/compositor investigation and backing-pixel budget before a renderer rewrite.

## Mostly-worked proposal / alternatives

1. **One session, many views.** SceneSession owns set/adapter/worker/generation/immutable scene snapshot/events/one clock/history frontier+held-live state. Each Viewport owns frame/camera/tracking target/selection/layers/trails/labels/hits/field resources/interaction. Workspace owns layout+activePaneId and shared inspector/timeline. Capture one scene/time snapshot per workspace frame and draw all views from it. One pending service request stays global. Opening a pane never clones simulation/history or starts another service. Dispose actual workers/GL/canvas allocations on close.
   - Lean extract Session then Viewport with one-pane parity, before multiview. Preserve versioned domain engines and data semantics. Avoid one generic solver/mega-schema rewrite.
   - Domain adapters can hide existing finite/continuous store unions, without erasing differences. Common rendering queries are already useful; not every domain needs identical internal representation.
2. **Docked two-pane compare first**, shared library/inspector/timeline as separate panels; compact per-pane frame/camera controls. User explicitly noted that fullscreen+floating can conflict with multiview. Explicit horizontal/vertical split, draggable divider, duplicate pane/maximize/close; bounded2panes initially. Single/split layout presets. Independent selection and tracking; selected actor inspection need not silently change the camera's locked tracking target. A link-selection toggle later/initial if trivial, never ties cameras automatically. Timeline click selects actor in active pane; scrub/play/speed always shared. Frame-relative readouts explicitly belong to active pane, while fuel/resources are shared facts.
   - Considered Blender-style arbitrary recursive splits: useful eventual option, but initial window-manager scope/growth/keyboard/pixel budgets are larger.
   - Considered floating PiP: useful later over same Viewport abstraction; main+inset overlaps visuals, increases covered pixels, z-order and pointer problems. Detached browser windows out of scope.
   - Need review of active click vs mouse-follow, view-linked selection, camera-target separation and no surprise frame-fit policy.
3. **Library and controls.** Collapsible left library on desktop, slide-out drawer on narrow screens, Featured shortcuts + system-first categories and short summaries, finite/continuous badges and search. Tentative audit:20normal,23retirement candidates; exact dependency review must distinguish fully superseded composition from unique comparison. No public Studies section; removed display assets/builders can live in Git history, while regression witnesses needed by shared physics stay in tests. Finite quiet versions (halo, Lissajous, single cycler, staged expedition) are distinct, not automatically obsolete. Earlier impulse/fixed-heading or strict scheduling compositions can retire from the public catalog. Do not delete physics modules merely because entries are hidden.
   - Per-pane compact frame selector and Camera/Display controls; group Past trails+length, Future route, orbit guides; advanced Dynamics controls capability-gated. Surface/Entry belongs under an intentional View preset menu (changes frame/pose/scale), not an easy stray button.
4. **Static arrival/loading boundary.** Semantic static HTML descriptive page with poster fallback; metadata-only catalog. Viewer dynamic import and selected scene data/worker loaded on explicit entry. Hash/query routing suitable for static hosts/subpaths, direct viewer links preserved. No worker/large profiles/full viewer bootstrap on landing, even if invisible. Hero optional tiny prepared trajectory clip+small renderer (live display clock, no planner), visible-only at~15–24fps and reduced-motion fallback. Reuse trustworthy prepared trajectory data rather than simulating full service behind landing. Transition starts/opens real viewer session explicitly, no pretending clip resources were sustained simulation. No service worker/backend/SSR framework required.
5. **Performance/storage as measured gates, not blanket rewrite.** Shared physical/query work; projected paths/labels/hits remain per-pane. Lazy fixture+domain-worker loading, remove inline heavy workers, avoid duplicate SceneView deep copies per view, audit repeated disposal/allocation. Profile complete frame gaps plus render/query/panel/worker/copy costs. Start with whole-workspace pixel/DPR budget (foreground provisional~8.3Mpx across panes; separate lower-res relief), bounded aggregate field cache/requests, simplify drawing only. Do not change canonical step, targeting or elapsed sim time for render quality.
   - Provisional desktop goal:60fps ordinary one/two panes at1080p;30fps usable heavy/4K/relief fallback, with responsive controls. Need actual two-view measurement before promising caps.
   - First mobile commitment is landing readability/responsiveness with no viewer download. Future viewer: one pane, touch-friendly controls, capped DPR and labels/path density,30fps goal on named real midrange device. Emulation/CPU throttling is preliminary, not device evidence.

## Candidate sequence and gates (reorder if stronger)

A. Current baseline + curated manifest + Session/Viewport extraction with single-view parity. B. Library/control cleanup and two-pane comparison taste gate. C. Profile/budget/disposal pass against common/large/relief scenes, cold scene loads and repeated switching; only then heavier representation changes if measured. D. Static landing+light hero+direct links and desktop public polish; landing narrow-screen/reduced-motion/noJS checks. Mobile viewer later. Lazy entry/content loading can be introduced early with manifest instead of waiting forD.

Exact tests/gates: bitwise unchanged physical/resources/events at fixed epochs across view counts/frames/quality; one global worker request stream; pane selection/camera/layer isolation; preserved cameras through divider resize; active-view keyboard+inspector routing; held history/reverse/Live+scene switch; worker/GL/cache bytes after repeated add/remove; initial network contains no heavy viewer data/code/worker on landing; direct links static subpath; real screenshot/taste gate before expanding layouts. Use bounded benchmark logs rather than permanent per-frame telemetry.

## Sources / scope

Current official web references: web.dev/articles/vitals gives LCP≤2.5s,INP≤200ms,CLS≤0.1 (landing proposal targets, not current results). MDN Canvas optimizing guide recommends layered canvases/caching/batching and notes high-DPR backing scaling. MDN devicePixelRatio notes modern mobile often>2; squared backing-area cost is our arithmetic inference. No mobile hardware/real deployment measured.

Not-list: no new orbital content, realistic mission reconstruction, controls for maneuver authoring, demand economy, scene solver unification, numerical step changes, native3D renderer or WebGPU mandate, multitab/windows collaboration, real-phone support promise, publishing/deployment in this pass. User research paths reports/Space model set precedents.md and research_notes/Space model set precedents/ are untracked user work; don't edit.

Review requested: audit actual coupling and bottlenecks, rank refactor leverage, choose reasonable multi-view+selection focus semantics and release sequence, identify overengineering or weak assumptions, propose concrete measurable desktop/mobile/landing gates and genuinely-human decisions. Read small files/ranges and baseline summaries, not huge fixtures. No edits, no expensive long numerical rollouts or extra paid reviewers. Return concise priority critique and a worked spec for the most consequential decision.
