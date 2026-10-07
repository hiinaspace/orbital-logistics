"""Finite analytic route comparison, independent of the application simulation.

Run: uv run --project spikes/numerics python docs/design/topology-study/consultant/hohmann_routes.py
Retain compact sweep scores and paths; full event ledgers only for the primary witness.
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import asdict, dataclass, field
from itertools import pairwise
from math import atan2, cos, expm1, hypot, pi, sin, sqrt
from pathlib import Path
from typing import TypedDict

import numpy as np
from scipy.integrate import solve_ivp

TAU = 2 * pi
DRY = 1.0
INITIAL_FUEL = 0.6
EXHAUST = 3.0
PARCEL = 0.2
SERVICE = 0.25
RESERVE = 0.05


@dataclass(frozen=True)
class Port:
    name: str
    radius: float
    phase: float

    @property
    def rate(self) -> float:
        return self.radius**-1.5

    def angle(self, epoch: float) -> float:
        return self.phase + self.rate * epoch


@dataclass
class Event:
    time: float
    kind: str
    port: str
    fuel_before: float
    fuel_after: float
    cargo_before: float
    cargo_after: float
    mass_before: float
    mass_after: float
    signed_tangential_impulse: float = 0.0
    fuel_used: float = 0.0
    cargo_at_a: float = 0.0
    delivered_b: float = 0.0
    delivered_c: float = 0.0
    wait_duration: float = 0.0


@dataclass
class Leg:
    source: str
    destination: str
    ready: float
    departure: float
    arrival: float
    duration: float
    waiting: float
    departure_angle: float
    target_angle: float
    endpoint_phase_error: float
    departure_impulse: float
    arrival_impulse: float
    departure_fuel_used: float
    arrival_fuel_used: float


@dataclass
class Vehicle:
    itinerary: list[str]
    initial_assigned_cargo: float
    return_time: float = 0.0
    fuel_remaining: float = INITIAL_FUEL
    cargo: float = 0.0
    cargo_at_a: float = 0.0
    deliveries: dict[str, float] = field(default_factory=dict)
    legs: list[Leg] = field(default_factory=list)
    ledger: list[Event] = field(default_factory=list)

    @property
    def fuel_used(self) -> float:
        return INITIAL_FUEL - self.fuel_remaining

    def event(
        self,
        epoch: float,
        kind: str,
        port: str,
        *,
        cargo_delta: float = 0.0,
        impulse: float = 0.0,
        waiting: float = 0.0,
    ) -> float:
        fuel_before, cargo_before = self.fuel_remaining, self.cargo
        mass_before = DRY + fuel_before + cargo_before
        used = mass_before * -expm1(-abs(impulse) / EXHAUST)
        self.fuel_remaining -= used
        self.cargo += cargo_delta
        if kind == "load":
            self.cargo_at_a -= cargo_delta
        if kind == "deliver":
            self.deliveries[port] = epoch
        self.ledger.append(
            Event(
                epoch,
                kind,
                port,
                fuel_before,
                self.fuel_remaining,
                cargo_before,
                self.cargo,
                mass_before,
                DRY + self.fuel_remaining + self.cargo,
                impulse,
                used,
                self.cargo_at_a,
                PARCEL if "B" in self.deliveries else 0.0,
                PARCEL if "C" in self.deliveries else 0.0,
                waiting,
            )
        )
        assert self.fuel_remaining >= -1e-12
        assert self.cargo >= -1e-12 and self.cargo_at_a >= -1e-12
        assert (
            abs(
                self.cargo
                + self.cargo_at_a
                + PARCEL * len(self.deliveries)
                - self.initial_assigned_cargo
            )
            < 1e-12
        )
        return used


@dataclass
class Candidate:
    name: str
    family: str
    hardware: int
    completion_time: float
    fuel_used: float
    minimum_terminal_fuel: float
    feasible: bool
    delivery_times: dict[str, float]
    vehicles: list[Vehicle]
    nondominated: bool = False


@dataclass
class PhaseResult:
    index: int
    c_phase: float
    candidates: list[Candidate]


class Verification(TypedDict):
    leg: str
    departure: float
    position_error: float
    circular_velocity_error_after_paid_arrival_impulse: float
    signed_arrival_impulse_error: float
    arrival_impulse: float
    integrated_required_arrival_impulse: float


def wrap_signed(angle: float) -> float:
    return atan2(sin(angle), cos(angle))


def departure_after(source: Port, target: Port, ready: float, duration: float) -> float:
    """Earliest prograde half-ellipse rendezvous after readiness, including equality."""
    omega = target.rate - source.rate
    rhs = pi + source.phase - target.phase - target.rate * duration
    gap = (rhs - omega * ready) % TAU if omega > 0 else (omega * ready - rhs) % TAU
    if min(gap, TAU - gap) < 1e-12:
        gap = 0.0
    return ready + gap / abs(omega)


def run_vehicle(names: list[str], ports: dict[str, Port], combined: bool) -> Vehicle:
    assigned = PARCEL * len([name for name in names if name != "A"])
    vehicle = Vehicle(names, assigned, cargo_at_a=assigned)
    ready = SERVICE
    first_load = assigned if combined else PARCEL
    vehicle.event(ready, "load", "A", cargo_delta=first_load)
    for index, (source_name, target_name) in enumerate(pairwise(names)):
        source, target = ports[source_name], ports[target_name]
        semimajor = (source.radius + target.radius) / 2
        duration = pi * sqrt(semimajor**3)
        departure = departure_after(source, target, ready, duration)
        arrival = departure + duration
        departure_angle = source.angle(departure)
        target_angle = target.angle(arrival)
        phase_error = abs(wrap_signed(target_angle - departure_angle - pi))
        assert phase_error < 1e-11
        first_impulse = sqrt(2 / source.radius - 1 / semimajor) - sqrt(1 / source.radius)
        second_impulse = sqrt(1 / target.radius) - sqrt(2 / target.radius - 1 / semimajor)
        vehicle.event(departure, "wait-complete", source_name, waiting=departure - ready)
        first_fuel = vehicle.event(departure, "departure-burn", source_name, impulse=first_impulse)
        second_fuel = vehicle.event(arrival, "arrival-burn", target_name, impulse=second_impulse)
        vehicle.legs.append(
            Leg(
                source_name,
                target_name,
                ready,
                departure,
                arrival,
                duration,
                departure - ready,
                departure_angle,
                target_angle,
                phase_error,
                first_impulse,
                second_impulse,
                first_fuel,
                second_fuel,
            )
        )
        if index == len(names) - 2:
            assert target_name == "A"
            vehicle.return_time = arrival
            vehicle.event(arrival, "final-return", "A")
        else:
            ready = arrival + SERVICE
            if target_name == "A":
                vehicle.event(ready, "load", "A", cargo_delta=PARCEL)
            else:
                vehicle.event(ready, "deliver", target_name, cargo_delta=-PARCEL)
    assert abs(vehicle.cargo) < 1e-12 and abs(vehicle.cargo_at_a) < 1e-12
    assert abs(sum(event.fuel_used for event in vehicle.ledger) - vehicle.fuel_used) < 1e-12
    return vehicle


def make_candidate(name: str, family: str, vehicles: list[Vehicle]) -> Candidate:
    deliveries = {port: epoch for v in vehicles for port, epoch in v.deliveries.items()}
    assert set(deliveries) == {"B", "C"}
    minimum_fuel = min(v.fuel_remaining for v in vehicles)
    return Candidate(
        name,
        family,
        len(vehicles),
        max(v.return_time for v in vehicles),
        sum(v.fuel_used for v in vehicles),
        minimum_fuel,
        minimum_fuel >= RESERVE - 1e-12,
        deliveries,
        vehicles,
    )


def dominates(left: Candidate, right: Candidate) -> bool:
    scores_left = (left.completion_time, left.fuel_used, float(left.hardware))
    scores_right = (right.completion_time, right.fuel_used, float(right.hardware))
    return all(a <= b + 1e-10 for a, b in zip(scores_left, scores_right)) and any(
        a < b - 1e-10 for a, b in zip(scores_left, scores_right)
    )


def scan_phase(index: int) -> PhaseResult:
    phase = TAU * index / 72
    ports = {
        "A": Port("A", 1.0, 0.0),
        "B": Port("B", 1.4, 0.8467093134799941),
        "C": Port("C", 2.0, phase),
    }
    candidates = []
    for names, family in [
        (["A", "B", "C", "A"], "combined-tour"),
        (["A", "C", "B", "A"], "combined-tour"),
        (["A", "B", "A", "C", "A"], "serial-sorties"),
        (["A", "C", "A", "B", "A"], "serial-sorties"),
    ]:
        vehicle = run_vehicle(names, ports, combined=family == "combined-tour")
        candidates.append(make_candidate("-".join(names), family, [vehicle]))
    candidates.append(
        make_candidate(
            "A-B-A + A-C-A",
            "parallel-sorties",
            [
                run_vehicle(["A", "B", "A"], ports, combined=False),
                run_vehicle(["A", "C", "A"], ports, combined=False),
            ],
        )
    )
    for candidate in candidates:
        candidate.nondominated = candidate.feasible and not any(
            other.feasible and dominates(other, candidate) for other in candidates
        )
    return PhaseResult(index, phase, candidates)


def illustration_rank(result: PhaseResult) -> tuple[bool, bool, float]:
    front = [c for c in result.candidates if c.nondominated]
    singles = [c for c in front if c.hardware == 1]
    single_time_span = (
        max(c.completion_time for c in singles) / min(c.completion_time for c in singles) - 1
    )
    single_fuel_span = max(c.fuel_used for c in singles) - min(c.fuel_used for c in singles)
    single_noticeable = (
        len({c.family for c in singles}) >= 2
        and single_time_span >= 0.1
        and single_fuel_span >= 0.01
    )
    time_span = max(c.completion_time for c in front) / min(c.completion_time for c in front) - 1
    fuel_span = max(c.fuel_used for c in front) - min(c.fuel_used for c in front)
    noticeable = len({c.family for c in front}) >= 2 and time_span >= 0.1 and fuel_span >= 0.01
    score = single_time_span * single_fuel_span if single_noticeable else time_span * fuel_span
    return single_noticeable, noticeable, score


def verify_directed_legs(result: PhaseResult) -> list[Verification]:
    """Independently integrate every distinct directed leg represented at this phase."""
    ports = {
        "A": Port("A", 1.0, 0.0),
        "B": Port("B", 1.4, 0.8467093134799941),
        "C": Port("C", 2.0, result.c_phase),
    }
    selected = {}
    for candidate in result.candidates:
        for vehicle in candidate.vehicles:
            for leg in vehicle.legs:
                selected.setdefault((leg.source, leg.destination), leg)
    checks: list[Verification] = []

    def rhs(_epoch, state):
        scale = -1 / hypot(state[0], state[1]) ** 3
        return [state[2], state[3], scale * state[0], scale * state[1]]

    for (source_name, target_name), leg in sorted(selected.items()):
        source, target = ports[source_name], ports[target_name]
        angle = source.angle(leg.departure)
        radial = np.array([cos(angle), sin(angle)])
        tangent = np.array([-sin(angle), cos(angle)])
        state = np.concatenate(
            [
                source.radius * radial,
                (sqrt(1 / source.radius) + leg.departure_impulse) * tangent,
            ]
        )
        solution = solve_ivp(
            rhs,
            (0, leg.duration),
            state,
            method="DOP853",
            rtol=3e-14,
            atol=2e-15,
        )
        assert solution.success
        final = solution.y[:, -1]
        target_angle = target.angle(leg.arrival)
        target_radial = np.array([cos(target_angle), sin(target_angle)])
        target_tangent = np.array([-sin(target_angle), cos(target_angle)])
        expected_position = target.radius * target_radial
        expected_velocity = sqrt(1 / target.radius) * target_tangent
        position_error = float(np.linalg.norm(final[:2] - expected_position))
        matched_velocity = final[2:] + leg.arrival_impulse * target_tangent
        velocity_error = float(np.linalg.norm(matched_velocity - expected_velocity))
        actual_arrival_impulse = float(np.dot(expected_velocity - final[2:], target_tangent))
        impulse_error = abs(actual_arrival_impulse - leg.arrival_impulse)
        assert position_error < 1e-8
        assert velocity_error < 1e-8 and impulse_error < 1e-8
        assert np.sign(actual_arrival_impulse) == np.sign(leg.arrival_impulse)
        assert np.sign(leg.departure_impulse) == np.sign(target.radius - source.radius)
        checks.append(
            {
                "leg": f"{source_name}-{target_name}",
                "departure": leg.departure,
                "position_error": position_error,
                "circular_velocity_error_after_paid_arrival_impulse": velocity_error,
                "signed_arrival_impulse_error": impulse_error,
                "arrival_impulse": leg.arrival_impulse,
                "integrated_required_arrival_impulse": actual_arrival_impulse,
            }
        )
    assert len(checks) == 6
    return checks


def compact_phase(result: PhaseResult) -> dict[str, object]:
    """Retain every candidate's scores and route without repeating event ledgers."""
    return {
        "index": result.index,
        "c_phase": result.c_phase,
        "candidates": [
            {
                "name": candidate.name,
                "family": candidate.family,
                "paths": [vehicle.itinerary for vehicle in candidate.vehicles],
                "hardware": candidate.hardware,
                "completion_time": candidate.completion_time,
                "fuel_used": candidate.fuel_used,
                "minimum_terminal_fuel": candidate.minimum_terminal_fuel,
                "feasible": candidate.feasible,
                "nondominated": candidate.nondominated,
                "delivery_times": candidate.delivery_times,
            }
            for candidate in result.candidates
        ],
    }


