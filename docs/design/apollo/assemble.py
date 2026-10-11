import json
import math
from pathlib import Path

here = Path(__file__).resolve().parent
w = json.loads((here / "witness.json").read_text())
base = json.loads(Path("fixtures/model-sets/aster-entry.json").read_text())
rate = math.sqrt(1.03 / 125)
bodies = [
    dict(id="Aster", mu=1, radius=1, rail=dict(kind="fixed", position=[0, 0, 0])),
    dict(
        id="Selene",
        mu=0.03,
        radius=0.2,
        rail=dict(
            kind="circular",
            center=[0, 0, 0],
            u=[1, 0, 0],
            v=[0, 1, 0],
            radius=5,
            rate=rate,
            phase=w["moonPhase"],
        ),
    ),
]


def six(z):
    return [z[0], z[1], 0, z[2], z[3], 0]


def port(identity, body, spin, phase):
    return dict(
        id=identity,
        rail=dict(
            kind="surface",
            bodyId=body["id"],
            bodyRail=body["rail"],
            latitude=0,
            centerHeight=1e-5,
            center=[0, 0, 0],
            u=[1, 0, 0],
            v=[0, 1, 0],
            radius=body["radius"] + 1e-5,
            rate=spin,
            phase=phase,
        ),
        cargo=0,
        cargoCapacity=1,
        propellant=0,
        tankCapacity=1,
        serviceDuration=0.3,
    )


arcs = []
for a in w["arcs"]:
    duration = a["end"] - a["start"]
    vectors = [[math.cos(k), math.sin(k), 0] for k in a["angles"]]
    arcs.append(
        dict(
            id=a["id"],
            start=a["start"],
            end=a["end"],
            direction=vectors[0],
            throttle=a.get("throttle", 1),
            steering=dict(
                kind="spherical-smoothstep-v1",
                keys=[
                    dict(
                        offset=duration
                        if i == len(vectors) - 1
                        else duration * i / (len(vectors) - 1),
                        direction=v,
                    )
                    for i, v in enumerate(vectors)
                ],
            ),
        )
    )
entry = {
    k: base[k]
    for k in [
        "kind",
        "schemaVersion",
        "modelVersion",
        "atmosphere",
        "aero",
        "guidance",
        "recovery",
        "limits",
        "presentation",
        "rotating",
    ]
}
entry["modelVersion"] = "entry-rk4-v3"
entry["aero"]["dragArea"] = 10
entry["presentation"].update(name="Odyssey", color="#e6c98b")
entry["limits"] = dict(dynamicPressure=100, acceleration=30, heatProxy=100)
entry["atmosphere"]["bodyId"] = "Aster"
d = dict(
    modelVersion="apollo-v1",
    schemaVersion=1,
    id="aster-selene-expedition",
    name="Aster–Selene · Expedition",
    description="Odyssey flies from Cairn to Tranquility and returns through the atmosphere.",
    provenance=(
        "Fictional Apollo-style finite mission. Prepared smooth finite burns, "
        "both gravity sources throughout, physical parking orbits, "
        "paid lunar capture and ocean recovery."
    ),
    extent=6,
    scenario=dict(
        schemaVersion=3,
        modelVersion="rk4-canonical-v3",
        id="expedition",
        units=base["scenario"]["units"],
        epoch=0,
        duration=w["duration"],
        policy=dict(step=1 / 1024, maxNodes=65536, maxSubdivision=20),
        bodies=bodies,
        ship=dict(
            id="Odyssey",
            state=[1.00001, 0, 0, 0, 0.03 * 1.00001, 0],
            dryMass=1,
            cargoMass=0,
            propellant=6,
            tankCapacity=6,
            exhaustVelocity=8,
            engine=dict(maxThrust=24, maxAcceleration=3),
        ),
    ),
    arcs=arcs,
    ports=[port("Cairn", bodies[0], 0.03, 0), port("Tranquility", bodies[1], rate, w["padPhase"])],
    launch=0.3,
    ascentEnd=w["ascentEnd"],
    landing=w["landing"],
    liftoff=next(p["t"] for p in w["phases"] if p["name"] == "Lunar liftoff"),
    entryStart=w["entryStart"],
    entry=entry,
    milestones=[dict(t=p["t"], name=p["name"]) for p in w["phases"]],
)
Path("fixtures/model-sets/aster-selene-expedition.json").write_text(json.dumps(d, indent=2) + "\n")
