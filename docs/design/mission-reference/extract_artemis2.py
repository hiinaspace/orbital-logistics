"""Regenerate a compact, offline Artemis II state trace from NASA/JPL sources.

Run with ``uv run --no-project python extract_artemis2.py`` from this directory.
The two upstream text responses are downloaded transiently; only the sampled CSV
is retained. This script is for design analysis, not app runtime use.
"""

import csv
import hashlib
import itertools
from bisect import bisect_right
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
OEM_URL = "https://naif.jpl.nasa.gov/pub/naif/ARTEMIS/kernels/spk/EM2_FODNAVBET_revF_PUBLIC.oem"
HORIZONS_PARAMETERS = {
    "format": "text",
    "COMMAND": "'301'",
    "CENTER": "'500@399'",
    "EPHEM_TYPE": "'VECTORS'",
    "START_TIME": "'2026-04-02 00:00'",
    "STOP_TIME": "'2026-04-11 00:00'",
    "STEP_SIZE": "'5 min'",
    "REF_PLANE": "'FRAME'",
    "REF_SYSTEM": "'ICRF'",
    "TIME_TYPE": "'UT'",
    "OUT_UNITS": "'KM-S'",
    "VEC_TABLE": "'2'",
    "VEC_CORR": "'NONE'",
    "CSV_FORMAT": "'YES'",
    "VEC_LABELS": "'NO'",
    "OBJ_DATA": "'NO'",
}
HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urlencode(HORIZONS_PARAMETERS)


def fetch(url: str) -> str:
    with urlopen(url, timeout=60) as response:
        return response.read().decode("ascii")


def epoch(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=UTC)


def parse_oem(body: str) -> list[tuple[datetime, str, tuple[float, ...]]]:
    points: list[tuple[datetime, str, tuple[float, ...]]] = []
    in_meta = False
    in_covariance = False
    source = ""
    center = frame = timescale = ""
    for line in body.splitlines():
        if line == "META_START":
            in_meta = True
            source = ""
        elif line == "META_STOP":
            in_meta = False
            assert (center, frame, timescale) == ("EARTH", "EME2000", "UTC")
        elif line == "COVARIANCE_START":
            in_covariance = True
        elif line == "COVARIANCE_STOP":
            in_covariance = False
        elif in_meta:
            if line.startswith("COMMENT Derived from "):
                source = line.removeprefix("COMMENT Derived from ")
            elif line.startswith("CENTER_NAME = "):
                center = line.removeprefix("CENTER_NAME = ")
            elif line.startswith("REF_FRAME = "):
                frame = line.removeprefix("REF_FRAME = ")
            elif line.startswith("TIME_SYSTEM = "):
                timescale = line.removeprefix("TIME_SYSTEM = ")
        elif not in_covariance and line.startswith("2026-"):
            fields = line.split()
            if len(fields) == 7:
                points.append((epoch(fields[0]), source, tuple(map(float, fields[1:]))))
    assert len(points) > 10000
    assert all(a[0] < b[0] for a, b in itertools.pairwise(points))
    return points


def parse_horizons(body: str) -> list[tuple[datetime, tuple[float, ...]]]:
    assert "Target body name: Moon (301)" in body
    assert "Center body name: Earth (399)" in body
    assert "Reference frame : ICRF" in body
    assert "Output units    : KM-S" in body
    rows = body.split("$$SOE\n", 1)[1].split("$$EOE", 1)[0].splitlines()
    points = []
    for row in csv.reader(rows):
        when = datetime.strptime(row[1].strip(), "A.D. %Y-%b-%d %H:%M:%S.%f")
        points.append((when.replace(tzinfo=UTC), tuple(map(float, row[2:8]))))
    assert len(points) == 2593
    return points


def sampled_oem(
    points: list[tuple[datetime, str, tuple[float, ...]]],
) -> list[tuple[datetime, str, tuple[float, ...]]]:
    result = []
    last_source = ""
    for point in points:
        if (
            point[1] != last_source
            or not result
            or (point[0] - result[-1][0]).total_seconds() >= 600
        ):
            result.append(point)
            last_source = point[1]
    if result[-1] != points[-1]:
        result.append(points[-1])
    return result


def moon_at(
    when: datetime,
    moon: list[tuple[datetime, tuple[float, ...]]],
    moon_times: list[datetime],
) -> tuple[float, ...]:
    right = bisect_right(moon_times, when)
    assert 0 < right < len(moon)
    t0, a = moon[right - 1]
    t1, b = moon[right]
    fraction = (when - t0).total_seconds() / (t1 - t0).total_seconds()
    return tuple(x + (y - x) * fraction for x, y in zip(a, b))


def main() -> None:
    oem_body = fetch(OEM_URL)
    moon_body = fetch(HORIZONS_URL)
    ship = sampled_oem(parse_oem(oem_body))
    moon = parse_horizons(moon_body)
    moon_times = [item[0] for item in moon]
    result = HERE / "artemis2-reconstructed-10min.csv"
    with result.open("w", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(
            ["utc", "oem_source"]
            + [
                f"ship_{axis}_{unit}"
                for axis, unit in (
                    ("x", "km"),
                    ("y", "km"),
                    ("z", "km"),
                    ("vx", "km_s"),
                    ("vy", "km_s"),
                    ("vz", "km_s"),
                )
            ]
            + [
                f"moon_{axis}_{unit}"
                for axis, unit in (
                    ("x", "km"),
                    ("y", "km"),
                    ("z", "km"),
                    ("vx", "km_s"),
                    ("vy", "km_s"),
                    ("vz", "km_s"),
                )
            ]
        )
        for when, source, state in ship:
            writer.writerow(
                [
                    when.isoformat(timespec="milliseconds"),
                    source,
                    *state,
                    *moon_at(when, moon, moon_times),
                ]
            )
    print(f"OEM SHA-256: {hashlib.sha256(oem_body.encode('ascii')).hexdigest()}")
    print(f"Horizons SHA-256: {hashlib.sha256(moon_body.encode('ascii')).hexdigest()}")
    print(f"Rows: {len(ship)}; first: {ship[0][0]}; last: {ship[-1][0]}")
    print(result)


if __name__ == "__main__":
    main()
