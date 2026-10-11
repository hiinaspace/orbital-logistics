"""Bounded offline booster witness; production replay plus independent DOP853.

Run from the repository root:
uv run --project spikes/numerics python docs/design/staged-apollo/booster-author.py

Only booster-witness.json is written. Production code and fixtures are read-only.
"""

import json
import math
import subprocess
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
D = json.loads((ROOT / "fixtures/model-sets/aster-selene-expedition.json").read_text())
UPPER_MASS = 7 * math.exp(-3 * 0.48 / 8)
DRY = 0.2
INITIAL_FUEL = 2.5
STACK_MASS = UPPER_MASS + DRY + INITIAL_FUEL
BOOSTBACK = {
    "id": "booster-boostback",
    "start": 0.78,
    "end": 1.14,
    "angles": [3.68, 3.65, 3.5],
    "acceleration": 3,
    "throttle": 1,
}

# Canonical admission uses the existing public APIs, exact split state, and both
# bodies at absolute epochs. The augmented vacuum radius is clearance only.
CANONICAL = r"""
import fs from 'node:fs';
import {prepareAtmosphericLeg,atmosphericStateAt} from './src/sim/atmospheric-propulsion.ts';
import {portState} from './src/sim/logistics.ts';
import {Runner} from './src/sim/runner.ts';
import {validateBundle} from './src/sim/schema.ts';
import {prepareEntry} from './src/model-set/entry.ts';
const d=JSON.parse(fs.readFileSync('fixtures/model-sets/aster-selene-expedition.json'));
const U=7*Math.exp(-3*.48/8),results=[];
for(const factor of [1,.5]) {
 const s=structuredClone(d.scenario);s.policy.step*=factor;
 s.ship.dryMass=U+.2;s.ship.propellant=2.5;s.ship.tankCapacity=2.5;
 s.ship.engine.maxThrust=32;s.ship.state=portState(d.ports[0],.3);s.epoch=.3;s.duration=1;
 const ascent=prepareAtmosphericLeg({scenario:s,atmosphere:d.entry.atmosphere,
  aero:{...d.entry.aero,dragArea:.015*(U+2.7)/7,liftToDrag:0},start:.3,end:.78,arcs:[d.arcs[0]]});
 const split=atmosphericStateAt(ascent,.78);
 s.ship.dryMass=.2;s.ship.state=split.slice(0,6);s.ship.propellant=split[6];s.epoch=.78;
 s.bodies[0].radius+=d.entry.atmosphere.topHeight;
 const start=.78,end=1.14,angles=[3.68,3.65,3.5];
 const keys=angles.map((a,i)=>({offset:(end-start)*i/(angles.length-1),direction:[Math.cos(a),Math.sin(a),0]}));
 const arc={id:'booster-boostback',start,end,direction:keys[0].direction,throttle:1,steering:{kind:'spherical-smoothstep-v1',keys}};
 const run=new Runner(validateBundle({scenario:s,program:{schemaVersion:4,id:'booster',burns:[],thrustArcs:[arc]}}));
 const entryInitial=run.advanceTo(end);
 if(entryInitial.status!=='running')throw Error(JSON.stringify(entryInitial));
 const entry=prepareEntry({...d.entry,id:'booster',name:'Booster recovery',extent:2,
  description:'Finite booster recovery',provenance:'Bounded authored witness',
  scenario:{...s,bodies:d.scenario.bodies,epoch:end,duration:8,policy:{...s.policy,maxNodes:32768},
   ship:{...s.ship,state:entryInitial.y,propellant:entryInitial.propellant}}},{displayRate:1});
 results.push({step:s.policy.step,split,arc,entryInitial,contact:entry.contact,
  entryEpoch:entry.entryEpoch,brakingEpoch:entry.brakingEpoch,maxima:entry.maxima,
  ascentMaxima:ascent.maxima,work:entry.work,
  nodes:{ascent:ascent.nodes.length,boostback:run.retainedTreeNodes,entry:entry.nodes.length},
  terminalDeltaV:8*Math.log((.2+entryInitial.propellant)/(.2+entry.contact.before[6]))});
}
console.log(JSON.stringify(results));
"""


def gravity(t, state):
    rail = D["scenario"]["bodies"][1]["rail"]
    angle = rail["phase"] + rail["rate"] * t
    moon = rail["radius"] * np.array([math.cos(angle), math.sin(angle)])
    delta = moon - state[:2]
    return (
        -state[:2] / np.linalg.norm(state[:2]) ** 3
        + 0.03 * delta / np.linalg.norm(delta) ** 3
    )


def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def aero(state, area, lift_ratio):
    atmosphere = D["entry"]["atmosphere"]
    position, velocity = state[:2], state[2:4]
    radius = np.linalg.norm(position)
    normal = position / radius
    altitude = radius - 1
    relative = velocity - 0.03 * np.array([-position[1], position[0]])
    speed = np.linalg.norm(relative)
    density = atmosphere["density"] * math.exp(
        -max(altitude, 0) / atmosphere["scaleHeight"]
    )
    density *= smooth(
        (atmosphere["topHeight"] - altitude)
        / (atmosphere["topHeight"] - atmosphere["fadeHeight"])
    )
    force = 0.5 * density * speed**2 * area
    unit = relative / speed if speed > 1e-12 else np.zeros(2)
    projected = normal - unit * np.dot(normal, unit)
    reference = projected / math.sqrt(np.dot(projected, projected) + 1e-8)
    lift = (
        reference
        * force
        * lift_ratio
        * smooth(altitude / D["entry"]["aero"]["liftFadeHeight"])
    )
    return -force * unit + lift, relative, normal, altitude


