"""Build the one-pad, zero-kick staged observatory mission from frozen solves."""

import json
from pathlib import Path

BASE = Path(__file__).parent
launch = json.loads((BASE / "launch-solution.json").read_text())
returning = json.loads((BASE / "booster-solution.json").read_text())
transfer = json.loads((BASE / "transfer-solution.json").read_text())
source = json.loads(Path("fixtures/model-sets/sol-earth-halo.json").read_text())
owner = source["vessels"][0]["bundle"]["scenario"]["bodies"][1]
pad = {
    "id": "Cairn",
    "rail": {
        "kind": "surface",
        "bodyId": owner["id"],
        "bodyRail": owner["rail"],
        "centerHeight": 1e-6,
        "latitude": 0,
        "center": [0, 0, 0],
        "u": [1, 0, 0],
        "v": [0, 1, 0],
        "radius": owner["radius"] + 1e-6,
        "rate": launch["spin"],
        "phase": 0,
    },
    "cargo": 0,
    "cargoCapacity": 0,
    "propellant": 0,
    "tankCapacity": 0,
    "serviceDuration": 0.1,
}


def steered(name, keys):
    lo = keys[0][0]
    hi = keys[-1][0]
    import math

    ks = [
        {"offset": t - lo, "direction": [math.cos(angle), math.sin(angle), 0]} for t, angle in keys
    ]
    return {
        "id": name,
        "start": lo,
        "end": hi,
        "direction": ks[0]["direction"],
        "throttle": 1,
        "steering": {"kind": "spherical-smoothstep-v1", "keys": ks},
    }


def fixed(name, b):
    return {
        "id": name,
        "start": b["start"],
        "end": b["end"],
        "direction": b["direction"],
        "throttle": 1,
    }


d = {
    "schemaVersion": 1,
    "modelVersion": "binary-observatory-mission-v1",
    "id": "helion-orison-observatory-mission",
    "name": "Helion–Orison · Observatory mission",
    "description": (
        "A Webb-inspired observatory launches from Cairn, circles Orison, then settles "
        "into a spatial halo around L2."
    ),
    "provenance": (
        "Fictional airless accelerating binary. Zero-kick staging, reserved upper fuel, "
        "paid finite launch/booster recovery/departure/insertion, actual parking coasts "
        "and canonical continuation. Not a real mission reconstruction."
    ),
    "source": source,
    "end": 80,
    "launch": launch["launch"],
    "split": launch["split"],
    "parking": launch["parking"],
    "departure": transfer["departure"],
    "arrival": transfer["arrival"],
    "land": returning["land"],
    "pad": pad,
    "booster": {
        "id": "kestrel",
        "name": "Kestrel",
        "color": "#86c5cc",
        "dryMass": 1,
        "propellant": 1.5,
        "tankCapacity": 1.5,
        "exhaustVelocity": 4,
        "engine": {"maxThrust": 1.5, "maxAcceleration": launch["lowerAcceleration"]},
    },
    "upper": {
        "id": "prism",
        "name": "Prism",
        "color": "#e4c879",
        "dryMass": 0.2,
        "propellant": 0.4,
        "tankCapacity": 0.4,
        "exhaustVelocity": 3,
        "engine": {"maxThrust": 0.3, "maxAcceleration": launch["upperAcceleration"]},
    },
    "stack": {"id": "kestrel-prism", "name": "Kestrel · Prism", "color": "#a9cda8"},
    "programs": {
        "stack": {
            "schemaVersion": 4,
            "id": "stack-launch",
            "burns": [],
            "thrustArcs": [steered("Cairn ascent", launch["lowerKeys"])],
            "operations": [
                {"id": "pad-initial", "kind": "dock", "t": 0, "portId": "Cairn"},
                {
                    "id": "launch",
                    "kind": "launch",
                    "t": launch["launch"],
                    "portId": "Cairn",
                    "thrustArcId": "Cairn ascent",
                },
            ],
        },
        "booster": {
            "schemaVersion": 4,
            "id": "booster-return",
            "burns": [],
            "thrustArcs": [
                fixed(name, b)
                for name, b in zip(["Boostback", "Landing"], returning["burns"], strict=True)
            ],
            "operations": [
                {
                    "id": "booster-land",
                    "kind": "land",
                    "t": returning["land"],
                    "portId": "Cairn",
                }
            ],
        },
        "upper": {
            "schemaVersion": 4,
            "id": "observatory-flight",
            "burns": [],
            "thrustArcs": [
                steered("Parking insertion", launch["upperKeys"]),
                *[
                    fixed(name, b)
                    for name, b in zip(
                        ["Orison departure", "Halo insertion"],
                        transfer["burns"],
                        strict=True,
                    )
                ],
            ],
        },
    },
}
Path("fixtures/model-sets/observatory-mission.json").write_text(json.dumps(d, indent=2) + "\n")
