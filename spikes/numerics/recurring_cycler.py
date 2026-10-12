"""Fresh independent macrocycle admission, including paid maintenance closure."""

from __future__ import annotations

import json
from pathlib import Path

import compact_cycler as m
import numpy as np
from scipy.interpolate import CubicSpline

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "docs/design/continuous-cycler-fleet"
OUT = ROOT / "fixtures/model-sets/recurring-cycler-profile.json"


def main():
    v = json.loads((ROOT / "fixtures/model-sets/cycler-fleet-profile.json").read_text())
    maintenance = json.loads((HERE / "maintenance.json").read_text())
    v["modelVersion"] = "recurring-cycler-profile-v1"
    v["duration"] = maintenance["duration"]
    proofs = []
    for actor, c in enumerate(v["carriers"]):
        c["hardware"]["maxAcceleration"] = 1e-5
        c["hardware"]["maxForce"] = 1e-4
        initial = np.array(c["segments"][0]["initial"])[[0, 1, 3, 4]]
        before = c["segments"][:-1]
        # Keep all handoff cuts, extending the final coast to maintenance start.
        last = c["segments"][-1]
        q = m.forward(last["start"], v["duration"] - 4, np.array(last["initial"])[[0, 1, 3, 4]])
        before.append(
            dict(
                id=last["id"],
                start=last["start"],
                end=v["duration"] - 4,
                initial=last["initial"],
                endpoint=m.state6(q.y[:4, -1]),
                oracle=m.oracle(dict(t0=last["start"], t1=v["duration"] - 4, result=q)),
            )
        )
        actual = q.y[:4, -1]
        uncorrected = m.forward(v["duration"] - 4, v["duration"], actual).y[:4, -1]
        dv = 0.0
        for s in maintenance["carriers"][actor]["segments"]:
            control = s.get("control")
            spline = (
                CubicSpline.construct_fast(
                    np.array(control["coefficients"])[:, :, :2].transpose(1, 0, 2),
                    np.array(control["keys"])[:, 0],
                )
                if control
                else None
            )
            q = m.forward(s["start"], s["end"], actual, spline)
            before.append(
                dict(
                    id=s["id"],
                    start=s["start"],
                    end=s["end"],
                    initial=m.state6(actual),
                    endpoint=m.state6(q.y[:4, -1]),
                    oracle=m.oracle(dict(t0=s["start"], t1=s["end"], result=q)),
                    **({"control": control} if control else {}),
                )
            )
            actual = q.y[:4, -1]
            dv += float(q.y[4, -1])
        target = m.rotate(initial, m.RATE * v["duration"])
        cap = m.capture(actual, target)
        if dv + cap["paidDeltaV"] > 1e-5:
            raise RuntimeError("Total correction cap")
        c["segments"] = before
        proofs.append(
            dict(
                id=c["hardware"]["id"],
                uncorrectedPosition=float(np.linalg.norm(uncorrected[:2] - target[:2])),
                uncorrectedVelocity=float(np.linalg.norm(uncorrected[2:] - target[2:])),
                commandDeltaV=dv,
                projection=cap,
            )
        )
    v["proof"]["maintenance"] = proofs
    tmp = OUT.with_suffix(".json.next")
    tmp.write_text(json.dumps(v, separators=(",", ":")) + "\n")
    tmp.replace(OUT)
    print("PROFILE", OUT.stat().st_size, proofs, flush=True)


if __name__ == "__main__":
    main()