def powered(state, start, end, angles, nonfuel, area):
    times = np.linspace(start, end, len(angles))
    for left, right, first, last in zip(times[:-1], times[1:], angles[:-1], angles[1:]):

        def rhs(t, z, first=first, last=last, left=left, right=right):
            angle = first + smooth((t - left) / (right - left)) * (last - first)
            mass = nonfuel + z[4]
            force = min(32, 3 * mass)
            acceleration = force / mass * np.array([math.cos(angle), math.sin(angle)])
            return np.r_[
                z[2:4],
                gravity(t, z) + aero(z, area, 0)[0] / mass + acceleration,
                -force / 8,
            ]

        solution = solve_ivp(
            rhs,
            (left, right),
            state,
            method="DOP853",
            rtol=2e-13,
            atol=2e-14,
            max_step=(right - left) / 16,
        )
        assert solution.success
        state = solution.y[:, -1]
    return state


def independent():
    angle = 0.03 * 0.3
    position = 1.00001 * np.array([math.cos(angle), math.sin(angle)])
    initial = np.r_[
        position, 0.03 * np.array([-position[1], position[0]]), INITIAL_FUEL
    ]
    split = powered(
        initial,
        0.3,
        0.78,
        [0.009, 0.12, 0.25, 0.4, 0.65, 0.85],
        UPPER_MASS + DRY,
        0.015 * STACK_MASS / 7,
    )
    entry_initial = powered(split.copy(), 0.78, 1.14, BOOSTBACK["angles"], DRY, 0)
    guidance, recovery, config = (
        D["entry"][k] for k in ["guidance", "recovery", "aero"]
    )

    def rhs(t, z):
        mass = DRY + z[4]
        drag_lift, relative, normal, altitude = aero(
            z, config["dragArea"], config["liftToDrag"]
        )
        g = gravity(t, z)
        engagement = smooth(
            (guidance["startHeight"] - altitude)
            / (guidance["startHeight"] - guidance["fullHeight"])
        )
        target = -math.sqrt(
            guidance["descentSpeed"] ** 2
            + 2 * guidance["descentGain"] * max(0, altitude - recovery["height"])
        )
        force = (
            mass
            * engagement
            * (
                -g
                - drag_lift / mass
                + guidance["velocityGain"] * (target * normal - relative)
            )
        )
        length = np.linalg.norm(force)
        maximum = min(32, 3 * mass)
        if length > maximum:
            force *= maximum / length
        return np.r_[z[2:4], g + (drag_lift + force) / mass, -np.linalg.norm(force) / 8]

    class Contact:
        terminal = True
        direction = -1

        def __call__(self, _t, z):
            return np.linalg.norm(z[:2]) - 1 - recovery["height"]

    contact = Contact()
    solution = solve_ivp(
        rhs,
        (1.14, 9.14),
        entry_initial,
        method="DOP853",
        rtol=2e-12,
        atol=2e-13,
        max_step=0.002,
        events=contact,
    )
    assert solution.success and len(solution.t_events[0]) == 1
    return {
        "split": split.tolist(),
        "entryInitial": entry_initial.tolist(),
        "contactEpoch": float(solution.t_events[0][0]),
        "contactState": solution.y_events[0][0].tolist(),
    }


def planar(values):
    return np.asarray(values)[[0, 1, 3, 4, 6]]


def main():
    canonical = json.loads(
        subprocess.check_output(
            ["node", "--import", "tsx", "--input-type=module", "-e", CANONICAL],
            cwd=ROOT,
            text=True,
        )
    )
    oracle = independent()
    a, b = canonical
    errors = {
        "splitOracle": float(np.max(np.abs(planar(a["split"]) - oracle["split"]))),
        "entryInitialOracle": float(
            np.max(
                np.abs(
                    planar(a["entryInitial"]["y"] + [a["entryInitial"]["propellant"]])
                    - oracle["entryInitial"]
                )
            )
        ),
        "contactStateOracle": float(
            np.max(np.abs(planar(a["contact"]["before"]) - oracle["contactState"]))
        ),
        "contactEpochOracle": abs(a["contact"]["t"] - oracle["contactEpoch"]),
        "contactStateRefinement": float(
            np.max(np.abs(np.array(a["contact"]["before"]) - b["contact"]["before"]))
        ),
        "contactEpochRefinement": abs(a["contact"]["t"] - b["contact"]["t"]),
    }
    assert max(errors.values()) < 2e-7, errors
    output = {
        "purpose": "Offline staged Apollo booster controls and independent recovery evidence",
        "massContract": {
            "upperInitialMass": UPPER_MASS,
            "boosterDryMass": DRY,
            "boosterInitialFuel": INITIAL_FUEL,
            "stackInitialMass": STACK_MASS,
            "stackDragArea": 0.015 * STACK_MASS / 7,
            "boosterSplitFuelExact": STACK_MASS * math.exp(-0.18) - UPPER_MASS - DRY,
        },
        "boostback": BOOSTBACK,
        "canonical": canonical,
        "independentDOP853": oracle,
        "errors": errors,
        "limits": "Numerical admission only; no browser or owner acceptance claim.",
    }
    (HERE / "booster-witness.json").write_text(json.dumps(output, indent=2) + "\n")
    print(
        json.dumps(
            {"errors": errors, "contact": a["contact"], "maxima": a["maxima"]}, indent=2
        )
    )


if __name__ == "__main__":
    main()
