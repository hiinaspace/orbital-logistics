# Atmospheric staged mission

`atmospheric-mission-v1` is a finite prepared XY mission around one fixed spherical primary with Z-axis atmospheric spin. It keeps the accepted airless staging and atmospheric-entry discriminators intact.

The lower engine draws only booster fuel. Upper dry mass, freight and its reserved fuel are ballast until separation. Launch releases the analytical pad state only with strictly positive outward radial-distance acceleration, including rotating-air drag, gravity and tangential support. Stage separation closes thrust and transfers the retained seven-state endpoint to two children with zero kick; wet mass and momentum must agree.

The prescribed segment runner integrates gravity, drag/lift, smooth authored steering and fuel at every RK stage. It shares the seven-state RK kernel and half-clearance/speed enclosure with entry. Immutable interval control includes the endpoint. Arc starts/ends, steering keys and acceleration-cap transitions are exact canonical cuts. Analytical mass laws independently reject depletion and check final integrated fuel. Queries never append checkpoints.

Kestrel pays a finite boostback burn, then enters the existing autonomous entry feedback law. Wren pays insertion, captures Lantern with a tiny charged residual, dwells and unloads freight once, releases at the actual station state with its remaining tank, and pays deorbit before entry. Post-unload control uses dry mass alone. Splashdown is the existing descending support-shell root and explicit dissipative impulse; it changes velocity but retains fuel and cargo ownership. Recovered stages remain analytically corotating, without berths or a fictional ocean terminal.

The local entry adapter is valid only for this admitted fixed-body/constant-spin world. Its local physical origin is an actual retained global leg endpoint. Contact, recovered pose, entry/braking epochs and ledger are shifted together. Station and viewer frames always use absolute mission time.

The view stores exact event sides, actor lifetimes and phase-scoped force contexts. Aerodynamic telemetry is reconstructed from displayed state, current mass and the phase's immutable configuration. It is never a propagation origin. Upper-stage outbound thrust remains distinct from recovery guidance. Recovery speed/energy/impulse belong to each stage.

The fixture uses slender ascent CdA0.015 and broadside recovery CdA2 with L/D0.25. That configuration change occurs above the atmosphere; it is an authored vehicle mode, independent of the schematic nose. No attitude dynamics, weather, atmospheric chemistry or temperature is implied. Heat glow is a qualitative proxy.

Physical admission limits the mission to16 units and each leg/entry to32,768 retained nodes; aggregate65,536 nodes,524,288 trials and2,097,152 checked canonical-stage evaluations. Drawing is dense at2,048 samples/unit during free flight and sparse during constraints, with40k samples/12MB hard limits. Sampled stage peaks are load diagnostics; exterior enclosure is the safety certificate. The frozen witness's refined DOP853 loads are comfortably within pressure20, total non-gravitational acceleration4, and heat-proxy10.

Preparation performs no trajectory search. The offline study has bounded least-squares/root authorship, separate from browser work. This exhibit ends at12 units; Replay repeats its same physical/resource history. Adaptive cinematic speed, continuous staged turnarounds, ocean transport and network surface contracts remain future slices.
