"""Update the frozen mission program from the offline study, with no runtime search."""

import json
import math
from pathlib import Path

here = Path(__file__).resolve().parent
w = json.loads((here / "witness.json").read_text())
path = Path("fixtures/model-sets/aster-launch.json")
d = json.loads(path.read_text())
rotation = math.pi / 2


def arc(identity, start, duration, keys):
    end = start + duration
    duration = end - start  # exact representable arc extent used by schema validation
    vectors = [[math.cos(angle + rotation), math.sin(angle + rotation), 0] for angle in keys]
    return {
        "id": identity,
        "start": start,
        "end": end,
        "direction": vectors[0],
        "throttle": 1,
        "steering": {
            "kind": "spherical-smoothstep-v1",
            "keys": [
                {"offset": duration * i / (len(keys) - 1), "direction": v}
                for i, v in enumerate(vectors)
            ],
        },
    }


lower, upper, boostback, deorbit = w["lower"], w["upper"], w["boostback"], w["deorbit"]
split = lower["start"] + lower["duration"]
d["separation"]["t"] = split
station = next(p for p in d["world"]["logistics"]["ports"] if p["rail"]["kind"] == "circular")
station["rail"].update(w["station"])
station["rail"]["phase"] += rotation
d["programs"]["stack"]["thrustArcs"] = [
    arc("boost", lower["start"], lower["duration"], lower["keys"])
]
d["programs"]["booster"]["thrustArcs"] = [
    arc("boostback", boostback["start"], boostback["duration"], boostback["keys"])
]
d["programs"]["payload"]["thrustArcs"] = [
    arc("insertion", split, upper["burn"], upper["keys"]),
    arc("deorbit", deorbit["start"], deorbit["duration"], deorbit["keys"]),
]
d["programs"]["payload"]["operations"][0]["t"] = upper["arrival"]
d["programs"]["payload"]["operations"][1]["t"] = upper["arrival"]
d["programs"]["payload"]["operations"][2]["t"] = w["departure"]
d["entryStarts"] = {
    "booster": boostback["start"] + boostback["duration"],
    "payload": deorbit["start"] + deorbit["duration"],
}
path.write_text(json.dumps(d, indent=2) + "\n")
