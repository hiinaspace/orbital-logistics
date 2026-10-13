"""Compile a frozen two-frequency guide with a physical seed and finite hardware."""

import json
from pathlib import Path

root = Path("fixtures/model-sets")
source = json.loads((root / "sol-earth-lissajous.json").read_text())
r = json.loads(Path("docs/design/libration-orbits/continuous/reference.json").read_text())
y = [r["xL"], 0.0, 0.0, 0.0, 0.0, 0.0]
for term in r["terms"]:
    axis = term["axis"]
    f = term["k"] * r["frequencies"][0] + term["l"] * r["frequencies"][1]
    if axis == 1:
        y[axis + 3] += term["coefficient"] * f
    else:
        y[axis] += term["coefficient"]
a, n = r["separation"], r["rate"]
ship = source["vessels"][0]["bundle"]["scenario"]["ship"]
ship.update(
    state=[
        a * y[0],
        a * y[1],
        a * y[2],
        a * n * (y[3] - y[1]),
        a * n * (y[4] + y[0]),
        a * n * y[5],
    ],
    dryMass=1,
    cargoMass=0,
    propellant=0.4,
    tankCapacity=0.4,
    exhaustVelocity=50,
    engine={"maxThrust": 0.003, "maxAcceleration": 0.002},
)
d = {
    "schemaVersion": 1,
    "modelVersion": "libration-survey-v1",
    "id": "helion-orison-survey",
    "name": "Helion–Orison · Continuous survey",
    "description": "Lumen traces a changing spatial survey pattern around L2.",
    "provenance": (
        "Gaia/WMAP-inspired fictional Lissajous-like survey. Canonical free flight and "
        "small paid growing-mode corrections; fitted two-frequency guide is not a "
        "physical rail or an exact torus. Finite fuel, bounded rolling history."
    ),
    "source": source,
    "reference": r,
}
(root / "libration-survey-reference.json").write_text(json.dumps(r, indent=2) + "\n")
(root / "libration-survey.json").write_text(json.dumps(d, indent=2) + "\n")
