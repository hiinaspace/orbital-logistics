"""Independent normalized rotating circular-restricted three-body equations."""

from scipy.integrate import solve_ivp


def rhs(t, y, m):
    x, yy, z, vx, vy, vz = y
    r1 = ((x + m) ** 2 + yy**2 + z**2) ** 1.5
    r2 = ((x - 1 + m) ** 2 + yy**2 + z**2) ** 1.5
    return [
        vx,
        vy,
        vz,
        2 * vy + x - (1 - m) * (x + m) / r1 - m * (x - 1 + m) / r2,
        -2 * vx + yy - (1 - m) * yy / r1 - m * yy / r2,
        -(1 - m) * z / r1 - m * z / r2,
    ]


def propagate(y, t, m, dense=False):
    return solve_ivp(
        lambda t, y: rhs(t, y, m),
        [0, t],
        y,
        method="DOP853",
        rtol=2e-13,
        atol=2e-14,
        max_step=0.025,
        dense_output=dense,
    )
