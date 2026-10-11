# Full Aster–Selene exhibit: reviewed integration and rendering gates

2026-10-11, natto, cwd /home/s/code/orbital-logistics, branch codex/model-set-viewer,
HEAD d2a987e. Solo hobby viewer: prepared fictional model trains, no general fleet
scheduler or actual NASA missions. User accepted refined staged finite/continuous
mission, wants that operation among more ground/relay/free-satellite activity, and
explicitly permits Astra gates. Main gpt-6.1-sol; review requested gpt-6-astra/high.

## Verified source facts

- `StagedServiceEngine` compiles one refined booster/orbiter/lander mission, then
  uses exact planar rotational symmetry with period103.3853. Three independent
  tanks, funded turnaround imports, explicit shared resource anchors, worker-made
  drawing cycles,128 history/32 lead, physics100677 nodes/30.88MB, template15.21MB.
  Initial packets27.22MB, cold3-cycle packet51.48MB. Main-thread queries are draw
  only, with position-only helper for reference frames. Canonical step1/1024;
  independent full-graph cycles0/17/9000 and h/h2/h4 passed unchanged physical gates.
- `LibrationEngine` currently combines legacy two single-vehicle expeditions,
  actual coasting Wren, and funded Kestrel courier to an actual-field equilibrium
  Beacon. Its `prepareCourier` and query helpers are independent of fleet topology.
  Courier Haven/Beacon32-period paid finite burns, .15 parcels consumed at Beacon,
  supported funded Haven refills, local actual world gravity, compiled once.
  Courier tests/oracle/late absolute phases exist. Beacon station is exactly
  force-balanced under the prescribed field, not a massive-body N-body Lagrange claim.
- Worlds of the refined staged fixture and Beacon sources appear identical by
  bodies/epoch/atmosphere; verify exact equality before reuse. Beacon contains
  standalone courier ports/control/loadout and Wren initial state. Existing global
  engine does not permit swapping its base fleet to staged without an explicit
  new domain/composition; avoid silently changing old version semantics.
- `OrbiterStream` owns exact8-unit canonical chunk propagation at h1/256, keeps
  physical forecasts ahead of common head and128 history drawing. Fault records
  are last-known; physical/frame queries past fault must fail. This supports passive
  free craft, not kinematic orbits. Orbiter provider after frontier is private forecast.
- Main drawing is already Canvas2D with CPU orthographic3D projection, per-vertex
  epochs/occlusion and SVG timelines/DOM inspector. Existing desktop timeline has
  max-height30dvh and vertical scroll. Label width70px currently wraps stack name.
- Main plan line calls Canvas setLineDash([3,5]) from moving current ship position,
  so dash phase slides along the otherwise prepared trajectory each frame.
- Prior bounded Chrome1440x900 inertial playback59fps, selected Eagle-centered
  Follow about34fps after position-only query optimization.4K and this new density
  have not been profiled. Browser tests own4179; existing user preview4178 is retained.

## Mostly worked design / options

1. Content lean: first integrate **one existing staged mission + existing Beacon
   courier + Wren + one inclined lunar free satellite**.7 selectable presentation
   actors (stack plus three persistent stages, courier, two free craft), four ports
   (Cairn, Tranquility, Haven, Beacon). Real field and paid logistics stay inspectable.
   This meets multiple ground/relay/local orbit activity without doubling the already
   ~27MB staged cache packet. A second antipodal three-stage expedition can follow
   only if this density gate is not compelling enough. Alternative reuse all Beacon
   actors would duplicate Odyssey identity/ownership and unrelated fuel transactions;
   reject ghost actors and hidden resource debits. Extending arbitrary shared pad
   routing or a second relay solver now is unnecessary scope.
