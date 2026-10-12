"""Freeze the selected authoring witness; the independent producer then replays it."""

import json
from pathlib import Path

root = Path(__file__).resolve().parent
carrier = json.loads((root / "closer-carrier.json").read_text())
connections = json.loads((root / "homotopy-tight.json").read_text())
if len(carrier) != 3 or len(connections["legs"]) != 4:
    raise ValueError("Incomplete finite witness")


def strip(segment):
    return {k: v for k, v in segment.items() if k in ["id", "start", "end", "control"]}


inputs = {
    "schemaVersion": 2,
    "period": 74,
    "exhaustVelocity": 4,
    "padPhases": connections["padPhases"],
    "groups": [[strip(s)] for s in carrier]
    + [[strip(s) for s in leg["parts"]] for leg in connections["legs"]],
}
(root / "refined-controls.json").write_text(json.dumps(inputs, separators=(",", ":")) + "\n")
