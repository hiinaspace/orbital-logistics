"""Reproduce static native fixtures from the retained independent orbit solutions."""

import copy
import json
import math
from pathlib import Path
from typing import Any

BASE = Path(__file__).parent
halo = json.loads((BASE / "orbit-solution.json").read_text())
a = halo["separation"]
m = halo["mu"]
n = halo["rate"]
bodies: list[dict[str, Any]] = []
for i, (name, mass, radius) in enumerate([("Sol", 1 - m, 0.65), ("Earth", m, 0.10)]):
    bodies.append(
        {
            "id": name,
            "mu": mass,
            "radius": radius,
            "rail": {
                "kind": "circular",
                "center": [0, 0, 0],
                "u": [1, 0, 0],
                "v": [0, 1, 0],
                "radius": a * (m if i == 0 else 1 - m),
                "rate": n,
                "phase": math.pi if i == 0 else 0,
            },
        }
    )


def state(d):
    x, y, z, vx, vy, vz = d["rotatingState"]
    return [a * x, a * y, a * z, a * n * (vx - y), a * n * (vy + x), a * n * vz]


scenario: dict[str, Any] = {
    "schemaVersion": 3,
    "modelVersion": "rk4-canonical-v3",
    "id": "sol-earth-halo-coast",
    "units": {"length": "model distance", "time": "model time", "mass": "mass unit"},
    "epoch": 0,
    "duration": 60,
    "policy": {"step": 1 / 1024, "maxNodes": 65536, "maxSubdivision": 20},
    "bodies": bodies,
    "ship": {
        "id": "webb",
        "state": state(halo),
        "dryMass": 1,
        "cargoMass": 0,
        "propellant": 0.4,
        "tankCapacity": 0.4,
        "exhaustVelocity": 3,
    },
}
fixture: dict[str, Any] = {
    "schemaVersion": 1,
    "modelVersion": "circular-binary-set-v1",
    "id": "sol-earth-halo",
    "name": "Sol–Earth · Webb halo",
    "extent": 5,
    "description": "A space observatory circles L2 above and below Earth’s orbital plane.",
    "provenance": (
        "Webb-inspired fictional circular binary; compressed distances, "
        "exaggerated Earth mass. JPL seed continued to mass fraction .003; "
        "canonical unpowered spatial coast, not real mission data."
    ),
    "stations": [],
    "rotating": {"name": "Sol–Earth rotating", "rate": n, "phase": 0},
    "binary": {
        "schemaVersion": 1,
        "mu": m,
        "separation": a,
        "rate": n,
        "phase": 0,
        "period": halo["period"] / n,
        "kind": "halo",
    },
    "vessels": [
        {
            "name": "Webb",
            "color": "#e4c879",
            "cargo": "Observatory",
            "bundle": {
                "scenario": scenario,
                "program": {"schemaVersion": 3, "id": "webb-halo-coast", "burns": []},
            },
            "glyph": "observatory",
        }
    ],
}


def save(d):
    Path("fixtures/model-sets", d["id"] + ".json").write_text(json.dumps(d, indent=2) + "\n")


save(fixture)
li = json.loads((BASE / "lissajous-solution.json").read_text())
d = copy.deepcopy(fixture)
d.update(
    id="sol-earth-lissajous",
    name="Sol–Earth · Gaia Lissajous",
    description="A survey observatory weaves above and below the Sun–Earth plane near L2.",
    provenance=(
        "Gaia/WMAP-inspired finite center-motion witness in a fictional "
        "binary. Offline boundary-value initial state, canonical unpowered "
        "flight; no exact recurrence or real mission data."
    ),
)
d["binary"].update(kind="lissajous", period=li["period"] / n)
v = d["vessels"][0]
v.update(name="Gaia", color="#a8d8e8")
v["bundle"]["scenario"]["id"] = "sol-earth-lissajous-coast"
v["bundle"]["scenario"]["ship"].update(id="gaia", state=state(li))
v["bundle"]["program"]["id"] = "gaia-lissajous-coast"
save(d)
ins = json.loads((BASE / "insertion-solution.json").read_text())
d = copy.deepcopy(fixture)
d.update(
    id="sol-earth-observatory-insertion",
    name="Sol–Earth · Observatory departure",
    description=(
        "An observatory departs Earth parking orbit, coasts to L2 and enters a spatial halo."
    ),
    provenance=(
        "Webb-inspired fictional parking departure and halo insertion. "
        "Bounded finite thrust, paid propellant and continuous canonical "
        "flight; launch vehicle/ground ascent and actual mission data are not "
        "represented."
    ),
)
d["binary"]["kind"] = "insertion"
v = d["vessels"][0]
v["bundle"]["scenario"]["id"] = "sol-earth-observatory-departure"
v["bundle"]["scenario"]["ship"].update(
    state=ins["initialState"], engine={"maxThrust": 1, "maxAcceleration": ins["acceleration"]}
)
v["bundle"]["program"] = {
    "schemaVersion": 3,
    "id": "webb-departure-insertion",
    "burns": [],
    "thrustArcs": [
        {
            "id": name,
            "start": b["start"],
            "end": b["end"],
            "direction": b["direction"],
            "throttle": 1,
        }
        for name, b in zip(["Earth departure", "Halo insertion"], ins["burns"], strict=True)
    ],
}
save(d)
