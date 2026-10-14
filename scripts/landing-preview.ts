/** Offline-only: freeze a tiny drawing clip from the admitted cycler exhibit.
 * No solver, resource engine or numerical implementation ships with the hero. */
import { readFileSync, writeFileSync } from "node:fs";
import { prepareRecurringFleet } from "../src/cycler/fleet";
import { samplePassThrough } from "../src/cycler/query";
import type { RecurringFleetProfile } from "../src/cycler/types";
const profile = JSON.parse(
  readFileSync("fixtures/model-sets/recurring-cycler-profile.json", "utf8"),
) as RecurringFleetProfile;
const template = prepareRecurringFleet(profile);
const count = 480;
const ships = template.hardware.slice(0, 2).map((ship, actor) => ({
  name: ship.name,
  color: ship.color,
  points: Array.from({ length: count + 1 }, (_, i) => {
    const t = (template.duration * i) / count,
      y = samplePassThrough({ template, actor }, t).y,
      c = Math.cos(template.rate * t),
      s = Math.sin(template.rate * t);
    return [c * y[0] + s * y[1], -s * y[0] + c * y[1]].map((x) =>
      Number(x.toFixed(4)),
    );
  }),
}));
for (const ship of ships)
  if (
    Math.hypot(...ship.points[0].map((x, i) => x - ship.points.at(-1)![i])) >
    2e-4
  )
    throw Error("Hero clip seam");
const data = {
  source: "aster-selene-cycler-fleet-service",
  duration: template.duration,
  ships,
};
writeFileSync("src/landing/preview.json", JSON.stringify(data) + "\n");
const project = (p: number[]) => [450 + p[0] * 34, 300 - p[1] * 34];
const paths = ships
  .map(
    (ship) =>
      `<path d="${ship.points
        .map(
          (p, i) =>
            `${i ? "L" : "M"}${project(p)
              .map((v) => v.toFixed(1))
              .join(" ")}`,
        )
        .join(
          "",
        )}" fill="none" stroke="${ship.color}" stroke-opacity=".28" stroke-width="1.2"/>`,
  )
  .join("");
const dots = ships
  .map((ship) => {
    const [x, y] = project(ship.points[0]);
    return `<circle cx="${x}" cy="${y}" r="4" fill="${ship.color}"/>`;
  })
  .join("");
writeFileSync(
  "public/orbital-preview.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><rect width="900" height="600" fill="#0c141d"/>${paths}<circle cx="450" cy="300" r="34" fill="#192a37" stroke="#61747b"/><circle cx="620" cy="300" r="9" fill="#192a37" stroke="#82908d"/><g fill="#a5b4b4" font-family="sans-serif" font-size="12"><text x="414" y="354">Aster</text><text x="601" y="329">Selene</text></g>${dots}</svg>\n`,
);
console.log({
  samples: count + 1,
  ships: ships.length,
  bytes: Buffer.byteLength(JSON.stringify(data)),
  canonicalWork: template.work,
});
