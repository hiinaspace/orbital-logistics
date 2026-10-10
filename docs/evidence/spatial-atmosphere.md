# Spatial atmospheric mission and body grids

Aster · Northern launch & station visit is prepared from its frozen v2 mission.
Northhaven latitude26 degrees, atmospheric spin[0,0,.03], and inclined Lantern
orbit25.997451 degrees. Actual surface velocity is omega cross radius at the
latitude-aware support. No runtime optimization or continuous inclined cache claim.

## Independent numerical evidence

spatial-atmosphere-oracle-input.json records production queries at1/512,1/1024,
and1/2048 steps. atmospheric_mission_oracle.py integrates its own complete
original-state branch tree with DOP853, including physical rotating-air drag/lift,
fuel, stage mass ownership, station capture, actual unloaded return mass and ocean
contact. Spatial steering uses an independent Rodrigues rotation; the frozen
station rail is an input, never adjusted to production endpoints.

Oracle refinement changes state by at most7.34e-12. Across all tested grids,
maximum sampled state disagreement is2.95e-10; default-grid entry disagreement
is8.15e-12 and contact-time disagreement2.56e-11. Default paid capture position
error1.78e-10, velocity correction3.32e-10. Recovery speeds.0444643 and.0386731,
below the.06 limit, with fuel remaining.3610422 and.1588902. Maximum refined total
acceleration3.4483, below4; dynamic pressure2.2332, below20; heat proxy.3394,
below10. These are point-particle schematic atmosphere models, not real vehicle
performance estimates.

Default preparation owns15590 physical nodes,15624 trials,200156 force evaluations,
96 contact-root evaluations,15926 display samples and7984206 serialized view bytes.
The prior ceilings are unchanged. Generation takes about2.6 seconds in the
instrumented script; playback queries the completed view.

spatial-atmosphere-display.json compares3000 epochs per vessel with canonical
physical query providers. Maximum position error at1e6px/unit zoom is.1063px.
Structured clones, reverse query order and display sampling do not mutate views.

## Browser and review evidence

Production Chrome checks cover supported northern launch, actual 3D separation,
inclined station delivery, both full spatial ocean recoveries, physical-pose
invariance under frame changes, playback through recovery, deterministic rewind,
and switches through the old atmospheric mission and continuous freight district.
Close entry uses a local radial/east/north rig for spatial scenes. Screenshot
artifacts: spatial-atmosphere-launch.png, spatial-atmosphere-orbit.png and
spatial-atmosphere-entry.png.

Grid screenshots cover opaque near hemisphere, faint dashed far hemisphere with
see-through bodies, reference-frame changes and close surface zoom. Geometric
tests classify analytical limb intervals independently, and verify that spin is
drawn from physical support/air rather than body orbital or viewer frame rates.
Astra's separate20000-classification probe found no mismatch. Exact projected
circle paths avoid zoom-dependent polygon/chord errors.

Astra architecture and final code/witness review found no remaining blocker.
It verified equatorial v1/v2 latitude-zero state parity, full spatial handoffs and
bounds; details in ../design/spatial-atmosphere/astra-review.md. Parent inspected
the screenshots. Owner viewing acceptance remains separate.

## Final checks

Build/typecheck passed. All215 simulation tests and5 selected production Chrome
browser tests passed; all-file numerical Ruff format/lint and ty hooks passed.
The selected browser run includes old atmospheric mission, northern surface
witness and live district regressions as well as new grid/spatial mission tests.
With the grids enabled, district effective playback was1.00008x and1.99752x over
18-second observations, with maximum animation-frame gap16.8ms in each run.
Recorded in spatial-atmosphere-district-playback.json. These timings describe
this bounded machine/browser run, not an unrestricted network scaling guarantee.
