# Proposed release catalog

2026-10-13, revised after the user's explicit preference to retire superseded entries entirely. Implemented in src/viewer/catalog.ts for the workspace slice. Current43visible entries → proposed11. Git retains retired authored compositions; required regression/build inputs can remain outside the public catalog.

## Keep

| Family | ID | Public short title | Distinct subject |
|---|---|---|---|
|Aster–Selene|aster-selene-system|Full service|Staged expeditions, lunar operations, relay courier and free satellites together.|
|Aster–Selene|aster-selene-cycler-fleet-service|Cycler fleet|Recurring mostly ballistic carriers, later-carrier rider returns and long ground/parking dwell.|
|Aster–Selene|selene-ground-service|Lunar ground service|Northern lunar pad and inclined depot in a moving two-body field; different route from the Beacon courier.|
|Aster–Selene|lunar-loop|Lunar loop|Quiet distant retrograde orbit, different from the full-service local satellite.|
|Aster–Selene|aster-northern-launch|Northern launch|26°atmospheric launch, inclined station visit and reusable stages/ocean returns. Full service's launch is equatorial.|
|Orison|orison-freight-district|Freight district|Surface feeder and neighboring orbital logistics through a shared hub.|
|Orison|orison-relay-network|Relay network|Two maintained relays and visitors under lunar perturbations.|
|Orison|orison-steered|Inclined transfer|One smooth35°plane transfer; the maintained network is planar.|
|Helion–Orison|helion-orison-observatory-mission|Observatory mission|Launch, booster return, parking and halo departure/insertion.|
|Helion–Orison|helion-orison-survey|Continuous survey|Maintained nonplanar Lissajous-like figure over a long history.|
|Sol|solar-cycler|Mars cycler|Distinct Solar scale, geometry and timescales.|

Names can omit the family prefix while displayed inside the category. Preserve stable IDs for surviving direct links. Optional Featured/Recent shortcuts reference the same metadata record; with only11sets, do not repeat eight of them in another large tree. Suggested first landing highlights: Cycler fleet, Full service, Observatory mission. Returning visits can resume the last chosen exhibit configuration; fresh Open viewer can favor the cheaper Cycler fleet rather than making the largest8-second cold preparation the default.

Finite/continuous is a small mode badge, not an archive or a duplicate-content justification. Consider named phase bookmarks (Halo arrival, Atmospheric return) inside a retained set rather than preserving a whole predecessor merely to start the camera/time later. Bookmark timing must come from the retained program's actual events, not stale duplicated constants.

## Retire from the public viewer

| IDs | Retained replacement / reason |
|---|---|
|orison-freight,orison-powered,orison-service|Freight district. The original four-ship composition is attractive, but sharp impulsive motion is the exact older aesthetic the user identified as superseded.|
|selene-freight,selene-powered|Full service / cycler fleet: newer lunar journeys and smooth paid thrust.|
|selene-ascent,selene-return,selene-staging,selene-service|Lunar ground service / northern launch / full service cover launch, return, staging and sustained operations.|
|aster-entry,aster-launch|Northern launch includes atmospheric return and inclined launch; standalone immediate entry can become a phase bookmark if wanted.|
|crossing-planes|Inclined transfer replaces the impulse geometry demo with smooth thrust.|
|orison-maintained,orison-maintained-service,orison-flexible-service|Relay network supersedes progressive one-lane/strict-schedule prototypes.|
|orison-direct-surface,orison-low-orbit-shuttle,orison-latitude-shuttle,orison-shuttle-service,orison-surface-flexible|Freight district; northern/off-plane ground routes remain in retained lunar/northern-launch scenes.|
|aster-selene-expedition,aster-selene-service,aster-selene-crossings,aster-selene-beacon|Full service includes the newer staged mission/courier/activity composition.|
|aster-selene-staged-expedition,aster-selene-staged-service|Full service embeds these exact source compositions; being finite/quieter alone does not earn another catalog item.|
|aster-selene-cycler-fleet|Same carrier/rider mission composition as continuous fleet; recurrence/longer tail is the intended successor.|
|aster-selene-cycler|Earlier short-lunar-visit/immediate same-carrier return. Although itinerary differs, the fleet's later-carrier dwell was requested specifically to replace this high-Δv timing constraint. Keep the accepted fleet as the public cycler.|
|sol-earth-halo,sol-earth-lissajous,sol-earth-observatory-insertion|Full observatory mission includes halo/departure; maintained survey replaces the finite survey composition.|
|selene-ground|Continuous lunar ground service uses the same physical source.|

32retirement candidates +11kept =43current entries. Distinct content checks were read-only, not a deletion audit or a new physical validation.

## Verified dependency/composition facts

- Parsed deep equality: staged-service.source equals staged-expedition fixture; full-system.source equals staged-service fixture. Source fixtures therefore remain compilation inputs until build tooling is deliberately changed.
- Continuous lunar-ground.source differs from finite lunar-ground in exactly description/provenance, not physics/programs.
- Finite fleet and continuous fleet retain the same rider missions/exchange identities, with differences in tail/correction/sampling rather than viewing subject.
- Single cycler lands atHaven73.5 and relaunches74.5 to board Wayfarer79.5; fleet waits to120.252338 and boards Nomad136.252338, adding lunar parking/dwell. That is a real difference, but it is also the earlier timing problem the user asked the fleet to solve.
- Finite Lissajous and maintained survey are not byte-identical physics: seed, engine and exhaust differ. Retirement is an editorial successor decision, not an assertion that controls/geometry are equal.
- Northern atmospheric launch uses26°latitude; lunar ground route uses20°; inclined-transfer plane change35°. These expose behavior not duplicated by the planar maintained network or equatorial full-system launch.

Before implementation: run dependency reachability for each removed import/fixture/profile/builder; prune unreferenced demo assets, preserve shared numerical witnesses, reroute retired deep links intentionally (replacement or informative missing-set state). Don't silently load an unrelated default. Update browser selectors/tests and canonical loading fixtures together. User-owned research files remain untouched.
