# Finite pass-through service implementation review

User accepted the zero-thrust research plot and explicitly requested redesign:
early launch into real Aster parking/phasing orbits, shorter orbital connections,
separate descent phasing; proceed. Prior Astra pass-through review is in ../pass-through.
Main proposes finite two complete carrier circuits and two actual Pipit round trips;
continuous free-carrier correction/resource closure remains a later gate.

## Verified baseline/environment
- Repo /home/s/code/orbital-logistics; branch codex/model-set-viewer; HEAD27a430b.
- Actual prior research candidate preserved in ../pass-through/native.json: period120.50467632722804, zero thrust, within native interval exclusion for3 uninterrupted periods, baseline185100nodes/checks. Full-field DOP853385epochs vs native error1.21e-9position/4.25e-10velocity. These are research facts, not general stability.
- Same field fixed AsterGM1R1 + prescribed SeleneGM.03R.2 at5, rate√(1.03/125), noindirectterm. Carrier initial shifted to originalphase50 and rotated to lunarphase0; independently propagated in redesign/geometry.py, no app changes yet.
- GenericRunner schema duration≤64/nodes≤65536; compact native integrate supports≤80-unit traces, step1/512+halves, moving-body intervalenclosure, exact endpoints. src/compact/physics.ts is reused unchanged.
- Existing compact oldv1/v2 validators and continuous caches remain unchanged for historicaltests. UI replaces their finite/continuous menu entries; misleading Beacon-stop service is retired from active chooser. No existing physical guard is widened silently.
- Python spikes/numerics/compact_cycler.py has bounded forward DOP853/cubic control authoring helpers. New author.py uses them for physical ground burns, literal orbitalcoasts, two finitepulse transfers. Endpointcontinuation is actual; targeting roots have explicit call caps. Native full safety/force/reserve gates still pending.

## Concrete plan to audit
- Separate definition `pass-through-set-v1`, profile `pass-through-profile-v1`; schema1 finiteonly. New `src/cycler/` prepare/view/query, worker admits artifact privately. Profile owns duration2*period, rate/field/hardware, full carrier trace seed+oracle, all absolute shuttle controls/stages, operation epochs and paid flow metadata.
- Native carrier is propagated ONCE through entire finite horizon from preceding actual endpoints. Split ≤64unit segments at all designated board/release epochs so physical targets are exact native nodes, never Hermite drawing. Every trace contributes to one aggregate node/check budget ≤240k/400k atbaseline; calibrationhas explicit separate bound. No modulo reset, virtual Beaconcapture, refuel orcarrierthrust.
- Native shuttle executes chronological launch→flightparts→board→ride→release→flightparts→land/unload/refill; second roundtrip is independently authored/replayed at true absoluteepochs. Shifted frozen controls are permitted seeds, not shifted physical targets; dependent native carrier states are authoritative. Intermediate parking/insertion endpoints do not snap or impart unpaid velocity. Only physical carrier/ground captures debit residualspeed+1e-8, position/speedallowance below1e-7.
- Ownership: carrier4dry+6fuel separate fromPipit1dry+3fuel+.15cargo. During ride display carrier wetmass includesactualPipit mass, nofuelduplication. Carrier gravity doesn'tdependmass and hasnoengineburn. Shuttle thrustforce=wetmass*commandedaccel, fuelrocketlawVe4 anchored at cargo/refillchanges. Boundedmaxaccel4/maxforce16.6 unchanged. Reserve.3atbothlandings. Deliveries.15 consumed; contemporaneous cappedfunded refillsimports knownexactepochs, notfreecyclefuel. Two finiteperiods, four deliveries. Nativeflightfault/refusals rejectcompletepreparedset; no partial admission.
- Presentation: finiteabsolute `ownSample` helper may be reused from compact/query but NEVER modulo sampleCompact; newVesselView sampler discriminator and SceneView resource branch. Two surfaceports only Cairn/Haven; no Beacon. Groundaxis followsnormal; same smoothrocket/exhaust/3D/frame/UI. Clear phase labels parking/phasing/coast/braking/descent; fullpathtwoT forecast/trailspan adjusted. Canonical queries remain worker-only; frontend uses bounded denseHermite samples. Finite Replay visibly rewinds resources, notcontinuous service.
- Storage: profile≤2MB, baselinephysics≤240k/400k acrosscarrier+shuttle, displayed≤32ksamples/12MB andcompleteworkerreply≤16MB. Intermediate retiredtrace refs released; no hiddenduplicate fullcycleparallel state. No newworkerrollingprotocol needed.

## Open decisions / lean
1. Finite vs continuous now: finite completes authorizedredesign and native/pacinggate; indefiniteactivecarrier shouldnot inherit oldresetcache. Prefer finiteuntil ownerwatchesnewtaxi; continuous correction provider separate.
2. Can reuse compactownSample/types as boundedphase primitives vs duplicate? Leanreuse explicitlydirectfiniteonly, wrapper preventsperiodmodulo; testatactualperiodboundaries plusfullhorizon.
3. Is two fullroundtrips too dense? Twoactorsoneclock≤4deliveryevents keepssimple andvalidateslateepoch/resourceownership; parkedcoasts andbodyrelativeviews wanted. Avoidmorecars/halo stations.
4. Riskmostlikely: targetnative/DOPdrift during verylowheightground operations and secondlatecycle. Need strictcapture/safety/oracle; rejectcandidate iffails, retargetcontrolsnotwaivers.

Read-only design/code-plan review; verify sourcefacts thenrankissues. Bounded6files/10minutes, noimplementation/noexpensive simulations/nootherreview subprocess. Focus on physics/resource boundary and finitecounterexampletests; don't repeat current prior research literature. Report if any blocker before wiring UI. Main will spotcheck/synthesize and perform native/browservalidation.
