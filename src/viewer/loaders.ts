import type { ExhibitId } from "./catalog";
const loaders = {
  "aster-selene-system": () =>
    import("../../fixtures/model-sets/aster-selene-system.json"),
  "aster-selene-cycler-fleet-service": async () => ({
    default: {
      ...(
        await import(
          "../../fixtures/model-sets/aster-selene-cycler-fleet-service.json"
        )
      ).default,
      artifactUrl: new URL(
        "../../fixtures/model-sets/recurring-cycler-profile.json",
        import.meta.url,
      ).href,
    },
  }),
  "selene-ground-service": () =>
    import("../../fixtures/traffic/selene-ground-service.json"),
  "lunar-loop": () => import("../../fixtures/model-sets/lunar-loop.json"),
  "aster-northern-launch": () =>
    import("../../fixtures/model-sets/aster-northern-launch.json"),
  "orison-freight-district": () =>
    import("../../fixtures/traffic/orison-freight-district.json"),
  "orison-relay-network": () =>
    import("../../fixtures/traffic/orison-relay-network.json"),
  "orison-steered": () =>
    import("../../fixtures/model-sets/orison-steered.json"),
  "helion-orison-observatory-mission": () =>
    import("../../fixtures/model-sets/observatory-mission.json"),
  "helion-orison-survey": () =>
    import("../../fixtures/model-sets/libration-survey.json"),
  "solar-cycler": async () => ({
    default: {
      ...(await import("../../fixtures/model-sets/solar-cycler-set.json"))
        .default,
      artifactUrl: new URL(
        "../../fixtures/model-sets/solar-cycler.json",
        import.meta.url,
      ).href,
    },
  }),
} satisfies Record<ExhibitId, () => Promise<{ default: unknown }>>;
export async function loadExhibit(id: ExhibitId) {
  return (await loaders[id]()).default;
}
