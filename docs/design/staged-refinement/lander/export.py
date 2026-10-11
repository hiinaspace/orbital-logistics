"""Make a reviewable mission candidate without touching the production fixture."""

import json
import sys
from pathlib import Path

import search

HERE = Path(__file__).resolve().parent
seed_id = int(sys.argv[1]) if len(sys.argv) > 1 else 4
result = json.loads(
    (
        HERE / ("exact-candidate.json" if seed_id == 4 else f"exact-candidate-{seed_id}.json")
    ).read_text()
)
mission = json.loads((HERE / "baseline-mission.json").read_text())
lift, dock = result["lift"], result["dock"]
duration1, duration2 = result["parameters"][-2:]
mission["liftoff"] = lift
mission["lunarDock"] = dock
mission["programs"]["lander"] = [
    mission["programs"]["lander"][0],
    search.model.arc("lunar-ascent", lift, lift + duration1, result["ascentHeadings"], 0.2),
    search.model.arc("lunar-rendezvous", dock - duration2, dock, result["brakeHeadings"], 0.2),
]
(HERE / ("exact-mission.json" if seed_id == 4 else f"exact-mission-{seed_id}.json")).write_text(
    json.dumps(mission, indent=2) + "\n"
)