def main() -> None:
    results = [scan_phase(index) for index in range(72)]
    ranked = sorted(results, key=illustration_rank, reverse=True)
    illustrations: list[PhaseResult] = []
    for result in ranked:
        if all(
            min(abs(result.index - old.index), 72 - abs(result.index - old.index)) >= 6
            for old in illustrations
        ):
            illustrations.append(result)
        if len(illustrations) == 3:
            break
    counts = Counter(c.name for r in results for c in r.candidates if c.nondominated)
    family_counts = Counter(
        family
        for result in results
        for family in {c.family for c in result.candidates if c.nondominated}
    )
    summary = {
        "phase_count": len(results),
        "candidate_count": sum(len(r.candidates) for r in results),
        "feasible_candidate_count": sum(c.feasible for r in results for c in r.candidates),
        "nondominated_candidate_phase_counts": dict(counts),
        "nondominated_family_phase_counts": dict(family_counts),
        "phases_with_multiple_nondominated_families": sum(
            len({c.family for c in r.candidates if c.nondominated}) >= 2 for r in results
        ),
        "phases_with_noticeable_one_tug_family_tradeoff": sum(
            illustration_rank(r)[0] for r in results
        ),
        "phases_with_noticeable_time_and_fuel_span": sum(illustration_rank(r)[1] for r in results),
        "phases_with_multiple_one_tug_families_nondominated_and_complete_by_64": sum(
            len(
                {
                    c.family
                    for c in r.candidates
                    if c.nondominated and c.hardware == 1 and c.completion_time <= 64
                }
            )
            >= 2
            for r in results
        ),
        "fastest_candidate_phase_counts": dict(
            Counter(min(r.candidates, key=lambda c: c.completion_time).name for r in results)
        ),
    }
    verification = verify_directed_legs(illustrations[0])
    output = {
        "experiment": (
            "Five finite prograde exact Hohmann route candidates over 72 third-port phases"
        ),
        "schema": {
            "phases": (
                "Compact sweep: all 360 candidates retain scores, vehicle paths, feasibility, "
                "Pareto flags and delivery times; ledgers are computed and validated internally "
                "but omitted here."
            ),
            "illustrations": (
                "Compact score/path summaries for the three explicitly selected phases."
            ),
            "primary_detailed_witness": (
                "All five candidates at the first selected phase, including every vehicle's "
                "cargo/fuel/event ledger and transfer legs."
            ),
            "independent_verification": (
                "DOP853 endpoint and signed circular-matching checks for all six distinct "
                "directed legs in the primary witness."
            ),
        },
        "constants": {
            "mu": 1,
            "a_radius": 1,
            "a_phase": 0,
            "b_radius": 1.4,
            "b_phase": 0.8467093134799941,
            "c_radius": 2,
            "dry_mass_per_tug": DRY,
            "initial_fuel_per_tug": INITIAL_FUEL,
            "exhaust_velocity": EXHAUST,
            "cargo_per_destination": PARCEL,
            "service_duration": SERVICE,
            "minimum_terminal_fuel_per_tug": RESERVE,
        },
        "assumptions": [
            "Massless circular coplanar ports, central gravity only, dimensionless units.",
            (
                "All spacecraft initially docked to A at epoch zero; "
                "phase scan excludes duplicate 2pi."
            ),
            "Initial loading finishes at 0.25; each intermediate stop has one 0.25 service.",
            "Cargo loads/deliveries occur at service completion; arrival burns precede unloading.",
            "Vehicles stay attached to each circular port while waiting; no stationkeeping cost.",
            (
                "Each parcel loaded once from finite assigned A stock; "
                "no refueling or free capture burns."
            ),
            "Fuel consumed by rocket equation using current dry+cargo+fuel mass at each impulse.",
            "Parallel candidate has two independent tugs and assumes noncontending A service.",
            (
                "Completion is max final A return time; fuel is summed consumption, "
                "hardware is tug count."
            ),
            "All scores minimized; dominance tolerance 1e-10; initial fuel .6 on every tug.",
            (
                "Greedy earliest feasible departure after readiness; "
                "deliberately no discretionary holds."
            ),
        ],
        "limitations": [
            (
                "Offline analytic experiment, not the app fixture, "
                "a joint handoff, or evidence of fun."
            ),
            (
                "Arbitrary C radius and authored-content phase search, not an unbiased incidence "
                "estimate; five candidates only, no global optimum claim."
            ),
            (
                "No vehicle design/capacity limits, port contention, production, "
                "uncertain execution, or assists."
            ),
            "Finite complete itineraries only; no infinite repeat or sustained throughput claim.",
        ],
        "summary": summary,
        "illustration_selection": {
            "criterion": (
                "First prefer >=2 nondominated one-tug families with >=10% time span and "
                ">=.01 fuel span, then any families meeting those spans. "
                "Maximize (maxTime/minTime-1)*(maxFuel-minFuel) within the qualifying front. "
                "Greedily choose three separated by >=6 phase samples."
            ),
            "phase_indices": [r.index for r in illustrations],
            "ranking_scores": [illustration_rank(r)[2] for r in illustrations],
            "nondominated_one_tug_candidates_within_app_horizon_64": {
                str(r.index): [
                    c.name
                    for c in r.candidates
                    if c.nondominated and c.hardware == 1 and c.completion_time <= 64
                ]
                for r in illustrations
            },
        },
        "illustrations": [compact_phase(r) for r in illustrations],
        "primary_detailed_witness": asdict(illustrations[0]),
        "independent_verification": {
            "phase_index": illustrations[0].index,
            "integrator": "scipy solve_ivp DOP853; rtol=3e-14, atol=2e-15",
            "distinct_directed_legs": verification,
        },
        "phases": [compact_phase(r) for r in results],
    }
    path = Path(__file__).with_name("route-results.json")
    path.write_text(json.dumps(output, indent=2, allow_nan=False, sort_keys=True) + "\n")
    print(json.dumps(summary, indent=2))
    print("Illustrative phases:")
    for result in illustrations:
        print(f"C phase {result.c_phase:.9f} (sample {result.index}):")
        for candidate in result.candidates:
            print(
                f"  {candidate.name}: time={candidate.completion_time:.9f}, "
                f"fuel={candidate.fuel_used:.9f}, hardware={candidate.hardware}, "
                f"nondominated={candidate.nondominated}"
            )
    maximum_position_error = max(float(c["position_error"]) for c in verification)
    print(f"DOP853 maximum position error: {maximum_position_error:.3g}")
    print(f"Saved {path}")


if __name__ == "__main__":
    main()
