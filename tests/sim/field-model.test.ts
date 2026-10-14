import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sceneField,
  fieldPoint,
  fieldCoordinates,
} from "../../src/view/field-model";
import { potential, sampleField } from "../../src/view/potential-field";
import { bodyState } from "../../src/sim/dynamics";
import type { Body } from "../../src/sim/schema";
const circular = (
  id: string,
  mu: number,
  radius: number,
  orbitalRadius: number,
  rate: number,
  phase = 0,
): Body => ({
  id,
  mu,
  radius,
  rail: {
    kind: "circular",
    center: [0, 0, 0],
    u: [1, 0, 0],
    v: [0, 1, 0],
    radius: orbitalRadius,
    rate,
    phase,
  },
});
const primary: Body = {
  id: "Aster",
  mu: 3,
  radius: 0.3,
  rail: { kind: "fixed", position: [0, 0, 0] },
};
for (const bodies of [
  [primary],
  [primary, circular("Selene", 0.02, 0.08, 6, 0.16, 0.4)],
  [
    circular("Helion", 1, 0.05, 0.02, 1, Math.PI),
    circular("Orison", 0.02, 0.02, 1, 1),
  ],
])
  test(`normalized potential matches all physical sources (${bodies.map((b) => b.id).join(", ")})`, () => {
    const model = sceneField({
      world: {
        bodies,
        ports: [],
        units: { length: "R", time: "t", mass: "m" },
      },
      extent: 8,
    })!;
    assert.ok(model);
    for (const t of [0, 0.7, 19])
      for (const q of [
        [2, 2, 0],
        [-3, 1, 0],
        [5, 0.4, 0],
      ]) {
        const world = fieldPoint(model, q, t),
          roundtrip = fieldCoordinates(model, world, t);
        assert.ok(roundtrip.every((v, i) => Math.abs(v - q[i]) < 1e-12));
        const actual = -bodies.reduce((sum, b) => {
          const s = bodyState(b, t);
          return (
            sum +
            b.mu / Math.hypot(world[0] - s[0], world[1] - s[1], world[2] - s[2])
          );
        }, 0);
        assert.ok(
          Math.abs(
            potential(q[0], q[1], model.sources) * model.potentialScale -
              actual,
          ) < 1e-12,
        );
        // The field gradient is the gravitational acceleration in the plane.
        for (const i of [0, 1]) {
          const h = 1e-5,
            a = [...q],
            b = [...q];
          a[i] += h;
          b[i] -= h;
          const grad =
            ((-(
              potential(a[0], a[1], model.sources) -
              potential(b[0], b[1], model.sources)
            ) /
              (2 * h)) *
              model.potentialScale) /
            model.length;
          const axis = fieldPoint(model, i === 0 ? [1, 0, 0] : [0, 1, 0], t),
            origin = fieldPoint(model, [0, 0, 0], t);
          const g = bodies.reduce((sum, source) => {
            const p = bodyState(source, t),
              d = p.slice(0, 3).map((v, j) => v - world[j]),
              r = Math.hypot(...d);
            return (
              sum +
              (source.mu *
                d.reduce(
                  (s, v, j) => s + (v * (axis[j] - origin[j])) / model.length,
                  0,
                )) /
                r ** 3
            );
          }, 0);
          assert.ok(Math.abs(grad - g) < 1e-7);
        }
      }
    const grid = sampleField({
      id: 1,
      bounds: { x: -12, y: -12, span: 24 },
      size: 64,
      sources: model.sources,
    });
    assert.ok(grid.segments.length > 0);
  });
test("field capability rejects time-varying or nonplanar source patterns", () => {
  const world = (bodies: Body[]) => ({
    world: { bodies, ports: [], units: { length: "R", time: "t", mass: "m" } },
    extent: 8,
  });
  const moon = circular("Selene", 0.02, 0.08, 6, 0.16);
  assert.equal(
    sceneField({ ...world([primary, moon]), solar: {} as any }),
    undefined,
  );
  assert.equal(
    sceneField(
      world([
        primary,
        {
          ...moon,
          rail: { ...moon.rail, kind: "fixed", position: [1, 0, 0.1] },
        } as Body,
      ]),
    ),
    undefined,
  );
  assert.equal(
    sceneField(world([moon, circular("Other", 0.01, 0.05, 2, 0.3)])),
    undefined,
  );
  const bad = structuredClone(moon);
  if (bad.rail.kind === "circular") bad.rail.v = [0, 0, 1];
  assert.equal(sceneField(world([primary, bad])), undefined);
  assert.throws(() =>
    sampleField({
      id: 1,
      bounds: { x: 0, y: 0, span: 2 },
      size: 16,
      sources: [],
    }),
  );
  assert.throws(() =>
    sampleField({
      id: 1,
      bounds: { x: 0, y: 0, span: 2 },
      size: 16,
      sources: [{ x: 0, y: 0, mu: NaN, radius: 1 }],
    }),
  );
});
