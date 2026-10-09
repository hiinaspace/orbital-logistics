# Flexible maintained service — verified architecture brief, 2026-10-09

## User request / scope

User accepted diagnosis/performance fixes at f799e556 and says continue flexible
schedules/relay dwell: industrial timing can flex to keep the model set busy/active.
Earlier session explicitly authorized Astra senior reviews for consequential
stationkeeping/operations architecture. Watching/inspection remains sufficient;
no manual editor/puzzle, general economy, many ships or LP scheduler this slice.

## Environment / verified evidence

| Fact | Evidence / verification |
|---|---|
| natto, repo /home/s/code/orbital-logistics, main model gpt-6.1-sol | live checkout, session transport; no implementation delegation required |
| branch codex/model-set-viewer, HEAD f799e556c45ac5b07f61a3d62c57c9fb3ea86745 | git; unrelated reports/ and research_notes/ untracked, leave untouched |
| TS7/Vite8/Node22, canonical h1/256, normalized planar field | package.json, maintained fixture/schema; no Python runtime dependency |
| preserved old finite/analytical/surface sets | src/main.ts; new semantics must version-gate and retain snapshots |
| worker owns physics/solver, one outstanding request, 24 work steps | traffic.worker.ts/main.ts; trial integrations yield; no wall-clock physics |
| fixed maintained domain1: owner appends immutable eight-unit control chunks,40 future,128 history | src/maintained/world.ts/engine.ts/view.ts |
| station dry4/fuel.6/ve3/F.06/a.012, visitor dry1/cargo.05/fuel.9/ve3/F.8/a.4 | fixtures/traffic/orison-maintained-service.json; controller reserve.1, visitor .05 |
| powered-ports-v4 supports station burn programs, forbids attached maintenance | sim/schema.ts validation + Runner; half-open quiet attachment only |
| full target lease reconstructed from canonical physical definitions, checked each grid/event | maintained/planner.ts; never drawing interpolation |
| station controller phase-free geometry, controls first4 of each8, quiet remainder | world.ts; deadbands .001/.0003; bounded64-evaluation fixed pulses |
| old pairs14/2/14+home2, depart6+8n, one seeded family, no cost rank | planner.ts/seed.ts/shoot.ts |
| actual1536 run17 returns/108 failed windows; fuel reserve restricts controllers near800 | follow-up/rollout-before.json; no runtime/storage failure |
| first delta-v .7759, minimum radius1.1302; ideal two-body economical dwell23.496 | follow-up/README.md/probe data; analytical figure not admitted route |
| componentwise search cube is stricter/axis dependent than force sphere | shoot.ts; correct in new search, calibrate rotations/convergence |
| new display caches/batching preserve history knowledge/held pose | f799e55 tests/evidence;145 existing+new sim,27 Chrome +3 repeats |

## Mostly-worked proposal (opinions / unimplemented)

Lean a separate versioned adaptive maintained runtime (may reuse engine/store)
with **joint paired admission**, physically passive docked Tern, and an authoritative
station owner. Reject the existing fixed14/2/14 family as the organizing constraint.
Do not silently change the old maintained fixture/snapshots.

1. **Short idle commitment; private conditional planning.** Keep actual history and
admitted future controls immutable. In idle, commit only the next canonical8-unit
station/origin chunk. Search a bounded departure interval ahead (roughly next4..16
units), with flexible outbound arrival/duration and longer quiet return departure.
Tentative candidates extend private owner chains, including their own capture/mass/
fuel calendar. No provisional chunk becomes public actual or accepted forecast.
When a complete paid pair passes admission, atomically promote its owner chain and
visitor plan; station controls, attachment/refueling/release become frozen until
that pair finishes. Retry at later controller epochs after failures. Previous
physically valid admitted pair never gets retargeted by later display/solver work.

Why: extending unconditional station controls40 units before a docking decision
cannot remain immutable when station-only thrust must carry newly attached mass.
Giving provisional futures revision IDs/history instead would complicate the old
scrub contract. Joint admission avoids stranding Tern while attached and makes the
old forecast-owner contract explicit rather than quietly rewriting its tail.

2. **Aggregate mass/tanks; canonical segmented target lease.** For station burning
while attached, station's engine accelerates dry4 + station fuel + visitor dry1 +
cargo.05 + visitor fuel. Visitor engine is off, visitor fuel unchanged except
explicit relay service. Model visitor carried mass as additional nonfuel mass in
the station's local Runner; its engine consumes only station tank fuel. Target
segments can have different dry/ballast mass and fuel anchors at capture/refuel/
release. Reuse canonical Runner/dynamics/mass-law for each segment; preserve
absolute canonical steps and exact event boundaries. Author a new physical
powered-chain rail / logistics model version covering ordered segments, physical
anchors, controls, ballast/tank changes, world/policy and attachment identity.
Validate join state/fuel continuity, allowable mass/tank changes, capture/release
identity and paid residuals. No caller-owned opaque physical provider hidden from
bundle JSON. Old powered-ports-v4 continues rejecting attached burns.

