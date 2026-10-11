# Flight-derived lunar geometry reference (offline only)

`artemis2-reconstructed-10min.csv` is a compact, timestamped reference trace for
**Artemis II Orion**, 2026-04-02 01:58:21 to 2026-04-10 23:53:24 UTC. It is retained
for offline geometry analysis, not as an app asset, fixture, authored program, or
acceptance target. It contains 1,287 sampled states. The spacecraft coordinates and
velocities are original sampled rows from NASA/JSC's *reconstructed Best Estimated
Trajectory* (BET), not a planned trajectory or a path digitized from NASA Eyes.
The adjacent Moon states are a separately queried JPL Horizons DE441 ephemeris,
linearly interpolated from five-minute samples to each OEM timestamp. Earth is
the common center. The original flight file contains six tracking/onboard-derived
blocks; `oem_source` preserves which type supplied each spacecraft row.
The retained CSV SHA-256 is
`385af891b8f04bc1fd4088c9d3bed47858717fa52f0931f6400bfef6fde6cae6`.

## Sources and regeneration

- [NASA/JPL NAIF Artemis II SPK directory README](https://naif.jpl.nasa.gov/pub/naif/ARTEMIS/kernels/spk/aareadme.txt): identifies the public JSC/FOD/NAV reconstructed BET revision F, clearance, provenance, and derived SPK. The [original OEM text](https://naif.jpl.nasa.gov/pub/naif/ARTEMIS/kernels/spk/EM2_FODNAVBET_revF_PUBLIC.oem) says its BET used GPS, DSN, JAXA, and SSC ground tracking. OEM SHA-256 at extraction: `d8ed8a5a16d40d69da32a54d83a19970e47f4e8bd6e547210b01b1c78e002ff3`.
- [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html): Moon `301` relative to Earth `500@399`, geometric vectors (`VEC_CORR=NONE`), ICRF equatorial plane, UTC output, km and km/s, 2026-04-02 through 2026-04-11 at five-minute intervals. The exact query is in [`extract_artemis2.py`](extract_artemis2.py). Horizons identified Moon and Earth source as DE441. Response SHA-256 at extraction: `9fe63c49f5362e9a4670d454a673274cdf295831af63f8875c4f43bc514c8cda` (the response includes a generation timestamp, so later responses need not hash identically).
- NASA's [flight-derived trajectory visualization](https://svs.gsfc.nasa.gov/5632/) independently describes a free-return loop, while its [closest-approach release](https://www.nasa.gov/news-release/nasas-artemis-ii-crew-eclipses-record-for-farthest-human-spaceflight/) reports about 4,067 miles above the surface. Those are context and a gross check, not the source of these state rows.

Regenerate with `uv run --no-project python docs/design/mission-reference/extract_artemis2.py` from the repo root. The script downloads source text transiently and writes only the CSV. It selects actual OEM rows at roughly ten-minute spacing (plus block starts and the final row), with **no spacecraft interpolation**. The Moon columns use linear five-minute interpolation, which is adequate for qualitative orbital shape and timing but not a navigation-grade co-registered solution. OEM EME2000 and Horizons ICRF are closely aligned equatorial inertial conventions, not asserted here to be exactly identical. The OEM also has brief block gaps; do not interpolate spacecraft states through them to infer burns or acceleration. The retained CSV is a derived table, not an unmodified SPICE kernel. NAIF's [distribution and credit rules](https://naif.jpl.nasa.gov/naif/rules.html) allow download/use of its kernels and encourage credit to data providers; credit here belongs to JSC/FOD/NAV and JPL Horizons/NAIF.

## Geometry observations (sampled, rounded)

At 2026-04-06 23:02:48.802 UTC, the closest retained sample is **8,284 km from the
Moon's center** (about 6,546 km altitude using a 1,737.4 km mean radius). Moon-relative
speed is **1.381 km/s** and radial speed is near zero. The sampled distance is about
**4.77 lunar radii** or **0.0205 of the simultaneous Earth–Moon separation**. This is
a high flyby, with speed about **1.80 times local circular speed** (using lunar
`μ=4902.8 km³/s²`); it is not a parking orbit. Sample cadence means these are
approximate closest-sample values, not a refined continuous minimum.

Within 100,000 km of the Moon (2026-04-05 18:12 through 2026-04-08 03:53 UTC),
the Moon-relative radius falls and rises once; the relative radial velocity changes
from roughly −0.95 to +0.95 km/s. Projected into the instantaneous Earth–Moon
orbital plane at closest approach, the Moon-centered position sweeps roughly
**220° retrograde**. That is a free-return flyby topology, consistent with NASA's
mission description, with no lunar-orbit insertion, surface descent, ascent, or
rendezvous in this trace. The table cannot assign exact burn intervals from sampled
state differences. NASA separately reported an [outbound correction burn](https://www.nasa.gov/blogs/missions/2026/04/05/artemis-ii-flight-day-5-correction-burn-complete/).

The comparison to Aster–Selene is intentionally soft. Real Earth–Moon separation
near this pass was about 405,000 km, or **233 lunar radii**; the fictional field
uses separation 5 and Moon radius 0.2, or **25 lunar radii**. The compressed fictional
geometry changes passage shape and timing, even after distance/time normalization.
Useful dimensionless diagnostics are `|r_ship-r_moon|/R_moon`,
`|v_ship-v_moon|/sqrt(μ_moon/|r_ship-r_moon|)`, signed angular momentum relative to
the Earth–Moon plane, and the radial/tangential velocity split. Compare those curves
and their event order rather than overlaying XY paths or copying burn epochs. A
retrograde free-return flyby does **not** justify a backward coast for a prograde
lander-to-orbiter rendezvous; those have different end states and costs. Finite
burn-versus-coast topology must come from the actual mission event record or the
fictional program, since a ten-minute trace resolves neither short burns nor
thrust steering.

## Apollo 11 ascent/rendezvous topology (documentary, no state trace)

The [NASA Apollo 11 mission overview](https://www.nasa.gov/history/apollo-11-mission-overview/)
provides a more relevant **flown event sequence** for the fictional Eagle/Odyssey
scene, but not timestamped Cartesian states. The LM ascent stage fired for 435
seconds into an **11 by 55 mile** initial lunar orbit. At apolune, an RCS phase
burn nearly circularized it around **56 miles**, about **13 miles below and
slightly behind** the CSM. Later RCS firings changed it to a **57 by 72 mile**
orbit; docking followed at mission elapsed time 128 h 03 min, roughly **3 h 41
min after liftoff**. This supports the qualitative sequence of outward ascent,
orbital insertion, a lower phasing coast, then paid terminal rendezvous.
It does not prescribe a minimum-fuel path or prove that radius never exceeds the
CSM's during final approach. The [preflight Mission Operations Report](https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/A11_MissionOpReport.pdf)
describes the intended coelliptic sequence, including a nominal posigrade phase
burn; use the flown overview for what actually happened.
