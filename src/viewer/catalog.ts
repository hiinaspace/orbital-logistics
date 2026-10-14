/** Metadata only: reading the library must not import a simulation or fixture. */
export const catalog = [
  {
    id: "aster-selene-system",
    description:
      "A busy corridor between Aster and its moon. Boosters return home, landers descend to Selene, and relay ships keep supplies moving around the system.",
    links: [
      {
        label: "Lunar orbit rendezvous",
        url: "https://en.wikipedia.org/wiki/Lunar_orbit_rendezvous",
      },
      {
        label: "Free-return trajectory",
        url: "https://en.wikipedia.org/wiki/Free-return_trajectory",
      },
    ],
    family: "Aster–Selene",
    title: "Full service",
    summary: "Staged expeditions, lunar landers and relay traffic.",
    continuous: true,
  },
  {
    id: "aster-selene-cycler-fleet-service",
    description:
      "Carriers loop past Aster and Selene while smaller riders ferry freight between them and the ground. Watch a rider wait in parking orbit, catch a passing carrier, and leave it at the other world.",
    links: [
      {
        label: "Lunar cycler",
        url: "https://en.wikipedia.org/wiki/Lunar_cycler",
      },
      {
        label: "Parking orbit",
        url: "https://en.wikipedia.org/wiki/Parking_orbit",
      },
    ],
    family: "Aster–Selene",
    title: "Cycler fleet",
    summary: "Ballistic carriers and riders between two worlds.",
    continuous: true,
  },
  {
    id: "selene-ground-service",
    description:
      "A shuttle links a northern landing pad on Selene with an inclined orbital depot. The Aster–Selene rotating frame reveals how each trip threads through the moving system.",
    links: [
      {
        label: "Orbital inclination",
        url: "https://en.wikipedia.org/wiki/Orbital_inclination",
      },
      {
        label: "Orbital rendezvous",
        url: "https://en.wikipedia.org/wiki/Space_rendezvous",
      },
    ],
    family: "Aster–Selene",
    title: "Lunar ground service",
    summary: "A northern pad and an inclined lunar depot.",
    continuous: true,
  },
  {
    id: "lunar-loop",
    description:
      "A small spacecraft traces a distant retrograde orbit around Selene. Switch to the rotating frame to see a looping path that stays near the moon without circling it in the usual way.",
    links: [
      {
        label: "Distant retrograde orbit",
        url: "https://en.wikipedia.org/wiki/Distant_retrograde_orbit",
      },
    ],
    family: "Aster–Selene",
    title: "Lunar loop",
    summary: "A quiet distant retrograde orbit.",
    continuous: false,
  },
  {
    id: "aster-northern-launch",
    description:
      "A rocket rises from a northern pad on Aster, separates its booster, and delivers its upper stage to orbit. Follow the stages back through the atmosphere to ocean recovery.",
    links: [
      {
        label: "Multistage rocket",
        url: "https://en.wikipedia.org/wiki/Multistage_rocket",
      },
      {
        label: "Atmospheric entry",
        url: "https://en.wikipedia.org/wiki/Atmospheric_entry",
      },
    ],
    family: "Aster–Selene",
    title: "Northern launch",
    summary: "Atmospheric ascent, staging and ocean recovery.",
    continuous: false,
  },
  {
    id: "orison-freight-district",
    description:
      "Ground shuttles feed an orbital hub while freighters carry cargo among neighboring stations. Follow a single ship or pull back to watch the whole district at work.",
    links: [
      {
        label: "Hohmann transfer orbit",
        url: "https://en.wikipedia.org/wiki/Hohmann_transfer_orbit",
      },
      { label: "Spaceport", url: "https://en.wikipedia.org/wiki/Spaceport" },
    ],
    family: "Orison",
    title: "Freight district",
    summary: "Surface feeders and neighboring orbital routes.",
    continuous: true,
  },
  {
    id: "orison-relay-network",
    description:
      "Two freighters visit relays around Orison. The relays make small corrections to hold their orbits while the ships time their departures to meet them.",
    links: [
      {
        label: "Orbital station-keeping",
        url: "https://en.wikipedia.org/wiki/Orbital_station-keeping",
      },
      {
        label: "Orbital rendezvous",
        url: "https://en.wikipedia.org/wiki/Space_rendezvous",
      },
    ],
    family: "Orison",
    title: "Relay network",
    summary: "Two maintained relays under lunar perturbations.",
    continuous: true,
  },
  {
    id: "orison-steered",
    description:
      "A freighter leaves one orbital plane to meet an inclined depot. The front and side views reveal the climb out of the equatorial plane and the gentle turn into the new orbit.",
    links: [
      {
        label: "Orbital plane change",
        url: "https://en.wikipedia.org/wiki/Orbital_inclination_change",
      },
    ],
    family: "Orison",
    title: "Inclined transfer",
    summary: "A smooth transfer between orbital planes.",
    continuous: false,
  },
  {
    id: "helion-orison-observatory-mission",
    description:
      "A Webb-inspired observatory launches from Orison and travels outward to a halo orbit near L2. In the rotating frame, its distant orbit becomes a quiet loop beyond the planet.",
    links: [
      { label: "Halo orbit", url: "https://en.wikipedia.org/wiki/Halo_orbit" },
      {
        label: "James Webb Space Telescope",
        url: "https://en.wikipedia.org/wiki/James_Webb_Space_Telescope",
      },
    ],
    family: "Helion–Orison",
    title: "Observatory mission",
    summary: "A Webb-inspired launch and halo insertion.",
    continuous: false,
  },
  {
    id: "helion-orison-survey",
    description:
      "An observatory weaves a three-dimensional Lissajous figure near Orison’s L2 point. Longer trails reveal the changing pattern; paired top and front views show its depth.",
    links: [
      {
        label: "Lissajous orbit",
        url: "https://en.wikipedia.org/wiki/Lissajous_orbit",
      },
      {
        label: "Lagrange point",
        url: "https://en.wikipedia.org/wiki/Lagrange_point",
      },
    ],
    family: "Helion–Orison",
    title: "Continuous survey",
    summary: "A maintained Lissajous figure around L2.",
    continuous: true,
  },
  {
    id: "solar-cycler",
    description:
      "Wayfarer cruises between Aster and Ember beneath the yellow sun Helion. Small ferries meet the carrier during planetary encounters, with the giant Brontes farther out. Inspired by proposed Mars cyclers.",
    links: [
      {
        label: "Mars cycler",
        url: "https://en.wikipedia.org/wiki/Mars_cycler",
      },
      {
        label: "Gravity assist",
        url: "https://en.wikipedia.org/wiki/Gravity_assist",
      },
    ],
    family: "Helion system",
    title: "Interplanetary cycler",
    summary: "Long-haul carriers and planetary encounters.",
    continuous: false,
  },
] as const;
export type ExhibitId = (typeof catalog)[number]["id"];
export const defaultExhibit: ExhibitId = "aster-selene-cycler-fleet-service";
