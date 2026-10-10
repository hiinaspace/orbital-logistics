# Whole-flight low-orbit service

The owner accepted the finite low-orbit gravity-turn shape and smooth rocket
attitude. This slice tests reuse of that complete shape in a live service before
returning to perturbed or maintained destinations.

**Orison · Low-orbit service** has two shuttles, supported Equator and analytical
Crown at radius1.4. It uses only fixed central Orison gravity. Ascent carries.05
supplies with fuel6; return is empty with fuel2.25. Both use the accepted smooth
five-key1.95176669-unit burn and engine32/cap1.2. Ground and orbital service debit
real shared stocks; explicit supply/consumption flows fund sustained operation.
Ibis starts at Crown and Tern at Equator, alternating tours at the compatible
12.4745179811-unit synodic windows. Two berths allow resource delays.

The cache retains two canonical complete certified Runners per engine. Their
immutable validated world/template/loadout keys contain no occurrence IDs or
calendar epoch. A later episode rotates the whole flight, remaps IDs and uses
actual local rail phases. It exposes only bundle/current/sample/ledger/event
boundaries/storage counts. It offers no physical restart or serialization API.

Departure must match the actual source. Capture rotates the canonical physical
pre-capture state and pays its residual against the actual destination at this
occurrence. Its fuel, ledger, boundary after-state and all later attachment
samples use that result. The physical before-state remains intact. Source
support is analytical through the private negative-epoch prelude; free flight
begins at local zero. Each occurrence source bundle can independently replay.
The native Astra review favored this retained-Runner seam over a second dynamics
implementation reconstructed from packed geometry and fuel formulas.

A new pinned low-orbit-cache-v1 domain checks the accepted complete steering
templates, geometry, loadouts, hardware, tolerance and integration policy before
operations. The engine deep-freezes this definition. Canonical flights have
bounded derived node allowances sufficient for steering safety subdivisions;
the existing65536 individual maximum is unchanged. Shared cache storage is
counted once even while both ships wait: at most two entries,20000 physical
nodes and8MB serialized owned data. Occurrence wrappers have no private nodes.
Serialized bytes are a diagnostic format size, not JavaScript heap measurement.

The existing engine owns service, retry windows, event transactions, fault
isolation and128-unit rewind. New-domain drawing density is1024 samples per
unit to stay within the existing65536 retained drawing budget for two ships.
The viewer assembles dense samples around each requested cursor's12-unit trail
and forecast, keeping both bracketing rows and event sides. It does not embed
all historical dense trajectories again in every scene. Rewinding rebuilds that
cursor's coverage from retained episode records. Arbitrarily older queries
through a current assembled scene use coarse fleet samples; the fuel chart keeps
its existing coarse older-history curve.

Starts.1x, supports up to2x, and retains the finite/previous cached comparisons.
This validates a single-primary analytical service. Mote, maintained moving
targets, generalized route-family search, ship collision avoidance and additional
terminals are later adaptations, not silently approximated in this exhibit.

[Review/disposition](astra-review.md), [numerical/runtime/browser evidence](../../evidence/shuttle-service.md).
