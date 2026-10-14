/** Metadata only: reading the library must not import a simulation or fixture. */
export const catalog = [
  {
    id: "aster-selene-system",
    family: "Aster–Selene",
    title: "Full service",
    summary: "Staged expeditions, lunar landers and relay traffic.",
    continuous: true,
  },
  {
    id: "aster-selene-cycler-fleet-service",
    family: "Aster–Selene",
    title: "Cycler fleet",
    summary: "Ballistic carriers and riders between two worlds.",
    continuous: true,
  },
  {
    id: "selene-ground-service",
    family: "Aster–Selene",
    title: "Lunar ground service",
    summary: "A northern pad and an inclined lunar depot.",
    continuous: true,
  },
  {
    id: "lunar-loop",
    family: "Aster–Selene",
    title: "Lunar loop",
    summary: "A quiet distant retrograde orbit.",
    continuous: false,
  },
  {
    id: "aster-northern-launch",
    family: "Aster–Selene",
    title: "Northern launch",
    summary: "Atmospheric ascent, staging and ocean recovery.",
    continuous: false,
  },
  {
    id: "orison-freight-district",
    family: "Orison",
    title: "Freight district",
    summary: "Surface feeders and neighboring orbital routes.",
    continuous: true,
  },
  {
    id: "orison-relay-network",
    family: "Orison",
    title: "Relay network",
    summary: "Two maintained relays under lunar perturbations.",
    continuous: true,
  },
  {
    id: "orison-steered",
    family: "Orison",
    title: "Inclined transfer",
    summary: "A smooth transfer between orbital planes.",
    continuous: false,
  },
  {
    id: "helion-orison-observatory-mission",
    family: "Helion–Orison",
    title: "Observatory mission",
    summary: "A Webb-inspired launch and halo insertion.",
    continuous: false,
  },
  {
    id: "helion-orison-survey",
    family: "Helion–Orison",
    title: "Continuous survey",
    summary: "A maintained Lissajous figure around L2.",
    continuous: true,
  },
  {
    id: "solar-cycler",
    family: "Sol",
    title: "Mars cycler",
    summary: "Long-haul carriers and planetary encounters.",
    continuous: false,
  },
] as const;
export type ExhibitId = (typeof catalog)[number]["id"];
export const defaultExhibit: ExhibitId = "aster-selene-cycler-fleet-service";
