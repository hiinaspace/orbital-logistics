import { passThroughResources } from "../cycler/view";
import { transform } from "../model-set/frames";
import {
  isPresent,
  orbitError,
  portsOf,
  presenceLabel,
  stockAt,
  type SetEvent,
  type VesselView,
} from "../model-set/model";
import { AU_KM, YEAR_SECONDS } from "../solar/ephemeris";
import { surfaceDuration } from "../surface-flexible/contracts";
import {
  maximumPlaybackRate,
  speedAtPosition,
  speedPosition,
} from "../traffic/playback";
import { viewerProfile } from "../view/profile";
import { rocketAxis } from "../view/rocket";
import { catalog, defaultExhibit, type ExhibitId } from "./catalog";
import { viewportControls } from "./controls";
import { createSceneSession } from "./session";
import { esc, sampleVessel } from "./shared";
import { createViewport, type Viewport } from "./viewport";
/** Mount owns one session and every foreground resource. Safe to dispose before
 * a pending fixture/worker reply, so a later landing page can leave the viewer. */
export function mountWorkspace(host: HTMLElement) {
  const lifetime = new AbortController();
  let disposed = false,
    animation = 0;
  const number = (v: number) => v.toFixed(2);
  let active: Viewport;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    (host.querySelector("#" + id) ??
      active?.root.querySelector('[data-control="' + id + '"]'))! as T;
  function html(id: string, value: string) {
    const root = $(id);
    if (root.innerHTML === value) return;
    if (id === "fleet" || id === "stations") {
      const template = document.createElement("template");
      template.innerHTML = value;
      const existing = new Map(
        [...root.querySelectorAll<HTMLButtonElement>("[data-object]")].map(
          (e) => [e.dataset.object!, e],
        ),
      );
      for (const next of template.content.querySelectorAll<HTMLButtonElement>(
        "[data-object]",
      )) {
        const old = existing.get(next.dataset.object!);
        if (old) {
          existing.delete(next.dataset.object!);
          old.className = next.className;
          if (old.innerHTML !== next.innerHTML) old.innerHTML = next.innerHTML;
        } else root.append(next);
      }
      for (const old of existing.values()) old.remove();
    } else root.innerHTML = value;
  }
  host.innerHTML = `<main class="shell">
<header><button id="library-toggle" aria-label="Toggle set library" aria-expanded="true">Sets</button><h1>Orbital Logistics</h1><span id="set-title"></span><span id="load-status" role="status"></span>
<select id="layout" aria-label="View layout"><option value="single">Single view</option><option value="custom" hidden>Custom split</option><option value="overview">Overview + Chase</option><option value="frames">Inertial + Rotating</option><option value="axes">Top + Front</option></select><button id="split-direction" aria-label="Stack views" title="Stack views">↕</button><button id="duplicate" title="Duplicate active view">Split</button><button id="inspector-toggle" aria-label="Toggle inspector" aria-expanded="true">Inspector</button></header>
<div class="workspace"><nav class="library" aria-label="Set library"><h2>Sets</h2><input id="set-search" type="search" placeholder="Find a set" aria-label="Find a set"><div id="catalog"></div></nav><div id="viewports" class="viewports"></div>
<aside><div class="section-heading"><h2 id="inspector-pane">View 1</h2></div><div class="section-heading"><h2>Traffic</h2><span id="traffic-count"></span></div><div id="fleet"></div><div class="section-heading" id="station-heading"><h2>Stations</h2></div><div id="stations"></div><section id="inspector"></section><details id="model-details"><summary>About this set</summary><p id="description"></p><p id="provenance"></p></details></aside></div>
<section class="player" aria-label="Playback"><div id="timeline-resize" tabindex="0" role="separator" aria-label="Timeline height" aria-orientation="horizontal"></div><div class="ruler-row"><button id="collapse-timeline" aria-expanded="true">Activity ▾</button><div id="ruler" tabindex="0" role="slider" aria-label="Simulation time"><div id="ticks"></div><span class="time-cursor"></span><output id="hover-time" hidden></output></div></div><div id="timelines" aria-label="Ship activity timelines"></div>
<div class="transport"><button id="restart" title="Rewind">↤</button><button id="play" disabled>Play</button><output id="clock">0.00</output><label class="speed-control"><span class="speed-track"><input id="speed" type="range" min="-1" max="1" step="0.0001" value="0" title="Reverse ← · 0× pause · → Forward" aria-label="Playback speed"></span><output id="speed-value">1×</output></label><button id="live" hidden>Live</button><label class="replay"><input type="checkbox" id="replay">Replay</label></div></section></main><pre id="state-json" hidden></pre>`;
  const panes: Viewport[] = [];
  let activeId = 0,
    nextId = 1,
    publicationDirty = false,
    inspectorKey = "",
    lastPanel = 0,
    maximized: Viewport | undefined;
  const session = createSceneSession((kind) => {
    if (kind === "loading") {
      seeking = undefined;
      $("hover-time").hidden = true;
      for (const pane of panes) pane.reset();
      $("load-status").textContent = "Preparing scene…";
      $<HTMLButtonElement>("play").disabled = true;
      $("inspector").innerHTML = "";
      $("fleet").innerHTML = "";
      $("stations").innerHTML = "";
      $("timelines").innerHTML = "";
      $("ticks").innerHTML = "";
      inspectorKey = "";
      publishState();
    } else if (kind === "ready") {
      for (const pane of panes) pane.reset();
      if (panes.length === 2) applyPreset($<HTMLSelectElement>("layout").value);
      $("description").textContent = session.run!.description;
      $("provenance").textContent = session.run!.provenance;
      publicationDirty = true;
      $<HTMLButtonElement>("play").disabled = false;
      syncSpeed();
      updatePanels();
    } else if (kind === "publication") {
      publicationDirty = true;
    } else {
      syncSpeed();
      if (session.ready) updatePanels();
      else $("load-status").textContent = session.liveError;
    }
  });
  function quality() {
    const pixels = panes
      .filter((p) => !p.root.hidden)
      .reduce((sum, p) => {
        const r = p.canvas.getBoundingClientRect();
        return sum + r.width * r.height;
      }, 0);
    return Math.min(
      devicePixelRatio || 1,
      2,
      Math.sqrt(8300000 / Math.max(1, pixels)),
    );
  }
  function activate(pane: Viewport) {
    if (active === pane) return;
    active = pane;
    activeId = Number(pane.root.dataset.pane);
    for (const p of panes) p.root.classList.toggle("active", p === pane);
    $("inspector-pane").textContent = "View " + activeId;
    inspectorKey = "";
    if (session.ready) updatePanels();
  }
  function addPane(copy?: Viewport) {
    if (panes.length >= 2) return;
    const root = document.createElement("section");
    root.className = "scene";
    root.dataset.pane = String(nextId++);
    root.setAttribute("aria-label", "View " + root.dataset.pane);
    root.innerHTML = viewportControls;
    $("viewports").append(root);
    let pane: Viewport;
    pane = createViewport(root, session, {
      activate: () => activate(pane),
      changed: () => {
        if (active === pane && session.ready) updatePanels();
      },
      play: () => session.togglePlay(),
      quality,
    });
    panes.push(pane);
    if (session.ready) pane.reset();
    if (copy) pane.copyFrom(copy);
    root.querySelector<HTMLElement>('[data-control="close"]')!.onclick = () =>
      removePane(pane);
    root.querySelector<HTMLElement>('[data-control="maximize"]')!.onclick =
      () => {
        maximized = maximized === pane ? undefined : pane;
        updateLayout();
      };
    activate(pane);
    updateLayout();
    return pane;
  }
  function removePane(pane: Viewport) {
    if (panes.length < 2) return;
    const i = panes.indexOf(pane);
    panes.splice(i, 1);
    pane.dispose();
    maximized = undefined;
    if (active === pane) activate(panes[0]);
    $<HTMLSelectElement>("layout").value = "single";
    updateLayout();
  }
  function updateLayout() {
    const container = $("viewports");
    container.classList.toggle("split", panes.length === 2 && !maximized);
    for (const p of panes) {
      p.root.hidden = !!maximized && p !== maximized;
      if (p.root.hidden) p.suspend();
      p.root.querySelector<HTMLButtonElement>(
        '[data-control="close"]',
      )!.hidden = panes.length < 2;
      p.root
        .querySelector('[data-control="maximize"]')!
        .setAttribute(
          "aria-label",
          maximized === p ? "Restore views" : "Maximize view",
        );
    }
    let divider = $("pane-divider");
    if (panes.length === 2 && !maximized) {
      if (!divider) {
        divider = document.createElement("div");
        divider.id = "pane-divider";
        divider.tabIndex = 0;
        divider.setAttribute("role", "separator");
        divider.setAttribute("aria-label", "Resize views");
        container.insertBefore(divider, panes[1].root);
        bindDivider(divider);
      }
    } else divider?.remove();
    requestAnimationFrame(() => {
      if (!disposed) panes.forEach((p) => p.resize());
    });
  }
  function applyPreset(preset: string) {
    if (preset === "single") {
      if (panes.length === 2) removePane(panes[1]);
      return;
    }
    const first = panes[0],
      second = panes[1] ?? addPane(first)!;
    maximized = undefined;
    updateLayout();
    // Read the committed split geometry before explicit preset fitting.
    for (const pane of panes) pane.resize();
    if (!session.ready) return;
    if (preset === "overview") {
      first.track("off");
      first.frame = "inertial";
      first.setCamera("top");
      first.fit();
      second.frame = "inertial";
      second.track("chase");
      second.camera.scale = first.camera.scale * 4;
    }
    if (preset === "frames") {
      first.track("off");
      second.track("off");
      first.frame = "inertial";
      second.frame = session.run!.binary ? "libration" : "rotating";
      first.fit();
      second.fit();
    }
    if (preset === "axes") {
      const frame = active.frame;
      first.track("off");
      second.track("off");
      first.frame = second.frame = frame;
      first.setCamera("top");
      second.setCamera("front");
      first.fit();
      second.fit();
    }
    activate(first);
  }
  function bindDivider(divider: HTMLElement) {
    const set = (value: number) => {
      $("viewports").style.setProperty(
        "--split",
        Math.max(20, Math.min(80, value)) + "%",
      );
      divider.setAttribute("aria-valuenow", String(Math.round(value)));
    };
    const at = (e: PointerEvent) => {
      const r = $("viewports").getBoundingClientRect();
      set(
        $("viewports").classList.contains("stacked")
          ? (100 * (e.clientY - r.top)) / r.height
          : (100 * (e.clientX - r.left)) / r.width,
      );
    };
    divider.onpointerdown = (e) => {
      e.preventDefault();
      divider.setPointerCapture(e.pointerId);
      at(e);
    };
    divider.onpointermove = (e) => {
      if (divider.hasPointerCapture(e.pointerId)) at(e);
    };
    divider.onpointerup = (e) => {
      if (divider.hasPointerCapture(e.pointerId))
        divider.releasePointerCapture(e.pointerId);
    };
    divider.onkeydown = (e) => {
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(
          e.key,
        )
      ) {
        e.preventDefault();
        const current =
          parseFloat($("viewports").style.getPropertyValue("--split")) || 50;
        set(
          e.key === "Home"
            ? 50
            : current + (["ArrowRight", "ArrowDown"].includes(e.key) ? 5 : -5),
        );
      }
    };
    set(50);
  }
  addPane();
  function select(id: string) {
    active.select(id);
  }
  const budgetCursorTransform = () =>
    `translate(${4 + ((session.t - session.start()) / (session.end() - session.start())) * 232},0)`;
  function eventLabel(e: SetEvent): string {
    if ((session.run?.solar || session.run?.compact) && e.label) return e.label;
    const port = e.portId ?? "";
    if (e.kind === "burn" && e.id.includes("plane-change"))
      return "Plane change";
    if (e.kind === "separation") return e.label ?? "Stage separation";
    if (e.kind === "dock" && !e.portId) return e.label ?? "Orbiter rendezvous";
    if (e.kind === "entry") return "Atmospheric entry";
    if (e.kind === "splashdown") return "Ocean recovery";
    if (e.kind === "milestone") return e.label ?? e.id;
    if (e.kind === "handoff")
      return e.id.endsWith("ascent-exit") ? "Orbit insertion" : "Begin descent";
    if (e.kind === "land") return `Touchdown · ${port}`;
    if (e.kind === "dock") return `Dock ${port}`;
    if (e.kind === "launch") return `Lift off · ${port}`;
    if (e.kind === "undock") return `Depart ${port}`;
    if (e.kind === "transfer-start") return `Service ${port}`;
    if (e.kind === "transfer" && e.cargoAfter === e.cargoBefore)
      return `${e.propellantAfter < e.propellantBefore ? "Deliver fuel" : "Refuel"} · ${port}`;
    if (e.kind === "transfer")
      return `${e.cargoAfter! < e.cargoBefore! ? "Unload" : "Load"} freight · ${port}`;
    if (e.kind === "thrust-start") return "Begin thrust";
    if (e.kind === "thrust-end") return "End thrust";
    if (e.kind === "fuel-depleted") return "Fuel depleted";
    if (e.kind === "planning-failed") return "Waiting for transfer window";
    if (e.kind === "unavailable") return "Transfer unavailable";
    if (e.kind === "fault") return "Flight fault";
    return e.id.endsWith("capture") ? "Arrival burn" : "Departure burn";
  }
  function nextArrival(v: VesselView) {
    return session.events.find(
      (e) =>
        e.vessel === v.id &&
        e.t > session.t + 1e-9 &&
        (e.kind === "dock" || e.kind === "land" || e.kind === "splashdown"),
    );
  }
  function status(v: VesselView): string {
    if (!isPresent(v, session.t)) return presenceLabel(v, session.t);
    const s = sampleVessel(v, session.t),
      l = s.logistics;
    if (v.solar || v.compact) return s.activity?.reason ?? "Coasting";
    if (
      s.activity?.reason === "Ground recovery transport" ||
      s.activity?.reason === "Ocean recovery"
    )
      return s.activity.reason;
    if (s.entryPhase)
      return (
        {
          coast: "Approaching atmosphere",
          entry: "Atmospheric braking",
          braking: "Terminal braking",
          recovered: "Recovered · Ocean",
        } as const
      )[s.entryPhase];
    if (s.activity?.kind === "fault")
      return `Fault · last seen ${number(s.activity.knownEpoch!)}`;
    if (session.run?.maintained?.[v.id] || v.maintenance)
      return s.thrust?.force ? "Stationkeeping" : "Coasting";
    if (s.activity?.kind === "unavailable") return "Transfer unavailable";
    if (s.activity?.kind === "waiting" && s.activity.reason)
      return "Waiting for transfer window";
    if (l?.service && l.service.cargo === 0 && l.service.propellant !== 0)
      return `${l.service.propellant < 0 ? "Delivering fuel" : "Refueling"} · ${l.service.portId}`;
    if (l?.service)
      return `${l.service.cargo < 0 ? "Unloading" : "Loading"} · ${l.service.portId}`;
    if (l?.dockedPortId)
      return `${v.ports.find((p) => p.id === l.dockedPortId)?.rail.kind === "surface" ? "On pad" : "Docked"} · ${l.dockedPortId}`;
    if ((s.thrust?.force ?? 0) > 0)
      return (
        "Powered flight" +
        (nextArrival(v)?.portId ? " · " + nextArrival(v)!.portId : "")
      );
    const dock = nextArrival(v);
    return dock?.kind === "splashdown"
      ? `Returning · ${session.run!.world.bodies[0].id}`
      : dock?.portId
        ? `En route · ${dock.portId}`
        : "Free flight";
  }
  function buildTimeline() {
    const template = document.createElement("template");
    template.innerHTML = [
      ...Object.values(session.run!.maintained ?? {}),
      ...session.run!.vessels,
    ]
      .map((v) => {
        const maintenance =
          !!session.run!.maintained?.[v.id] || !!v.maintenance;
        const times = [
          ...new Set([
            axisStart(),
            axisEnd(),
            ...v.ledger
              .map((e) => e.t)
              .filter((epoch) => epoch > axisStart() && epoch < axisEnd()),
          ]),
        ].sort((a, b) => a - b);
        const blocks = times
          .slice(0, -1)
          .map((a, i) => {
            const b = times[i + 1];
            if (!isPresent(v, (a + b) / 2)) return "";
            const state = sampleVessel(v, (a + b) / 2),
              l = state.logistics,
              powered = (state.thrust?.force ?? 0) > 0;
            const fill = state.entryPhase
              ? state.entryPhase === "recovered"
                ? "#35434d"
                : powered
                  ? "#e9c485"
                  : state.entryPhase === "entry"
                    ? "#80c6ed"
                    : v.color
              : maintenance
                ? powered
                  ? "#85c9c0"
                  : "#35434d"
                : l?.service
                  ? "#e9c485"
                  : l?.dockedPortId
                    ? "#35434d"
                    : v.color;
            return `<rect x="${(1000 * (a - axisStart())) / (axisEnd() - axisStart())}" y="${maintenance ? (powered ? 7 : 9) : l?.service || powered ? 3 : 7}" width="${(1000 * (b - a)) / (axisEnd() - axisStart())}" height="${maintenance ? (powered ? 6 : 2) : l?.service || powered ? 14 : 6}" fill="${fill}" opacity="${maintenance ? (powered ? 0.55 : 0.4) : powered ? 0.95 : l?.dockedPortId && !l.service ? 0.8 : 0.65}"/>`;
          })
          .join("");
        const burns = v.ledger
          .filter((e) => e.kind === "burn" || e.kind === "separation")
          .map(
            (e) =>
              `<path d="M${(1000 * (e.t - axisStart())) / (axisEnd() - axisStart())} 4v12" stroke="${v.color}" stroke-width="1"/>`,
          )
          .join("");
        return `<div class="timeline-row ${active.selected === v.id ? "selected" : ""}" data-vessel="${esc(v.id)}"><button class="timeline-name" data-select="${esc(v.id)}" style="color:${v.color}" title="${esc(v.name)}">${esc(v.name)}</button><div class="timeline-track"><svg viewBox="0 0 1000 20" preserveAspectRatio="none" aria-label="${esc(v.name)} ${maintenance ? "stationkeeping; small teal spans are corrections" : "activity; colored spans are flight, gold is cargo service"}">${blocks}${burns}</svg>${session.traffic ? `<span class="future-region" style="left:${Math.min(100, (100 * (session.traffic.frontier - axisStart())) / (axisEnd() - axisStart()))}%" title="Planned"></span><span class="frontier-cursor" style="left:${Math.min(100, (100 * (session.traffic.frontier - axisStart())) / (axisEnd() - axisStart()))}%" title="Simulation head"></span>` : ""}<span class="time-cursor"></span><button class="timeline-seek" aria-label="Scrub ${esc(v.name)} timeline"></button></div></div>`;
      })
      .join("");
    // Keep interactive rows/buttons alive while forecast spans change. Replacing
    // the whole lane between pointer-down and click loses focus and hover state.
    const lanes = $("timelines");
    const existing = new Map(
      Array.from(lanes.querySelectorAll<HTMLElement>(".timeline-row")).map(
        (r) => [r.dataset.vessel!, r],
      ),
    );
    for (const incoming of template.content.querySelectorAll<HTMLElement>(
      ".timeline-row",
    )) {
      const row = existing.get(incoming.dataset.vessel!);
      existing.delete(incoming.dataset.vessel!);
      if (!row) {
        lanes.append(incoming);
        continue;
      }
      row.className = incoming.className;
      const name = row.querySelector<HTMLElement>(".timeline-name")!,
        newName = incoming.querySelector<HTMLElement>(".timeline-name")!;
      name.textContent = newName.textContent;
      name.title = newName.title;
      name.style.cssText = newName.style.cssText;
      const svg = row.querySelector("svg")!,
        next = incoming.querySelector("svg")!;
      if (svg.innerHTML !== next.innerHTML) svg.innerHTML = next.innerHTML;
      for (const kind of ["future-region", "frontier-cursor"]) {
        const marker = row.querySelector<HTMLElement>(`.${kind}`),
          replacement = incoming.querySelector<HTMLElement>(`.${kind}`);
        if (marker && replacement)
          marker.style.cssText = replacement.style.cssText;
        else if (replacement)
          row.querySelector(".timeline-track")!.append(replacement);
        else marker?.remove();
      }
    }
    for (const row of existing.values()) row.remove();
    host
      .querySelectorAll<HTMLButtonElement>("[data-select]")
      .forEach((b) => (b.onclick = () => select(b.dataset.select!)));
    bindSeek();
  }
  function fuelChart(v: VesselView): string {
    return `<div class="chart-key"><span>Fuel</span>${session.run?.maintained?.[v.id] || v.cargoCapacity === 0 ? "" : "<span>Freight</span>"}</div>${fuelGraph(v)}`;
  }
  function fuelGraph(v: VesselView): string {
    const edges = new Map(v.boundaries.map((e) => [e.t, e.before]));
    const path = (
      get: (s: (typeof v.samples)[number]) => number,
      max: number,
    ) => {
      let last = -Infinity;
      const points = v.samples.filter((s, i) => {
        const keep =
          i === 0 ||
          i === v.samples.length - 1 ||
          edges.has(s.t) ||
          (get(s) !== get(v.samples[i - 1]) &&
            (!v.continuousFuel ||
              s.t - last >= (session.end() - session.start()) / 928));
        if (keep) last = s.t;
        return keep;
      });
      return points
        .map((s, i) => {
          const x =
              4 +
              ((s.t - session.start()) / (session.end() - session.start())) *
                232,
            y = 64 - Math.min(1, get(s) / Math.max(max, 1e-12)) * 54;
          const before = edges.get(s.t);
          if (i && v.continuousFuel && before) {
            const left =
              64 - Math.min(1, get(before) / Math.max(max, 1e-12)) * 54;
            return `L${x},${left}V${y}`;
          }
          return i
            ? v.continuousFuel
              ? `L${x},${y}`
              : `H${x}V${y}`
            : `M${x},${y}`;
        })
        .join(" ");
    };
    return `<svg class="budget-chart" data-start="${session.start()}" data-end="${session.end()}" viewBox="0 0 240 72" role="img" aria-label="Fuel and freight over the scene"><path d="M4 64H236" stroke="#33414b"/><path d="${path((s) => s.propellant, v.ship.tankCapacity)}" fill="none" stroke="#78c9c0" stroke-width="1.5"/><path d="${path((s) => s.logistics?.cargoMass ?? v.ship.cargoMass, v.cargoCapacity ?? 1)}" fill="none" stroke="#efb878" stroke-width="1.5"/><path class="budget-cursor" d="M0 5V66" transform="${budgetCursorTransform()}" stroke="#c7d5de" stroke-opacity="0.6"/></svg>`;
  }
  function updatePanels() {
    if (!session.run || !session.ready) return;
    $<HTMLButtonElement>("play").textContent = session.playing
      ? "Pause"
      : "Play";

    $("clock").textContent = session.run.solar
      ? `Day ${number(session.t * 365.25)}`
      : session.traffic
        ? `${number(session.t)} · head ${number(session.traffic.frontier)}`
        : `${number(session.t)} / ${number(session.end())}`;
    $("live").textContent = session.liveMode ? "Live" : "Return to live";
    $("live").setAttribute("aria-pressed", String(session.liveMode));
    $("load-status").textContent =
      session.liveError ||
      (session.traffic?.halt && session.t >= session.traffic.frontier
        ? session.traffic.halt
        : session.traffic
          ? session.liveMode
            ? ""
            : session.playing
              ? "Playing history"
              : "History held"
          : session.t === session.end()
            ? "End of scene"
            : "");
    $("traffic-count").textContent = String(
      session.run.vessels.filter((v) => isPresent(v, session.t)).length,
    );
    html(
      "fleet",
      session.run.vessels
        .map(
          (v) =>
            `<button class="object-row ${active.selected === v.id ? "selected" : ""}" data-object="${esc(v.id)}"><i style="background:${v.color}"></i><span><strong>${esc(v.name)}</strong><small>${esc(status(v))}</small></span></button>`,
        )
        .join(""),
    );
    const stocks = stockAt(session.run, session.t);
    $("station-heading").hidden = !session.run.stations.length;
    $("stations").hidden = !session.run.stations.length;
    html(
      "stations",
      session.run.stations.length
        ? session.run.stations
            .map((station) => {
              const stock = stocks.find((s) => s.id === station.id)!;
              return `<button class="object-row ${active.selected === station.id ? "selected" : ""}" data-object="${esc(station.id)}"><i class="station-dot"></i><span><strong>${esc(station.id)}</strong></span><span class="berths">${stock.occupied}/${station.berths}</span></button>`;
            })
            .join("")
        : "",
    );
    host
      .querySelectorAll<HTMLButtonElement>("[data-object]")
      .forEach((b) => (b.onclick = () => select(b.dataset.object!)));
    const v = active.vessel(),
      key = session.run.id + ":" + active.selected;
    $("launch-view").textContent =
      session.run.entry || (v?.entry && session.t >= (v.entry.activeFrom ?? 0))
        ? "Entry view"
        : "Surface view";
    if (key !== inspectorKey) {
      inspectorKey = key;
      const heading = v?.name ?? active.selected;
      $("inspector").innerHTML =
        `<div class="section-heading"><h2>${esc(heading)}</h2><button id="object-frame">View from here</button></div><p id="object-status"></p><dl id="readouts"></dl><button id="next-event" class="next-event"></button>${v ? fuelChart(v) : ""}<details id="schedule"><summary>Schedule</summary><div id="event-list"></div></details>`;
      $("object-frame").onclick = () => {
        active.frame = active.selected;
        $<HTMLSelectElement>("frame").value = active.frame;
        active.fit();
        updatePanels();
      };
    }
    let upcoming: SetEvent | undefined;
    if (v && !isPresent(v, session.t)) {
      $("object-status").textContent = presenceLabel(v, session.t);
      $("readouts").innerHTML = v.attachment
        ? `<div><dt>Propellant</dt><dd>${number(sampleVessel(v, session.t).propellant)} / ${number(v.ship.tankCapacity)}</dd></div><div><dt>Fuel used</dt><dd>${number(sampleVessel(v, session.t).fuelUsed ?? 0)}</dd></div>`
        : session.t < (v.lifetime?.start ?? -Infinity) &&
            v.id === session.run.staging?.separation.children[1]
          ? `<div><dt>Reserved propellant</dt><dd>${number(v.ship.propellant)}</dd></div>`
          : "";
      $<HTMLButtonElement>("object-frame").disabled = !v.attachment;
      upcoming = session.events.find(
        (e) => e.vessel === v.id && e.t > session.t,
      );
    } else if (v) {
      const s = sampleVessel(v, session.t),
        cargo = s.logistics?.cargoMass ?? v.ship.cargoMass;
      $("object-status").textContent = status(v);
      const maintenance = session.run.stations.find(
        (p) => p.id === active.selected,
      )?.maintenance;
      const used =
        (v.inheritedFuelUsed ?? 0) +
        (s.fuelUsed ??
          v.ledger
            .filter((e) => e.t <= session.t)
            .reduce((sum, e) => sum + e.fuelUsed, 0));
      $("readouts").innerHTML =
        `${v.cargoCapacity === 0 ? "" : `<div><dt>${esc(v.cargo)}</dt><dd>${number(cargo)} / ${number(v.cargoCapacity ?? cargo)}</dd></div>`}<div><dt>${v.id === session.run.staging?.separation.parentId ? "Booster propellant" : "Propellant"}</dt><dd>${number(s.propellant)} / ${number(v.ship.tankCapacity)}</dd></div><div><dt>Fuel used</dt><dd>${number(used)}</dd></div>`;
      if (v.id === session.run.staging?.separation.parentId)
        $("readouts").innerHTML +=
          `<div><dt>Carried payload fuel</dt><dd>${number(session.run.staging.separation.reservedPayloadFuel)}</dd></div>`;
      if (maintenance) {
        const err = orbitError(s.y, maintenance.reference),
          baseline = active.displayPortState(
            portsOf(session.run).find((p) => p.id === active.selected)!,
            {
              [active.selected]:
                session.run.maintained![active.selected].baseline,
            },
            s.activity?.knownEpoch ?? session.t,
          ),
          unmaintained = orbitError(baseline, maintenance.reference);
        $("readouts").innerHTML =
          `<div><dt>Maintenance fuel</dt><dd>${s.propellant.toFixed(4)} / ${number(v.ship.tankCapacity)}</dd></div><div><dt>Fuel used</dt><dd>${used.toFixed(4)}</dd></div><div><dt>Orbit error · R</dt><dd>${err.position.toExponential(2)}</dd></div><div><dt>Velocity error</dt><dd>${err.velocity.toExponential(2)}</dd></div><div><dt>Unmaintained error · R</dt><dd>${unmaintained.position.toExponential(2)}</dd></div>`;
      }
      if (v.solar)
        $("readouts").innerHTML +=
          `<div><dt>Thrust · kN</dt><dd>${number(((s.thrust?.force ?? 0) * AU_KM * 1000) / YEAR_SECONDS ** 2)}</dd></div><div><dt>Acceleration · m/s²</dt><dd>${(((s.thrust?.acceleration ?? 0) * AU_KM * 1000) / YEAR_SECONDS ** 2).toFixed(4)}</dd></div>`;
      else if (v.ship.engine)
        $("readouts").innerHTML +=
          `<div><dt>Thrust</dt><dd>${maintenance ? (s.thrust?.force ?? 0).toExponential(2) : number(s.thrust?.force ?? 0)} / ${number(v.surfaceEngine && v.surfaceFlights?.some((f) => session.t >= f.start && session.t < f.start + surfaceDuration) ? v.surfaceEngine.maxThrust : v.ship.engine.maxThrust)}</dd></div><div><dt>Thrust acceleration</dt><dd>${maintenance ? (s.thrust?.acceleration ?? 0).toExponential(2) : number(s.thrust?.acceleration ?? 0)}</dd></div>`;
      const aeroReadouts = !!(
        (v.entry || v.aerodynamics) &&
        ((s.aero?.density ?? 0) > 0 || s.entryPhase)
      );
      if (aeroReadouts) {
        const a = s.aero,
          body = active.surfaceReference(v),
          r = Math.hypot(
            ...s.y
              .slice(0, 3)
              .map((x, i) => x - active.bodyState(body, session.t)[i]),
          );
        const pressure = a?.dynamicPressure ?? 0,
          drag = Math.hypot(...(a?.drag ?? [0, 0, 0])),
          lift = Math.hypot(...(a?.lift ?? [0, 0, 0]));
        const load =
          Math.hypot(
            ...[0, 1, 2].map(
              (i) =>
                (a?.drag[i] ?? 0) +
                (a?.lift[i] ?? 0) +
                (s.thrust ? s.thrust.force * s.thrust.direction[i] : 0),
            ),
          ) / (s.mass ?? 1);
        $("readouts").innerHTML +=
          `<div><dt>Altitude · R</dt><dd>${(r - body.radius).toFixed(5)}</dd></div><div><dt>Air speed</dt><dd>${Math.hypot(...(a?.relativeVelocity ?? [0, 0, 0])).toFixed(4)}</dd></div><div><dt>Density</dt><dd>${(a?.density ?? 0).toExponential(2)}</dd></div><div><dt>Dynamic pressure</dt><dd>${pressure.toFixed(4)}</dd></div><div><dt>Lift / drag</dt><dd>${(drag > 0 ? lift / drag : 0).toFixed(3)}</dd></div><div><dt>Flight load</dt><dd>${load.toFixed(3)}</dd></div>${s.entryPhase === "recovered" ? `<div><dt>Recovery speed</dt><dd>${(session.run.recoveries?.[v.id] ?? session.run.entry!).relativeSpeed.toFixed(4)}</dd></div>` : ""}`;
      }
      if (v.ports.some((p) => p.rail.kind === "surface")) {
        const body = active.surfaceReference(v),
          b = active.bodyState(body, session.t),
          relative = s.y.slice(0, 3).map((v, i) => v - b[i]),
          velocity = s.y.slice(3).map((v, i) => v - b[i + 3]),
          r = Math.hypot(...relative),
          radial = relative.reduce((n, v, i) => n + v * velocity[i], 0) / r,
          tangential = Math.sqrt(
            Math.max(
              0,
              velocity.reduce((n, v) => n + v * v, 0) - radial * radial,
            ),
          );
        const small = (x: number) =>
          Math.abs(x) < 1e-12
            ? "0.0000"
            : Math.abs(x) < 0.001
              ? x.toExponential(2)
              : x.toFixed(4);
        const mass = s.mass ?? v.ship.dryMass + cargo + s.propellant;
        $("readouts").innerHTML +=
          `${aeroReadouts ? "" : `<div><dt>Altitude · R</dt><dd>${small((r - body.radius) / body.radius)}</dd></div>`}<div><dt>Radial speed</dt><dd>${small(radial)}</dd></div><div><dt>Tangential speed</dt><dd>${small(tangential)}</dd></div><div><dt>Thrust / weight</dt><dd>${number((s.thrust?.force ?? 0) / mass / (body.mu / r ** 2))}</dd></div>`;
      }
      $<HTMLButtonElement>("object-frame").disabled =
        s.activity?.kind === "fault";
      if (s.activity?.reason && !v.solar && !v.compact)
        $("readouts").innerHTML +=
          `<div class="fault-reason">${esc(s.activity.reason)}</div>`;
      if (s.activity?.retryAt !== undefined)
        $("readouts").innerHTML +=
          `<div><dt>Retry</dt><dd>${number(s.activity.retryAt)}</dd></div>`;
      const local =
        s.activity?.kind === "fault"
          ? [0, 0, 0, 0, 0, 0]
          : transform(session.run, s.y, session.t, active.frame);
      if (Math.abs(local[2]) + Math.abs(local[5]) > 1e-9)
        $("readouts").innerHTML +=
          `<div><dt>Z position</dt><dd>${number(local[2])}</dd></div><div><dt>Z velocity</dt><dd>${number(local[5])}</dd></div>`;
      const cursor = host.querySelector<SVGPathElement>(".budget-cursor");
      cursor?.setAttribute("transform", budgetCursorTransform());
      upcoming = session.events.find(
        (e) =>
          e.vessel === active.selected &&
          e.t > session.t + 1e-9 &&
          e.kind !== "burn",
      );
    } else {
      const station = session.run.stations.find(
          (s) => s.id === active.selected,
        ),
        stock = stocks.find((s) => s.id === active.selected);
      const body = session.run.world.bodies.find(
        (b) => b.id === active.selected,
      );
      $("object-status").textContent = station?.role ?? "Gravity source";
      $("readouts").innerHTML = stock
        ? `<div><dt>Freight stock</dt><dd>${number(stock.cargo)}</dd></div><div><dt>Propellant stock</dt><dd>${number(stock.propellant)}</dd></div><div><dt>Berths</dt><dd>${stock.occupied} / ${station!.berths}</dd></div>`
        : `<div><dt>Gravitational μ</dt><dd>${session.run.solar ? body!.mu.toExponential(4) : number(body!.mu)}</dd></div>`;
      upcoming = session.events.find(
        (e) =>
          e.portId === active.selected &&
          e.t > session.t + 1e-9 &&
          (e.kind === "dock" || e.kind === "land" || e.kind === "splashdown"),
      );
    }
    $("next-event").hidden = !upcoming;
    if (upcoming) {
      const e = upcoming;
      $("next-event").textContent =
        `${eventLabel(e)} · ${session.run.solar ? "Day " + number(e.t * 365.25) : number(e.t)} →`;
      $<HTMLButtonElement>("next-event").disabled =
        !!session.traffic && e.t > session.traffic.frontier;
      $("next-event").title =
        session.traffic && e.t > session.traffic.frontier
          ? "Planned · not flown yet"
          : "";
      $("next-event").onclick = () => session.seek(e.t);
    }
    const relevant = session.events.filter(
      (e) =>
        (v ? e.vessel === active.selected : e.portId === active.selected) &&
        e.kind !== "burn" &&
        e.kind !== "transfer-start",
    );
    $("schedule").hidden = !relevant.length;
    html(
      "event-list",
      relevant
        .map(
          (e) =>
            `<button data-time="${e.t}" ${session.traffic && e.t > session.traffic.frontier ? 'disabled title="Planned · not flown yet"' : ""} class="event ${e.t <= session.t ? "past" : ""}"><span>${session.run!.solar ? "D " + number(e.t * 365.25) : number(e.t)}</span>${esc(eventLabel(e))}</button>`,
        )
        .join(""),
    );
    host
      .querySelectorAll<HTMLButtonElement>("[data-time]")
      .forEach((b) => (b.onclick = () => session.seek(Number(b.dataset.time))));
    const percent =
      ((session.t - axisStart()) / (axisEnd() - axisStart())) * 100;
    host
      .querySelectorAll<HTMLElement>(".time-cursor")
      .forEach((c) => (c.style.left = `${percent}%`));
    host
      .querySelectorAll<HTMLElement>(".timeline-row")
      .forEach((r) =>
        r.classList.toggle("selected", r.dataset.vessel === active.selected),
      );
    $("frame-name").textContent =
      $<HTMLSelectElement>("frame").selectedOptions[0]?.textContent ?? "";
    updateRuler();
    publishState();
  }
  function publishState() {
    const run = session.run;
    const view = active?.debug();
    $("state-json").textContent = JSON.stringify({
      ready: session.ready,
      revision: session.revision,
      set: run?.id,
      t: session.t,
      playing: session.playing,
      playbackRate: session.playbackRate,
      ...view,
      activePane: activeId,
      views: panes.map((p) => ({
        id: Number(p.root.dataset.pane),
        visible: !p.root.hidden,
        ...p.debug(),
      })),
      traffic: session.traffic
        ? {
            frontier: session.traffic.frontier,
            oldest: session.traffic.oldest,
            pending: session.pending,
            sequence: session.sequence,
            live: session.liveMode,
            stats: run?.traffic?.stats,
            halt: session.traffic.halt,
            error: session.liveError,
          }
        : undefined,
      passThrough: run?.passThrough
        ? {
            period: run.passThrough.period,
            duration: run.passThrough.duration,
            work: run.passThrough.work,
            resources: passThroughResources(run.passThrough, session.t),
          }
        : undefined,
      staging: run?.staging,
      assemblies: run?.assemblies,
      entry: run?.entry,
      recoveries: run?.recoveries,
      ships: run?.vessels.map((v) =>
        !isPresent(v, session.t)
          ? { id: v.id, present: false, lifetime: v.lifetime }
          : {
              id: v.id,
              present: true,
              ...sampleVessel(v, session.t),
              ...(v.glyph
                ? {
                    glyph: v.glyph,
                    axis: rocketAxis(v, sampleVessel(v, session.t), session.t),
                  }
                : {}),
              screen: active.project(
                sampleVessel(v, session.t).y,
                sampleVessel(v, session.t).activity?.knownEpoch ?? session.t,
              ),
            },
      ),
      stocks: run ? stockAt(run, session.t) : [],
      events: session.events,
    });
  }
  function renderCatalog() {
    const open = new Map(
      [...$("catalog").querySelectorAll<HTMLDetailsElement>("details")].map(
        (d) => [d.dataset.family!, d.open],
      ),
    );
    const query = $<HTMLInputElement>("set-search").value.toLowerCase();
    $("catalog").innerHTML = [...new Set(catalog.map((s) => s.family))]
      .map((family) => {
        const entries = catalog.filter(
          (s) =>
            s.family === family &&
            (s.title + " " + s.summary + " " + family)
              .toLowerCase()
              .includes(query),
        );
        return entries.length
          ? `<details ${query || open.get(family) !== false ? "open" : ""} data-family="${esc(family)}" class="set-family"><summary>${esc(family)}</summary>${entries.map((s) => `<button class="set-entry ${s.id === session.currentSet ? "selected" : ""}" data-set="${s.id}" aria-pressed="${s.id === session.currentSet}"><strong>${esc(s.title)}</strong><span>${esc(s.summary)}</span></button>`).join("")}</details>`
          : "";
      })
      .join("");
    $("catalog")
      .querySelectorAll<HTMLButtonElement>("[data-set]")
      .forEach((b) => (b.onclick = () => openSet(b.dataset.set as ExhibitId)));
  }
  function openSet(id: ExhibitId) {
    const entry = catalog.find((s) => s.id === id)!;
    $("set-title").textContent = entry.family + " / " + entry.title;
    history.replaceState(null, "", "#set=" + encodeURIComponent(id));
    $("live").hidden = !entry.continuous;
    host.querySelector<HTMLElement>(".replay")!.hidden = entry.continuous;
    void session.loadSet(id);
    renderCatalog();
    if (innerWidth < 1100) {
      host.classList.add("library-closed");
      $("library-toggle").setAttribute("aria-expanded", "false");
    }
  }
  $("set-search").oninput = renderCatalog;
  $("library-toggle").onclick = () => {
    const closed = host.classList.toggle("library-closed");
    $("library-toggle").setAttribute("aria-expanded", String(!closed));
  };
  $("inspector-toggle").onclick = () => {
    const closed = host.classList.toggle("inspector-closed");
    $("inspector-toggle").setAttribute("aria-expanded", String(!closed));
  };
  $("layout").onchange = () =>
    applyPreset($<HTMLSelectElement>("layout").value);
  $("duplicate").onclick = () => {
    if (panes.length === 1) {
      addPane(active);
      $<HTMLSelectElement>("layout").value = "custom";
    }
  };
  $("split-direction").onclick = () => {
    const stacked = $("viewports").classList.toggle("stacked");
    $("split-direction").setAttribute(
      "aria-label",
      stacked ? "Arrange views side by side" : "Stack views",
    );
    updateLayout();
  };
  $("play").onclick = () => session.togglePlay();
  $("live").onclick = () => session.goLive();
  $("restart").onclick = () => {
    if (session.ready) {
      if (session.traffic) void session.loadSet(session.currentSet);
      else session.seek(session.start());
    }
  };
  function syncSpeed() {
    const rate = session.playbackRate,
      m = Math.abs(rate);
    const text = `${rate < 0 ? "−" : ""}${m === 0 ? "0" : m < 0.01 ? Number(m.toPrecision(3)) : m < 1 ? m.toFixed(2) : Number(m.toFixed(2))}×`;
    $("speed-value").textContent = text;
    const input = $<HTMLInputElement>("speed");
    input.dataset.maximum = String(maximumPlaybackRate(session.currentSet));
    input.value = String(
      speedPosition(rate, maximumPlaybackRate(session.currentSet)),
    );
    input.setAttribute("aria-valuetext", text);
  }
  $<HTMLInputElement>("speed").oninput = () =>
    session.setSpeed(
      speedAtPosition(
        Number($<HTMLInputElement>("speed").value),
        maximumPlaybackRate(session.currentSet),
      ),
    );
  $("speed").ondblclick = () => session.setSpeed(0);
  let seeking:
    | {
        id: number;
        target: HTMLElement;
        start: number;
        end: number;
        resume: boolean;
      }
    | undefined;
  const axisStart = () => seeking?.start ?? session.start();
  const axisEnd = () => seeking?.end ?? session.end();
  function finishSeek() {
    if (!seeking) return;
    const resume = seeking.resume;
    seeking = undefined;
    publicationDirty = true;
    if (resume && !session.playing && !document.hidden) session.togglePlay();
  }
  function bindSeek() {
    for (const element of host.querySelectorAll<HTMLElement>(
      ".timeline-seek,#ruler",
    )) {
      element.onpointerdown = (e) => {
        if (!session.ready || e.button !== 0) return;
        e.preventDefault();
        seeking = {
          id: e.pointerId,
          resume: session.playing,
          target: element,
          start: session.start(),
          end: session.end(),
        };
        element.setPointerCapture(e.pointerId);
        scrub(e);
      };
      element.onpointermove = (e) => {
        if (seeking?.target === element && seeking.id === e.pointerId) scrub(e);
        if (session.ready) {
          const r = element.getBoundingClientRect(),
            fraction = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
          const time = axisStart() + fraction * (axisEnd() - axisStart());
          const tooltip = $("hover-time");
          tooltip.hidden = false;
          tooltip.textContent = number(
            time * (session.run!.solar ? 365.25 : 1),
          );
          const ruler = $("ruler").getBoundingClientRect();
          tooltip.style.left =
            Math.max(22, Math.min(ruler.width - 22, e.clientX - ruler.left)) +
            "px";
        }
      };
      element.onpointerup = (e) => {
        if (seeking?.target === element) {
          scrub(e);
          finishSeek();
          if (element.hasPointerCapture(e.pointerId))
            element.releasePointerCapture(e.pointerId);
        }
      };
      element.onpointercancel = () => finishSeek();
      element.onlostpointercapture = () => {
        if (seeking?.target === element) finishSeek();
      };
      element.onpointerleave = () => {
        $("hover-time").hidden = true;
      };
      element.onclick = null;
    }
  }
  function scrub(e: PointerEvent) {
    if (!seeking) return;
    const r = seeking.target.getBoundingClientRect();
    session.seek(
      seeking.start +
        Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) *
          (seeking.end - seeking.start),
    );
  }
  function updateRuler() {
    if (!session.run) return;
    const a = axisStart(),
      b = axisEnd();
    html(
      "ticks",
      Array.from(
        { length: 7 },
        (_, i) =>
          `<span>${number((a + ((b - a) * i) / 6) * (session.run!.solar ? 365.25 : 1))}</span>`,
      ).join(""),
    );
    const ruler = $("ruler");
    ruler.style.marginRight =
      $("timelines").offsetWidth - $("timelines").clientWidth + "px";
    ruler.setAttribute("aria-valuemin", String(a));
    ruler.setAttribute("aria-valuemax", String(session.cursorEnd()));
    ruler.setAttribute("aria-valuenow", String(session.t));
    ruler.setAttribute("aria-valuetext", number(session.t));
    ruler.querySelector<HTMLElement>(".time-cursor")!.style.left =
      (100 * (session.t - a)) / (b - a) + "%";
  }
  $("ruler").onkeydown = (e) => {
    if (!session.ready) return;
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      session.seek(
        e.key === "Home"
          ? session.start()
          : e.key === "End"
            ? session.cursorEnd()
            : session.t +
              ((e.key === "ArrowRight" ? 1 : -1) *
                (session.end() - session.start())) /
                100,
      );
    }
  };
  bindSeek();
  const resizeTimeline = (height: number) => {
    const h = Math.max(32, Math.min(innerHeight * 0.45, height));
    $("timelines").style.height = h + "px";
    $("timeline-resize").setAttribute("aria-valuenow", String(Math.round(h)));
  };
  let timelineDrag: { id: number; y: number; height: number } | undefined;
  const grip = $("timeline-resize");
  grip.onpointerdown = (e) => {
    e.preventDefault();
    timelineDrag = {
      id: e.pointerId,
      y: e.clientY,
      height: $("timelines").getBoundingClientRect().height,
    };
    grip.setPointerCapture(e.pointerId);
  };
  grip.onpointermove = (e) => {
    if (timelineDrag?.id === e.pointerId)
      resizeTimeline(timelineDrag.height + timelineDrag.y - e.clientY);
  };
  grip.onpointerup = (e) => {
    timelineDrag = undefined;
    if (grip.hasPointerCapture(e.pointerId))
      grip.releasePointerCapture(e.pointerId);
  };
  grip.onpointercancel = () => {
    timelineDrag = undefined;
  };
  grip.onkeydown = (e) => {
    if (["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      resizeTimeline(
        e.key === "Home"
          ? 32
          : e.key === "End"
            ? innerHeight * 0.45
            : $("timelines").getBoundingClientRect().height +
              (e.key === "ArrowUp" ? 20 : -20),
      );
    }
  };
  $("collapse-timeline").onclick = () => {
    const collapsed = host.classList.toggle("timeline-collapsed");
    $("collapse-timeline").setAttribute("aria-expanded", String(!collapsed));
    $("collapse-timeline").textContent = collapsed
      ? "Activity ▸"
      : "Activity ▾";
  };
  host.addEventListener(
    "pointerdown",
    (e) => {
      for (const details of host.querySelectorAll<HTMLDetailsElement>(
        ".view-tools details[open]",
      ))
        if (!details.contains(e.target as Node)) details.open = false;
    },
    { capture: true, signal: lifetime.signal },
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (
        (e.target as HTMLElement).matches("input,select,button,summary") ||
        panes.some((p) => p.root.contains(e.target as Node))
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        session.togglePlay();
      }
      if (e.key.toLowerCase() === "f") active.fit();
      if (e.key.toLowerCase() === "t") active.setCamera("top");
    },
    { signal: lifetime.signal },
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) session.suspend();
    },
    { signal: lifetime.signal },
  );
  function animate(now: number) {
    if (disposed) return;
    viewerProfile.frame(now);
    session.advance(now, $<HTMLInputElement>("replay").checked);
    if (session.ready && publicationDirty) {
      publicationDirty = false;
      const v = active.vessel(),
        chart = host.querySelector(".budget-chart");
      if (v && chart) chart.outerHTML = fuelGraph(v);
      buildTimeline();
    }
    const began = performance.now();
    const visible = panes.filter((p) => !p.root.hidden);
    for (const pane of visible) pane.update();
    for (const pane of visible) pane.render();
    viewerProfile.record("draw", performance.now() - began);
    if (session.ready && now - lastPanel > 100) {
      const began = performance.now();
      updatePanels();
      viewerProfile.record("panels", performance.now() - began);
      lastPanel = now;
    }
    animation = requestAnimationFrame(animate);
  }
  Object.defineProperty(window, "orbitalProfile", {
    configurable: true,
    value: {
      start: () => viewerProfile.start(),
      stop: () => viewerProfile.stop(),
    },
  });
  Object.defineProperty(window, "orbitalPlayback", {
    configurable: true,
    get: () => ({
      epoch: session.t,
      frontier: session.traffic?.frontier,
      playing: session.playing,
      ready: session.ready,
      liveMode: session.liveMode,
      planning: session.traffic?.stats.planningPending ?? 0,
    }),
  });
  const requested = new URLSearchParams(location.hash.slice(1)).get("set");
  if (requested && !catalog.some((s) => s.id === requested)) {
    $("load-status").textContent =
      "This set has been retired. Choose a set from the library.";
    renderCatalog();
  } else openSet((requested as ExhibitId) || defaultExhibit);
  window.addEventListener(
    "hashchange",
    () => {
      const id =
        new URLSearchParams(location.hash.slice(1)).get("set") ||
        defaultExhibit;
      if (!catalog.some((s) => s.id === id)) {
        location.reload();
        return;
      }
      if (id !== session.currentSet) openSet(id as ExhibitId);
    },
    { signal: lifetime.signal },
  );
  animation = requestAnimationFrame(animate);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      cancelAnimationFrame(animation);
      session.dispose();
      for (const pane of panes) pane.dispose();
      panes.length = 0;
      host.replaceChildren();
      host.classList.remove(
        "library-closed",
        "inspector-closed",
        "timeline-collapsed",
      );
      Reflect.deleteProperty(window, "orbitalProfile");
      Reflect.deleteProperty(window, "orbitalPlayback");
    },
  };
}
