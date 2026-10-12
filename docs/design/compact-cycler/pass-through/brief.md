# Pass-through cycler design review

User rejects compact cycler again: Wayfarer brakes/turns around to stop at Beacon instead of completing a flyby recurrence; Pipit lands shallowly. They suggest an Aster parking orbit and link https://space.stackexchange.com/questions/66520/does-a-lunar-cycler-make-practical-sense . Earlier user explicitly authorizes Astra senior review for cycler direction. This is a small hobby viewer; keep it watch-first, not a scheduler game.

## Verified current facts
- Checkout /home/s/code/orbital-logistics, branch codex/model-set-viewer, HEAD8ef460a, current preview4178. No app changes this round.
- src/compact/prepare.ts explicitly starts/stops Wayfarer at stationary rotating equilibrium Beacon; resource closure/support are required. Fuel restoration there is funded. Runtime cycle transform in src/compact/engine.ts relies on that admitted state/resource closure.
- Field is fixed Aster GM1 radius1 + prescribed Selene GM.03 radius.2 at5, rate sqrt(1.03/125), no indirect term. Autonomous in rotating frame, so symmetric periodic shooting is feasible. It is not barycentric CR3BP; copying real orbit states is invalid.
- Current period74, literalcoast64, carrier corrections1→5/69→73 totaldelta-v1.55. These are not small phasing corrections; strengthening engines did not fix topology.
- Native integrate src/compact/physics.ts safety encloses intervals and supports1/512 plushalf/quarter; trace interval≤80, node/workguards. Drawing interpolation never targets/resumes.
- Research-only pass-through/search.py and continuation.py root full symmetric rotating orbits with DOP853. Some whole-state closure<1e-10 but morphologies fail: broadouterones missSelene; closerprimaryones don't reachmoon orbit; outer.py found mostlyDRO-like roots awayAster. Crossing search underway; only sampledclearance thusfar, no nativeadmission or stability guarantee.
- NASA2015 https://ntrs.nasa.gov/citations/20150018049 has modestcorrection free-return cycling with holdingorbits and flybys, no full carrierstop at L2. NASA2022 https://ntrs.nasa.gov/citations/20220013595 compares resonantfamilies/groundaccess; landing modeled as flybyretarget/circularization/finaldescent, finaldescent not costed there.

## Recommendation / open forks
1. Replace mandatory Beaconstop with a pass-through carrier that begins already in flight. Seed/search its complete natural recurrence first; add small finite phasing corrections only if ballisticfamilies fail morphology. Beacon may be backgrounddestination or removed. Do not keep optimizing a stop/shuttle and call itcycler.
2. Gate finite twoor-three carrierpasses in inertial+rotatingframes BEFORE taxi authoring/continuousmigration. Numeric rank uses both-bodyencounters, outwardextensionpastmoon orbit, absencepoweredturnaround, correctiondelta-v relativecarrierorbitalvelocity, fullintervalsafety. Humans judge looks; no invented scalar score claims.
3. Pipit architecture: groundlaunch→real lowAsterparkingcoast→matchingcarrierwindow; onreturn detach→orbitalcapture/coast→terminaldescent. Existing shallowdirect curves come from connectingendpointpositions too directly. Adjustpadphase/period/bodyratios allowed. Groundtaxi may need differentvehiclepairs rather than forcingonePipitroundtrip inonecarrierloop.
4. Continuous: stop-independent recurrence needs newversion and newresourceclosureproof. First paidsmallcorrection/explicit physicalclosedcycle; no arbitrary free resets, freefuel or fakeBeaconcapture. Alternatively boundedfreshpropagation+rareonlinecorrection. Do not make existingbudgetguards disappear or treat DOPclosedorbit as foreverstable.
5. L1/halo/lissajous future set separate; do not merge it with thiscyclergate.

Rejected: shortenBeaconburn again; strongerPipitengines; cosmetic curve/attitude edits; loosersafety or hiddenimpulses. They do not address the user's root complaint.

Read-only review. Verifycheap source claims first, labelverified/inferred/unknown; prioritize recommendations and one concrete finite gate. Noimplementation, noexpensive broadsearch, noCLI subprocessreview delegation, no userquestions needed unless genuine missingtaste decision. Budget roughly10minutes/6files. Report whether this approach is justified or a smallerplan is better; identify recurrence/cache traps. Main loop handles review synthesis.
