"""Research trace of the independent full-graph oracle; no production edits."""

import sys
from pathlib import Path

source = Path("spikes/numerics/staged_apollo_oracle.py").read_text()
source = source.replace(
    "    return z\n\n\ndef capture",
    '    print("TRACE",part,end,z.tolist(),flush=True)\n    return z\n\n\ndef capture',
)
source = source.replace(
    "docs/evidence/staged-apollo-oracle-",
    "docs/design/staged-apollo/oracle-trace-result-",
)
source = source.replace('assert result["passed"], result', "")
if "--coarse" in sys.argv:
    source = source.replace(
        "0.0005 if air else 0.001 if arc else 0.02",
        "0.02",
    )
    source = source.replace("rtol=3e-14", "rtol=3e-13")
    source = source.replace("atol=3e-15", "atol=3e-14")
sys.argv = [sys.argv[0], "0"]
exec(compile(source, "staged_apollo_oracle_instrumented", "exec"))  # noqa: S102 -- instrument trusted local oracle only