2. New strict versioned `aster-system-v1` composite: preserve old runtimes. Own one
   StagedServiceEngine, a narrowly extracted courier service (same exact provider/
   resources/cycle materialization), and two OrbiterStreams. Forecast all physical
   free craft privately; validate courier facts before stage commit; publish only
   a complete common epoch packet. No second staged physics compilation. New adapter
   merges one shared calendar/resources, zero cargo/fuel initial ports + explicit
   staged tank/parcel manifests. All identities/worlds/exclusive berths checked.
   Lean bounded extraction of courier logic so old Libration and new domain share it,
   retaining old tests; copying a second resource runtime is a viable smaller
   alternative if extraction risks the accepted set, but generic engine-framework
   rewrite is rejected. Packet/storage guards aggregate unique physical ownership,
   template/drawing and held-reply counts. Unexpected invariant retains lastpublished
   head; isolated passive-orbiter faults leave valid last-known markers only.
3. Stable dotted plan: prefer **prepared physical marker anchors**, not moving
   native dash origin. Candidate A: fixed absolute/dyadic epoch dots using position-only
   queries, with faint continuous support line at close zoom (simple; spacing varies
   with speed). Candidate B: cumulative world-arclength dots on immutable prepared
   drawing segments, with pixel spacing chosen by zoom and anchors rooted at stable
   mission/canonical forecast boundaries (nicer spacing; complexity at rolling seams).
   Candidate C: screen-distance prefix dash offset (cheapest for finite; rolling
   eviction/camera transforms can rephase). Lean B if bounded cache makes it simple,
   otherwise A. Want marker positions stable as playback clip advances and history
   evicts, including powered surface curves and sample seams; frame/zoom changes may
   re-layout presentation, physics never changes. Do not change canonical sampling.
4. Timeline lean: keep individually selectable stage rows and widen label column
   enough for current assembly names; ellipsis + title on narrow screens. Existing
   bounded vertical scrolling should cover7rows; don't preemptively flatten assembly
   burns into persistent-part lanes (could imply those tanks/engines are active).
   Keep focus/button identity while forecast spans update. Nonselected future paths
   remain suppressed, normal labels already stable. Consider a compact timeline
   affordance only if actual screenshots show viewport is overoccupied.
5. Profile gate before renderer migration: fixed production build, Chrome1440x900
   and3840x2160, inertial and rotating, selected stage Follow/Chase and close entry;
   normal layers and bodies-only. Measure rAF gaps, draw/updatePanels/refreshTraffic
   timings, path vertices/label/DOM/SVG counts, packets and materialization cost;
   bounded10-second windows at1x and16x plus crossing a cache seam. Compare prepared
   staged baseline and new set under same viewport/frame. Lean stay Canvas/DOM unless
   measured hotspot is GPU drawing after eliminating excessive CPU queries/geometry.
   Canvas timelines would not fix CPU physical/frame queries. Proposed gates: >30fps
   at1440 normal and no repeated>200ms main-thread gaps;4K >24fps is adequate first
   envelope, prefer60fps. If lower, cull projected paths/reduce display vertices or
   panel cadence before a WebGL renderer. Speed cap only for actual producer bound,
   not to conceal a render cost that is independent of viewer time rate.

Open decisions: Is this content sufficient as the first full-system slice, or is a
second staged ground origin necessary? Where should courier extraction/common epoch
ownership live? Which aggregate physical/drawing/packet limits justify headroom from
measured existing witnesses? Which stable-marker implementation best survives rolling
windows? Identify measurable gates and the cheapest falsifier. Check whether selection
centric dense paths, frame projection or per-frame telemetry are the real bottleneck.

Depth budget: focused source-backed architecture/content/rendering review; no research
sprawl, global scheduler, modified physics, actual NASA-mission import, world scale
changes, or whole app renderer rewrite. Verify load-bearing claims cheaply, label
verified/inferred/proposed, rank recommendations. The user authorized implementation;
leave only consequential taste forks to them, not tasks you can verify. Return review
only; no source edits. Small read-only code experiments in /tmp are permitted if useful.
