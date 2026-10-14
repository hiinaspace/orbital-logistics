import type { SceneView } from "../model-set/model";
/** Exhibit skin only. Physical identities, radii, ephemerides and cached flights
 * remain unchanged; references always use the original IDs. */
const solarNames: Readonly<Record<string, string>> = {
  Sun: "Helion",
  Earth: "Aster",
  Moon: "Selene",
  Mars: "Ember",
  Jupiter: "Brontes",
};
export function displayText(run: SceneView, text: string): string {
  const clean = text.replace(/\s*[·–—-]\s*(?:powered\s+)?cycler\b/gi, "");
  if (run.world.bodies.some((b) => b.id === "primary"))
    return clean
      .replace(/\bPlanet\b/g, run.id.startsWith("orison") ? "Orison" : "Aster")
      .replace(/\bmoon\b/g, "Selene");
  return run.solar
    ? clean.replace(
        /\b(Sun|Earth|Moon|Mars|Jupiter)\b/g,
        (name) => solarNames[name],
      )
    : clean;
}
export function displayName(run: SceneView, id: string): string {
  const name = run.vessels.find((v) => v.id === id)?.name ?? id;
  if (id === "primary") return run.id.startsWith("orison") ? "Orison" : "Aster";
  if (id === "moon") return "Selene";
  return displayText(run, name);
}
export function bodyDisplayRadius(
  run: SceneView,
  id: string,
  radius: number,
  scale: number,
): number {
  return Math.max(
    run.solar ? (id === "Sun" ? 22 : id === "Jupiter" ? 13 : 7) : 7,
    radius * scale,
  );
}
