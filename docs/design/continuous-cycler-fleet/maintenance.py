"""Bounded physical two-circuit carrier closure authoring."""

import importlib.util
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location(
    "author", HERE.parent / "compact-cycler/redesign/author.py"
)
assert spec is not None and spec.loader is not None
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
fleet = json.loads((HERE.parents[2] / "fixtures/model-sets/cycler-fleet-profile.json").read_text())
T = fleet["period"] * 2
parts = []
for carrier in fleet["carriers"]:
    initial = np.array(carrier["segments"][0]["initial"])[[0, 1, 3, 4]]
    free = a.m.forward(0, T - 4, initial)
    target = a.m.rotate(initial, a.m.RATE * T)
    a.SEGMENTS.clear()
    a.pulse(
        carrier["hardware"]["id"] + " phase maintenance",
        T - 4,
        T,
        free.y[:4, -1],
        target,
        first=0.75,
        last=0.75,
    )
    segments = [
        dict(
            id=q["id"],
            start=q["t0"],
            end=q["t1"],
            initial=a.m.state6(q["initial"]),
            endpoint=a.m.state6(q["end"]),
            **(
                {"control": {k: v for k, v in q["arc"].items() if k != "accelerationBound"}}
                if "arc" in q
                else {}
            ),
        )
        for q in a.SEGMENTS
    ]
    dv = sum(q["dv"] for q in a.SEGMENTS)
    if dv > 1e-5:
        raise RuntimeError("Maintenance DV ceiling")
    parts.append(
        dict(id=carrier["hardware"]["id"], segments=segments, deltaV=dv, target=a.m.state6(target))
    )
(HERE / "maintenance.json").write_text(
    json.dumps(dict(duration=T, carriers=parts), separators=(",", ":")) + "\n"
)
print("CLOSURE", [(p["id"], p["deltaV"]) for p in parts], flush=True)
