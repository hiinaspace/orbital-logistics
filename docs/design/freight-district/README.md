# Connected freight district and latitude witness

The next exhibit joins accepted complete ground flights to orbital distribution.
It uses one TrafficEngine, one inventory authority, three assigned ships and four
terminals. Equator is the only cargo source. Crown starts empty and has no cargo
flow. Tern unloads into Crown; Ibis and Wren load that actual stock for Meridian
and Lantern. The destinations consume supplies. Fuel has explicit replenishment
flows, and every launch, capture, transfer and retry retains its resource owner.

Orison · Freight district uses the existing fixed central primary. Crown at1.4,
Meridian at2.1 and Lantern at2.8 follow analytical circular rails. There is no
perturbing body or stationkeeping controller in this world. Three berths per
terminal bound occupancy without introducing reservations or a routing optimizer.

The two ground templates retain the accepted complete gravity-turn steering
and fixed loadouts. Four orbital templates use two finite low-force pulses and
a coast, authored by six-state shooting at1/128 integration step. Ground flights
remain1/1024. These are certified canonical Runners reused at compatible synodic
windows, rather than stitched surface/orbit fragments. Actual source and
pre-capture states are checked on every occurrence; residual matches are paid.
A z-axis cache rotation is restricted to the equatorial district rails.

The new freight-district-v1 validator pins physics, topology, hardware,
templates, closed routes and policies. Definition identity is frozen. The
PreparedFlight interface stays read-only. Source/destination IDs are explicit,
and all arc/event epochs are retained. Each engine caches at most six references,
16000 physical nodes and12MB serialized owned data. Existing two-port domains
keep their prior restrictions and8MB budget. These sizes are not heap estimates.

Drawing density is1024 for ground flights and32 for gentler orbital legs.
The existing65536 drawing-row budget remains. Rolling history is64 units;
accurate rewind rebuilds dense coverage around the requested cursor. Assembled
scenes omit duplicate whole-history dense descriptors. Starts1x, supports2x.

Resource retries start loading before the next launch window. Window selection
uses a floor candidate followed by comparison with the actual departure, so
floating-point quotients cannot skip an exactly coincident completion. A ship
waits with its cargo if service cannot fit the shared terminal stocks.
Cumulative unload counters are per terminal; district delivered counts only
Meridian and Lantern, excluding Crown transshipment.

Orison · Northern shuttle is a separate finite latitude witness. Northport is
20 degrees north on the fixed z-axis spin sphere; it follows a small circle,
not a tilted equatorial rail. surface-ports-v5 requires explicit latitude and
v3 rejects latitude fields. Launch release uses actual tangential speed squared
over radius. The station orbit is inclined20 degrees; five-key spherical
steering with free duration matches all six endpoint components. Normal Runner
launch, docking, service, undocking and landing execute with paid residuals and
normal collision checks. Pad/rocket normals, close-view camera and altitude
readouts use all three spatial coordinates.

The inclined witness is not a continuous cache family: a z-axis rotation would
move an inclined station's orbital plane. Continuous inclined launches require
different recurrence/window planning and are left for a separate slice.

Authoring: orbital-author.ts and latitude-study.py. Neither runs in the browser.
Review: astra-review.md. Validation: ../../evidence/freight-district.md.
