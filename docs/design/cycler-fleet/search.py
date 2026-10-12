"""Bounded lunar parking/next-pass connection search; no public fixture writes."""

import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location(
    "author", HERE.parent / "compact-cycler/redesign/author.py"
)
assert spec is not None and spec.loader is not None
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
a.PHASES.update(
    json.loads((HERE.parent / "compact-cycler/redesign/controls.json").read_text())["padPhases"]
)
best = None
for launch in [64.0, 66.0, 68.0, 62.0, 60.0, 70.0]:
    for board, depart in [(76.0, 72.0), (78.0, 73.0)]:
        a.SEGMENTS.clear()
        try:
            end = launch + 1.25
            initial = a.burn(
                "Haven ascent",
                launch,
                end,
                a.port("Haven", launch),
                a.parking(end, 0.32, a.m.RATE * end + a.PHASES["Haven"] - 0.55, "Selene", -1),
                launch="Haven",
            )
            initial = a.coast("Selene departure parking", end, depart, initial)
            a.pulse(
                "Later carrier connection",
                depart,
                board,
                initial,
                a.CARRIER.sol(board)[:4],
                first=0.5,
                last=0.5,
            )
            score = sum(q["dv"] for q in a.SEGMENTS)
            print("CANDIDATE", launch, depart, board, score, flush=True)
            if best is None or score < best[0]:
                best = (score, launch, depart, board)
                parts = [
                    dict(
                        id=q["id"],
                        start=q["t0"],
                        end=q["t1"],
                        initial=a.m.state6(q["initial"]),
                        endpoint=a.m.state6(q["end"]),
                        **(
                            {
                                "control": {
                                    k: v for k, v in q["arc"].items() if k != "accelerationBound"
                                }
                            }
                            if "arc" in q
                            else {}
                        ),
                    )
                    for q in a.SEGMENTS
                ]
                (HERE / "lunar-return.json").write_text(
                    json.dumps(
                        dict(score=score, launch=launch, board=board, segments=parts),
                        separators=(",", ":"),
                    )
                    + "\n"
                )
        except (RuntimeError, ValueError) as e:
            print("REFUSED", launch, depart, board, str(e), flush=True)
print("BEST", best, flush=True)