Candidate construction: solve outbound against unattached owner; execute paid
capture prefix to obtain exact donor state/fuel; choose relay wait and potential
refuel; recompute future station controls with aggregate ballast; start return from
actual released state/fuel; solve return against ballistic Equator; run full paid
visitor program with the chain provider, and compare provider to owner over every
canonical/event time before admission. The capture correction's tiny fuel cost
must be included in ballast, not approximated by the uncaptured shoot result.

Keep capture/refuel/release outside station burn intervals initially. A docking
change during a burn is unnecessary for this fixture; versioned quiet boundaries
keep splitting/active mass-law changes manageable. Alignment samples may be
continuous/canonical fractions within those quiet intervals, not always offset6.

3. **Bounded economical search.** Use two-body phasing/Lambert only to seed/cheaply
rank candidate schedules; all successful legs run the existing finite-pulse
canonical shoot and production admission. Begin single-revolution/non-assist
near-Hohmann family with variable flight time and actual future endpoints. Joint
cost uses paid visitor + maintenance fuel and wait/total duration; prefer regular,
near-orbit traffic rather than the first expensive feasible flyby. Bound attempted
schedule candidates, shoot evaluations (including Jacobians/refinement), provider
preparation and retained nodes separately. Search force vectors in norm-bounded
sphere, not axis-dependent cube. No claim of global optimum/no-route proof.

The exact bounded schedule grid/weighting is open: should first admit an adequate
low-fuel candidate after local ranking or compare a few fully solved candidates?
Lean at most4–6 full schedules per dispatch opportunity (96 per leg), prioritize
near-Hohmann phasing/cost cheap scores, and hard reject qualitatively inappropriate
close-passage branches for this particular service fixture if a documented
operating corridor is needed. User prefers active believable traffic, not max
throughput at any fuel cost. Do not arbitrarily increase budgets to hide bad seeds.

4. **Explicit station refueling (if manageable).** New tank ownership can support
an atomic relay service transfer: station top-up toward .6 from Tern, bounded by
Tern's safe return reserve and tank capacities. No injected station fuel/reset.
Transfer reassigns mass between visitor ballast and station fuel, preserving total
aggregate mass; subsequent station burn pays its own tank, released visitor carries
reduced fuel. Origin's existing finite buffer and explicit external supply refills
Tern at home. Track global stock+both tanks+burn usage invariant. Freeze transfer
and post-transfer owner chain in admitted pair. Ship should actually deliver fuel,
not conjure it when the station asks. If transfer adds unnecessary complexity,
separate it but retain a finite-fuel long-run gate and honest eventual coasting.

5. **History/view/bounds.** Reuse128 rolling actual history, one pending held reply,
exact event-left states, immutable admitted plans known only from admission epoch,
scene query cache. Forecast drawing can remain40 even if complete admitted future
pair lasts~50–70 units; physical owner/visitor retention must cover its full lease.
Budget candidate chains and full proof separately from visible history. Estimate
~96 future units ×256 steps ×3 owner paths =74k nodes, plus visitor/provider;
measure and impose a specific cap (<~180k total) rather than pretending old50k
owner guard suffices. Eight-MB display/reply bound should stay; dense trajectories
already~32 samples/unit, decimate drawing only if required, retain event samples.
Idle view shows only committed maintenance and attached motion, not speculative
successful transfers. Show service/dwell/fuel timeline plainly, no verbose caveats.

## Open architectural forks / alternative rejected or conditional

- In-place tail revision vs new versioned domain with short idle commits/private
  joint candidate: lean new, retain original immutable fixture as baseline.
- Passive aggregate docking vs co-thrust assistance vs formation waiting: lean
  passive real attachment because docked mass is central semantics. Co-thrust
  could maintain the old station path with visitor tank paying proportional
  acceleration (same ve3), but changes operational policy and needs commanded cap
  matching. Formation holding could remain free-flight, but calling it docked
  while hiding the ship's maintenance is misleading. Could use either if you
  identify a materially simpler, honestly presented physical model.
- New rail chained Runner definitions vs broad general coupled-fleet solver: lean
  bounded chain format for one visitor, no universal ECS/fleet integrator now.
- Flexible pairs vs independently solve only outbound: lean paired admission
  avoids missing return after attachment; station demand/interrupt fleet dispatch
  remains future work.
- Phase-locking Meridian or prescribing an ideal station rail: rejected as the
  main remedy (early drift small; radii imply distinct natural angular speeds).
- Timing/cost search and docked ownership may be one decision: merging/reranking
  these is explicitly in bounds. You may recommend a smaller first slice.

## Requested review / depth budget

Verify the load-bearing code/evidence claims first, label verified/unverified,
then prioritize the decisions by leverage and deep-spec your chosen keystone.
Budget roughly6k response tokens, local code/evidence reads and small arithmetic
experiments only. Do not edit files, launch paid reviewers, or re-review graphics,
legacy manual editor, complete scientific orbit validity, unrelated consultants.
The new implementation is not written yet. Identify truly human decisions vs
choices we can make under the user's stated active-model-set intent. Specify
concrete finite and long-running admission/conservation/canonical-history tests
that can falsify the chosen architecture. No enterprise ceremony.
