"""Independent adaptive-integrator check; offline design evidence, never game runtime."""

from __future__ import annotations

import json
import platform
from collections.abc import Callable
from pathlib import Path
from typing import Any

import numpy as np
import scipy
from numpy.typing import NDArray
from scipy.integrate import solve_ivp
from scipy.optimize import minimize_scalar

Vector = NDArray[np.float64]
HERE = Path(__file__).resolve().parent
REQUEST: dict[str, Any] = json.loads((HERE / "oracle-input.json").read_text())


def bodies(t: float) -> tuple[Vector, Vector]:
    unit = np.array([np.cos(t), np.sin(t)], dtype=np.float64)
    return -0.02 * unit, 0.98 * unit


def derivative(t: float, state: Vector) -> Vector:
    acceleration = np.zeros(2)
    for mass, position in zip((0.98, 0.02), bodies(t), strict=True):
        relative = position - state[:2]
        acceleration += mass * relative / np.linalg.norm(relative) ** 3
    return np.concatenate((state[2:], acceleration))


def solve(
    burns: list[dict[str, Any]], rtol: float, atol: float, max_step: float
) -> tuple[Callable[[float], Vector], int]:
    start = 0.0
    state = np.array(REQUEST["initial"], dtype=np.float64)
    pieces: list[tuple[float, float, Any]] = []
    calls = 0
    segments: list[dict[str, Any]] = [*burns, {"t": REQUEST["horizon"], "dv": [0.0, 0.0]}]
    for burn in segments:
        end = float(burn["t"])
        solution = solve_ivp(
            derivative,
            (start, end),
            state,
            method="DOP853",
            rtol=rtol,
            atol=atol,
            max_step=max_step,
            dense_output=True,
        )
        if not solution.success:
            raise RuntimeError(solution.message)
        pieces.append((start, end, solution.sol))
        calls += solution.nfev
        state = solution.y[:, -1].copy()
        state[2:] += np.array(burn["dv"])
        start = end

    def evaluate(t: float) -> Vector:
        # Post-impulse at boundaries; output shape always one four-vector.
        for low, high, dense in reversed(pieces):
            if low <= t <= high:
                return np.asarray(dense(t), dtype=np.float64)
        raise ValueError(f"outside oracle range: {t}")

    return evaluate, calls


def main() -> None:
    results: dict[str, Any] = {
        "environment": {"python": platform.python_version(), "scipy": scipy.__version__},
        "method": "DOP853",
        "tolerances": {"rtol": 1e-12, "atol": 1e-14, "max_step": 0.05},
        "tightened": {"rtol": 3e-14, "atol": 1e-15, "max_step": 0.01},
        "branches": [],
    }
    for name, burns, ts_name in (
        ("baseline", [], "tsBaseline"),
        ("edited", REQUEST["burns"], "tsEdited"),
    ):
        evaluate, calls = solve(burns, 1e-12, 1e-14, 0.05)
        tight, tight_calls = solve(burns, 3e-14, 1e-15, 0.01)
        samples = np.array([evaluate(t) for t in REQUEST["checkTimes"]])
        tight_samples = np.array([tight(t) for t in REQUEST["checkTimes"]])
        ts_samples = np.array(REQUEST[ts_name])
        minimum = minimize_scalar(
            lambda t: np.linalg.norm(evaluate(t)[:2] - bodies(t)[1]),
            bounds=(2.4, 2.6),
            method="bounded",
            options={"xatol": 1e-13},
        )
        moon_samples = np.array([bodies(t)[1] for t in REQUEST["checkTimes"]], dtype=np.float64)
        planet_samples = np.array([bodies(t)[0] for t in REQUEST["checkTimes"]], dtype=np.float64)
        sampled_min_moon = float(np.linalg.norm(samples[:, :2] - moon_samples, axis=1).min())
        sampled_min_planet = float(np.linalg.norm(samples[:, :2] - planet_samples, axis=1).min())
        step_checks = [
            {
                "step": row["step"],
                "endpointStateError": float(
                    np.linalg.norm(np.array(row[f"{name}Final"]) - tight(REQUEST["horizon"]))
                ),
            }
            for row in REQUEST["steps"]
        ]
        result = {
            "name": name,
            "functionEvaluations": calls,
            "tightFunctionEvaluations": tight_calls,
            "maxTsStateError": float(np.linalg.norm(ts_samples - tight_samples, axis=1).max()),
            "maxTsPositionError": float(
                np.linalg.norm(ts_samples[:, :2] - tight_samples[:, :2], axis=1).max()
            ),
            "maxOracleRefinementDifference": float(
                np.linalg.norm(samples - tight_samples, axis=1).max()
            ),
            "closestMoonLocalRefinement": {"t": float(minimum.x), "distance": float(minimum.fun)},
            "sampledMinimumMoon": sampled_min_moon,
            "sampledMinimumPlanet": sampled_min_planet,
            "stepChecks": step_checks,
        }
        assert result["maxTsPositionError"] < 1e-7, result
        assert result["maxOracleRefinementDifference"] < 1e-9, result
        assert sampled_min_moon > 0.025 and sampled_min_planet > 0.08
        results["branches"].append(result)
    (HERE / "oracle-report.json").write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
