import { equilibria as binaryEquilibria, binaryPoint } from "../binary/model";
import { expeditionId } from "../expedition/query";
import {
  cameraPoint,
  cameraProjection,
  cameraVector,
  chaseRig,
  occluder,
  orbitAround,
  orient,
  pan,
  visibleSegment,
  zoom,
  type Camera,
  type CameraPreset,
  type ScreenPoint,
  type Sphere,
} from "../model-set/camera";
import { transform, transformDirection } from "../model-set/frames";
import {
  displayPortState as basePortState,
  isPresent,
  portsOf,
  type VesselView,
} from "../model-set/model";
import { trailOpacity } from "../model-set/trails";
import { densityAt } from "../sim/atmosphere";
import { bodyState as baseBodyState } from "../sim/dynamics";
import { surfaceNormal } from "../sim/logistics";
import type { State, Vec3 } from "../sim/schema";
import { directionAt } from "../sim/steering";
import { solarBodyState } from "../solar/ephemeris";
import { solarPortState } from "../solar/view";
import { surfaceDuration } from "../surface-flexible/contracts";
import { StableLabels, type Label, type PlacedLabel } from "../view/labels";
import { markerStep, planMarkers } from "../view/plan-markers";
import { bodySpin, drawPlanetGrid } from "../view/planet-grid";
import { EQUILIBRIA, basisPoint, reliefHeight } from "../view/potential-field";
import { PotentialLayer } from "../view/potential-layer";
import { drawRocket, rocketAxis } from "../view/rocket";
import type { ScenePresentation } from "./session";
import { esc, sampleVessel } from "./shared";
import { epochIndex, sampleWindow } from "./sample-window";
export function createViewport(
  root: HTMLElement,
  session: ScenePresentation,
  actions: {
    activate: () => void;
    changed: () => void;
    play: () => void;
    quality: () => number;
  },
) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>('[data-control="' + id + '"]')!;
  const canvas = $<HTMLCanvasElement>("space"),
    ctx = canvas.getContext("2d")!;
  let potentialLayer = new PotentialLayer(
    $<HTMLCanvasElement>("field-space"),
    $<HTMLCanvasElement>("relief-space"),
  );
  let selected = "",
    frame = "inertial",
    width = 900,
    height = 600;
  let renderedEpoch: number | undefined;
  const camera: Camera = {
    yaw: 0,
    pitch: Math.PI / 2,
    center: [0, 0, 0],
    scale: 100,
  };
  let cameraPreset: CameraPreset | "custom" = "top",
    panMode = false,
    spheres: Sphere[] = [],
    seeThroughBodies = false;
  let tracking: "off" | "follow" | "chase" = "off",
    trackingTarget = "",
    trackingOffset: Vec3 = [0, 0, 0];
  let trailScale = 1;
  const trailScales = new Map<string, number>();
  const recommendedTrail = () =>
    session.run?.playback?.trailSpan ??
    (session.run?.id === "lunar-loop" ? 9 : 12);
  const trailSpan = () => recommendedTrail() * trailScale;
  function syncTrail() {
    $<HTMLInputElement>("trail-length").value = String(trailScale);
    $("trail-value").textContent =
      trailScale.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "×";
  }
  let layers = {
    orbits: true,
    trails: true,
    plan: true,
    labels: true,
    atmosphere: true,
    aero: false,
    glow: true,
    field: false,
    relief: false,
    equilibria: false,
    grid: true,
  };
  let reliefGain = 1,
    gridStrength = 0.55,
    savedLayers = { ...layers },
    cleared = false;
  let aeroVectors: {
    vessel: string;
    kind: "drag" | "lift";
    force: number;
    from: [number, number];
    to: [number, number];
  }[] = [];
  let thrustWhiskers: {
    vessel: string;
    t: number;
    force: number;
    from: [number, number];
    to: [number, number];
  }[] = [];
  let hits: {
    id: string;
    name: string;
    x: number;
    y: number;
    depth: number;
    radius?: number;
  }[] = [];
  const labelLayout = new StableLabels();
  let placedLabels: PlacedLabel[] = [],
    hovered = "";
  const colors = { body: "#7893a4", station: "#c7d5de" };
  let renderProjection: ReturnType<typeof cameraProjection> | undefined;
  const hasField = () => !!session.run?.passThrough || !!session.run?.compact;
  const equilibriumMarkers = () =>
    session.run?.binary
      ? binaryEquilibria(session.run.binary)
      : hasField()
        ? EQUILIBRIA
        : [];
  const equilibriumPoint = (x: number, y: number, epoch: number) =>
    session.run?.binary
      ? binaryPoint(session.run.binary, x, y, epoch)
      : basisPoint(x, y, epoch);
  const reliefEnabled = () => hasField() && layers.relief;
  const reliefOrigins = new Map<number, number>();
  const project = (y: State, time: number): [number, number] => {
    const p = project3(y, time);
    return [p[0], p[1]];
  };
  const vessel = () =>
    session.run?.vessels.find((v) => v.id === selected) ??
    session.run?.maintained?.[selected];
  function updatePanels() {
    actions.changed();
  }
  function select(id: string) {
    selected = id;
    $("hit-menu").hidden = true;
    actions.changed();
  }
  function bodyState(body: import("../sim/schema").Body, epoch: number): State {
    return session.run?.solar &&
      session.run.world.bodies.some((b) => b.id === body.id)
      ? solarBodyState(session.run.solar, body.id, epoch)
      : baseBodyState(body, epoch);
  }
  function displayPortState(
    port: import("../sim/schema").Port,
    samples: import("../model-set/model").PortSamples,
    epoch: number,
  ): State {
    return session.run?.solar
      ? solarPortState(session.run.solar, port.id, epoch)
      : basePortState(port, samples, epoch);
  }
  function projectRaw(y: State, time: number): ScreenPoint {
    // The two system frames have no translating origin. Project positions
    // directly, retaining each vertex's own epoch for rotating axes; no need
    // to allocate transformed velocities or search for an actor per vertex.
    if (frame === "inertial")
      return renderProjection
        ? renderProjection(y)
        : cameraPoint(camera, y, width, height);
    if (frame === "rotating") {
      const a = session.run!.rotating.phase + session.run!.rotating.rate * time,
        c = Math.cos(a),
        s = Math.sin(a),
        p = [c * y[0] + s * y[1], -s * y[0] + c * y[1], y[2]];
      return renderProjection
        ? renderProjection(p)
        : cameraPoint(camera, p, width, height);
    }
    const ref = session.run?.vessels.find((v) => v.id === frame);
    if (ref && !ref.attachment && !isPresent(ref, time)) return [NaN, NaN, NaN];
    try {
      const state = transform(session.run!, y, time, frame);
      return renderProjection
        ? renderProjection(state)
        : cameraPoint(camera, state, width, height);
    } catch {
      return [NaN, NaN, NaN];
    }
  }
  function reliefOrigin(epoch: number) {
    if (frame === "inertial" || frame === "rotating") return 0;
    let height = reliefOrigins.get(epoch);
    if (height === undefined) {
      const origin = transform(session.run!, [0, 0, 0, 0, 0, 0], epoch, frame),
        q = basisPoint(-origin[0], -origin[1], -epoch);
      height = reliefHeight(q[0], q[1]);
      if (reliefOrigins.size >= 2048) reliefOrigins.clear();
      reliefOrigins.set(epoch, height);
    }
    return height;
  }
  function displayTransform(y: State, epoch: number): State {
    const state = transform(session.run!, y, epoch, frame);
    if (reliefEnabled()) {
      const q = basisPoint(y[0], y[1], -epoch);
      state[2] += reliefGain * (reliefHeight(q[0], q[1]) - reliefOrigin(epoch));
    }
    return state;
  }
  function project3(y: State, epoch: number): ScreenPoint {
    if (!reliefEnabled()) return projectRaw(y, epoch);
    const ref = session.run?.vessels.find((v) => v.id === frame);
    if (ref && !ref.attachment && !isPresent(ref, epoch))
      return [NaN, NaN, NaN];
    try {
      const state = displayTransform(y, epoch);
      return renderProjection
        ? renderProjection(state)
        : cameraPoint(camera, state, width, height);
    } catch {
      return [NaN, NaN, NaN];
    }
  }
  function selectedState(id = selected): State | undefined {
    if (!session.run) return;
    const v =
      session.run?.vessels.find((v) => v.id === id) ??
      session.run?.maintained?.[id];
    if (v) {
      if (!isPresent(v, session.t) && !v.attachment) return;
      const sample = sampleVessel(v, session.t);
      if (
        sample.activity?.kind === "fault" ||
        sample.activity?.kind === "unavailable"
      )
        return;
      return sample.frameOrigin ?? sample.y;
    }
    const port = portsOf(session.run).find((p) => p.id === id);
    if (port) return displayPortState(port, session.run.portSamples, session.t);
    const body = session.run.world.bodies.find((b) => b.id === id);
    if (body) return bodyState(body, session.t);
  }
  function pivot(): Vec3 | undefined {
    const state = selectedState(tracking !== "off" ? trackingTarget : selected);
    return state
      ? (displayTransform(state, session.t).slice(0, 3) as Vec3)
      : undefined;
  }
  function surfaceReference(v: VesselView | undefined) {
    const pads = v?.ports.filter((p) => p.rail.kind === "surface") ?? [];
    const owners = session.run!.world.bodies.filter((b) =>
      pads.some((p) => p.rail.kind === "surface" && p.rail.bodyId === b.id),
    );
    if (owners.length > 1 && v) {
      const y = sampleVessel(v, session.t).y;
      return owners.reduce((best, b) => {
        const pull = (body: typeof b) =>
          body.mu /
          Math.max(
            1e-12,
            bodyState(body, session.t)
              .slice(0, 3)
              .reduce((n, x, i) => n + (y[i] - x) ** 2, 0),
          );
        return pull(b) > pull(best) ? b : best;
      });
    }
    return owners[0] ?? session.run!.world.bodies[0];
  }
  function syncTracking() {
    if (tracking === "off") return;
    const state = selectedState(trackingTarget);
    if (!state) {
      tracking = "off";
      cameraControls();
      return;
    }
    const target = displayTransform(state, session.t);
    camera.center = target
      .slice(0, 3)
      .map((x, i) => x + trackingOffset[i]) as Vec3;
    if (tracking === "chase") {
      const primary = bodyState(session.run!.world.bodies[0], session.t),
        r = state.slice(0, 3).map((x, i) => x - primary[i]),
        v = state.slice(3).map((x, i) => x - primary[i + 3]);
      camera.rig = chaseRig(
        transformDirection(session.run!, r as Vec3, session.t, frame),
        transformDirection(session.run!, v as Vec3, session.t, frame),
      );
    }
  }
  function captureTrackingOffset() {
    const p = pivot();
    if (tracking !== "off" && p)
      trackingOffset = camera.center.map((x, i) => x - p[i]) as Vec3;
  }
  function track(mode: typeof tracking) {
    tracking = mode;
    if (mode !== "off") trackingTarget = selected;
    trackingOffset = [0, 0, 0];
    if (mode === "chase") {
      camera.yaw = 0;
      camera.pitch = 0.35;
      cameraPreset = "custom";
      panMode = false;
    }
    syncTracking();
    cameraControls();
    actions.changed();
    if (session.ready) updatePanels();
  }
  function cameraControls() {
    $<HTMLSelectElement>("tracking").value = tracking;
    $<HTMLSelectElement>("camera-view").value = cameraPreset;
    $("tracking-target").textContent = tracking === "off" ? "" : trackingTarget;
    $("camera-summary").textContent =
      tracking === "chase"
        ? "Chase"
        : {
            top: "Top",
            oblique: "3D",
            front: "Front",
            side: "Side",
            custom: "3D",
          }[cameraPreset] + (tracking === "follow" ? " · Follow" : "");
    $("drag-mode").textContent =
      cameraPreset === "top" || panMode ? "Pan" : "Orbit";
    $<HTMLButtonElement>("drag-mode").disabled = cameraPreset === "top";
    $("drag-mode").setAttribute("aria-pressed", String(panMode));
    canvas.setAttribute(
      "aria-label",
      cameraPreset === "top" || panMode
        ? "Orbital traffic. Drag to pan, scroll to zoom, click a ship or station to inspect."
        : "Orbital traffic. Drag to orbit, Shift-drag to pan, scroll to zoom, click a ship or station to inspect.",
    );
  }
  function setCamera(preset: CameraPreset) {
    if (tracking === "chase") tracking = "follow";
    orient(camera, preset);
    cameraPreset = preset;
    panMode = false;
    cameraControls();
    actions.changed();
    if (session.ready) updatePanels();
  }
  function fit() {
    if (!session.run) return;
    camera.center = [0, 0, 0];
    camera.scale =
      Math.min(width, height) /
      (2 *
        (session.run.frameExtents?.[frame] ??
          (session.run.solar && session.run.vessels.some((v) => v.id === frame)
            ? 0.08
            : session.run.extent)) *
        (frame === "inertial" || frame === "rotating" ? 1 : 1.8));
  }
  function path(
    points: [number, number][],
    color: string,
    lineWidth = 1,
    alpha = 1,
    dash: number[] = [],
  ) {
    points = points.filter((p) => p.every(Number.isFinite));
    if (!points.length) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = alpha;
    ctx.setLineDash(dash);
    ctx.moveTo(...points[0]);
    let last = points[0];
    for (let i = 1; i < points.length; i++)
      if (
        i === points.length - 1 ||
        Math.hypot(points[i][0] - last[0], points[i][1] - last[1]) >= 0.1
      ) {
        ctx.lineTo(...points[i]);
        last = points[i];
      }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  function worldPath(
    points: ScreenPoint[],
    color: string,
    lineWidth = 1,
    alpha = 1,
    dash: number[] = [],
  ) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = alpha;
    ctx.setLineDash(dash);
    const margin = 12 * lineWidth; // includes the Canvas default miter limit
    let previous: ScreenPoint | undefined, last: ScreenPoint | undefined;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p.every(Number.isFinite)) {
        previous = last = undefined;
        continue;
      }
      if (
        previous &&
        i !== points.length - 1 &&
        Math.hypot(...p.map((x, j) => x - previous![j])) < 0.1
      )
        continue;
      // Convex screen bounds: a segment wholly outside one edge cannot contribute
      // pixels. Skip its sphere clipping too, especially at close surface zoom.
      if (
        previous &&
        (Math.max(previous[0], p[0]) < -margin ||
          Math.min(previous[0], p[0]) > width + margin ||
          Math.max(previous[1], p[1]) < -margin ||
          Math.min(previous[1], p[1]) > height + margin)
      ) {
        previous = p;
        last = undefined;
        continue;
      }
      if (previous)
        for (const [a, b] of visibleSegment(previous, p, spheres)) {
          if (!last || Math.hypot(a[0] - last[0], a[1] - last[1]) > 1e-6)
            ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          last = b;
        }
      previous = p;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }
  function nextArrival(v: VesselView) {
    return session.events.find(
      (e) =>
        e.vessel === v.id &&
        e.t > session.t + 1e-9 &&
        (e.kind === "dock" || e.kind === "land" || e.kind === "splashdown"),
    );
  }
  function draw() {
    reliefOrigins.clear();
    ctx.clearRect(0, 0, width, height);
    if (
      !session.run ||
      !session.ready ||
      (!layers.field && !layers.relief) ||
      (!session.run.passThrough && !session.run.compact)
    ) {
      ctx.fillStyle = "#0c141d";
      ctx.fillRect(0, 0, width, height);
    }
    // Quiet schematic background; no decorative planetary rendering.
    ctx.fillStyle = "#7e98aa";
    for (let i = 0; i < 65; i++) {
      ctx.globalAlpha = 0.12 + (i % 4) * 0.035;
      ctx.fillRect((i * 313.47) % width, (i * 137.33) % height, 1, 1);
    }
    ctx.globalAlpha = 1;
    if (!session.run || !session.ready) return;
    renderedEpoch = session.t;
    renderProjection = cameraProjection(camera, width, height);
    const fieldSupported = !!session.run.passThrough || !!session.run.compact;
    $("potential-controls").hidden = !fieldSupported;
    $("equilibrium-control").hidden = !fieldSupported && !session.run.binary;
    const gridOrigin =
      fieldSupported && layers.relief
        ? transform(session.run, [0, 0, 0, 0, 0, 0], session.t, frame)
        : [0, 0, 0, 0, 0, 0];
    potentialLayer.draw(
      width,
      height,
      session.t,
      (p) => projectRaw(p, session.t),
      (layers.field || layers.relief) && fieldSupported,
      layers.relief,
      reliefGain,
      reliefEnabled() ? reliefOrigin(session.t) : 0,
      layers.field,
      layers.grid,
      frame === "rotating"
        ? -session.run.rotating.phase
        : session.run.rotating.rate * session.t,
      gridOrigin.slice(0, 2),
      2 ** Math.round(Math.log2(50 / camera.scale)),
      gridStrength,
    );
    $("field-key").hidden =
      !potentialLayer.visible || !layers.field || potentialLayer.outlineOnly;
    hits = [];
    thrustWhiskers = [];
    aeroVectors = [];
    const scenario = session.run.world;
    const labelRequests: Label[] = [];
    const displayedBodies = scenario.bodies.filter((b) => {
      if (
        !session.run!.solar ||
        b.id !== "Moon" ||
        selected === "Moon" ||
        frame === "Moon"
      )
        return true;
      const m = project(bodyState(b, session.t), session.t),
        e = project(
          bodyState(scenario.bodies.find((b) => b.id === "Earth")!, session.t),
          session.t,
        );
      return Math.hypot(m[0] - e[0], m[1] - e[1]) > 18;
    });
    spheres = seeThroughBodies
      ? []
      : displayedBodies.map((body) => ({
          id: body.id,
          point: project3(bodyState(body, session.t), session.t),
          radius: Math.max(7, body.radius * camera.scale),
        }));
    for (const body of [...displayedBodies].sort(
      (a, b) =>
        project3(bodyState(a, session.t), session.t)[2] -
        project3(bodyState(b, session.t), session.t)[2],
    )) {
      const p = project(bodyState(body, session.t), session.t),
        r = Math.max(7, body.radius * camera.scale);
      ctx.beginPath();
      ctx.arc(...p, r, 0, Math.PI * 2);
      ctx.fillStyle =
        session.run.binary && body === session.run.world.bodies[0]
          ? "#4d4329"
          : "#192a37";
      ctx.globalAlpha = seeThroughBodies ? 0.18 : 1;
      ctx.fill();
      ctx.globalAlpha = seeThroughBodies ? 0.45 : 1;
      ctx.strokeStyle =
        session.run.binary && body === session.run.world.bodies[0]
          ? "#9d8851"
          : "#445c6e";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawPlanetGrid(
        ctx,
        project3(bodyState(body, session.t), session.t),
        r,
        bodySpin(session.run, body),
        session.t,
        (v) =>
          cameraVector(
            camera,
            transformDirection(session.run!, v, session.t, frame),
          ),
        seeThroughBodies,
      );
      if (selected === body.id) {
        ctx.beginPath();
        ctx.arc(...p, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = "#b2c6d2";
        ctx.stroke();
      }
      if (
        !occluder(
          project3(bodyState(body, session.t), session.t),
          spheres.filter((s) => s.id !== body.id),
        )
      )
        label(
          body.id,
          body.id === "primary"
            ? "Planet"
            : body.id === "moon"
              ? "Selene"
              : body.id,
          p[0] + r,
          p[1],
          colors.body,
        );
      hits.push({
        id: body.id,
        name: body.id,
        x: p[0],
        y: p[1],
        depth: project3(bodyState(body, session.t), session.t)[2],
        radius: r,
      });
    }
    if (layers.atmosphere && session.run.atmosphere) {
      const a = session.run.atmosphere,
        body = session.run.world.bodies.find((b) => b.id === a.bodyId)!,
        p = project(bodyState(body, session.t), session.t),
        r = body.radius * camera.scale,
        outer = (body.radius + a.topHeight) * camera.scale;
      const gradient = ctx.createRadialGradient(
        p[0],
        p[1],
        r,
        p[0],
        p[1],
        outer,
      );
      for (let i = 0; i <= 16; i++) {
        const u = i / 16,
          alpha = (0.22 * densityAt(a, u * a.topHeight)) / a.density;
        gradient.addColorStop(
          u,
          `rgba(104,174,211,${Number.isFinite(alpha) ? alpha : 0})`,
        );
      }
      ctx.beginPath();
      ctx.arc(...p, outer, 0, 2 * Math.PI);
      ctx.arc(...p, r, 0, 2 * Math.PI, true);
      ctx.fillStyle = gradient;
      ctx.fill("evenodd");
      for (const ratio of [0.1, 0.01, 0.001]) {
        const h = -a.scaleHeight * Math.log(ratio);
        if (h >= a.topHeight) continue;
        ctx.beginPath();
        ctx.arc(...p, (body.radius + h) * camera.scale, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(128,198,237,.12)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
    const reference = [
      ...session.run.vessels,
      ...Object.values(session.run.maintained ?? {}),
    ].find((v) => v.id === frame);
    if (layers.orbits) {
      const frameStart = Math.max(
          session.start(),
          reference?.lifetime?.start ?? session.start(),
        ),
        frameEnd = Math.min(
          session.end(),
          reference?.lifetime?.end ?? session.end(),
        );
      const orbitEpochs = (period: number) => {
        const duration = Math.min(period, frameEnd - frameStart);
        const first = Math.max(
          frameStart,
          Math.min(session.t - duration / 2, frameEnd - duration),
        );
        return Array.from(
          { length: 161 },
          (_, i) => first + (duration * i) / 160,
        );
      };
      for (const port of portsOf(session.run)) {
        if (port.rail.kind === "surface") continue;
        if (port.rail.kind === "ballistic" || port.rail.kind === "powered") {
          worldPath(
            (session.run.solar
              ? Array.from({ length: 129 }, (_, i) => {
                  const epoch = Math.max(
                    frameStart,
                    Math.min(
                      frameEnd,
                      session.t +
                        (i / 128 - 0.5) *
                          (port.id === "Earth gateway" ? 0.012 : 0.008),
                    ),
                  );
                  return {
                    t: epoch,
                    y: displayPortState(port, session.run!.portSamples, epoch),
                  };
                })
              : session.run.portSamples[port.id].filter(
                  (s) => Math.abs(s.t - session.t) < 3,
                )
            ).map((s) => project3(s.y, s.t)),
            "#647c8d",
            0.8,
            0.3,
          );
          continue;
        }
        const period = (2 * Math.PI) / port.rail.rate;
        worldPath(
          orbitEpochs(period).map((epoch) =>
            project3(
              displayPortState(port, session.run!.portSamples, epoch),
              epoch,
            ),
          ),
          "#647c8d",
          0.8,
          0.3,
        );
      }
      for (const [id, v] of Object.entries(session.run.maintained ?? {}))
        if (
          id === selected &&
          sampleVessel(v, session.t).activity?.kind !== "fault"
        ) {
          const reference = session.run.stations.find((p) => p.id === id)!
            .maintenance!.reference;
          worldPath(
            orbitEpochs((2 * Math.PI) / reference.rate).map((epoch) =>
              project3(
                bodyState(
                  { id: "nominal", mu: 1, radius: 0, rail: reference },
                  epoch,
                ),
                epoch,
              ),
            ),
            "#89a9b7",
            0.8,
            0.25,
            [2, 5],
          );
          worldPath(
            v.baseline
              .filter((s) => Math.abs(s.t - session.t) < 8)
              .map((s) => project3(s.y, s.t)),
            "#b19ab4",
            1,
            0.45,
            [4, 5],
          );
          const baseline = project3(
            displayPortState(
              portsOf(session.run).find((p) => p.id === id)!,
              { [id]: v.baseline },
              session.t,
            ),
            session.t,
          );
          if (!occluder(baseline, spheres)) {
            ctx.beginPath();
            ctx.arc(baseline[0], baseline[1], 4, 0, 2 * Math.PI);
            ctx.strokeStyle = "#b19ab4";
            ctx.stroke();
          }
        }
      for (const body of scenario.bodies.filter(
        (b) =>
          b.rail.kind === "circular" || (session.run!.solar && b.id !== "Sun"),
      )) {
        const rail = body.rail as Extract<
            typeof body.rail,
            {
              kind: "circular";
            }
          >,
          period = session.run.solar
            ? body.id === "Moon"
              ? 0.0748
              : body.id === "Earth"
                ? 1
                : body.id === "Mars"
                  ? 1.88
                  : 11.86
            : (2 * Math.PI) / Math.abs(rail.rate);
        worldPath(
          orbitEpochs(period).map((epoch) =>
            project3(bodyState(body, epoch), epoch),
          ),
          "#647c8d",
          0.8,
          0.2,
        );
      }
    }
    for (const v of [
      ...session.run.vessels,
      ...Object.values(session.run.maintained ?? {}),
    ]) {
      const id = v.id,
        isSelected = id === selected;
      if (layers.trails) {
        const trailStart = Math.max(session.start(), session.t - trailSpan());
        let prev: ScreenPoint | undefined,
          chunk: ScreenPoint[] = [],
          shade = -1;
        for (
          let i = epochIndex(v.samples, trailStart);
          i < v.samples.length;
          i++
        ) {
          const sample = v.samples[i];
          if (sample.t > session.t) break;
          if (sample.activity?.kind === "fault") continue;
          const p: ScreenPoint =
            sample.opacity === 0
              ? [NaN, NaN, NaN]
              : project3(sample.y, sample.t);
          const alpha = Math.round(
            32 *
              trailOpacity(
                sample.t,
                session.t,
                session.start(),
                isSelected,
                trailSpan(),
              ),
          );
          if (alpha !== shade && chunk.length) {
            worldPath(chunk, v.color, isSelected ? 1.7 : 1.1, shade / 32);
            chunk = prev ? [prev] : [];
          }
          chunk.push(p);
          shade = alpha;
          prev = p;
        }
        if (chunk.length)
          worldPath(chunk, v.color, isSelected ? 1.7 : 1.1, shade / 32);
        if (
          prev &&
          isPresent(v, session.t) &&
          sampleVessel(v, session.t).activity?.kind !== "fault"
        )
          worldPath(
            [prev, project3(sampleVessel(v, session.t).y, session.t)],
            v.color,
            1.5,
            0.75,
          );
      }
      if (
        layers.plan &&
        isSelected &&
        (!isPresent(v, session.t) ||
          sampleVessel(v, session.t).activity?.kind !== "fault")
      ) {
        const stop =
          nextArrival(v)?.t ??
          Math.min(
            session.end(),
            session.t +
              (session.run.playback?.forecastSpan ??
                (session.run.id === "lunar-loop" ? 5.58 : 8)),
          );
        worldPath(
          [
            ...(isPresent(v, session.t)
              ? [project3(sampleVessel(v, session.t).y, session.t)]
              : []),
            ...sampleWindow(v.samples, session.t, stop, false, true).map((s) =>
              s.opacity === 0
                ? ([NaN, NaN, NaN] as ScreenPoint)
                : project3(s.y, s.t),
            ),
          ],
          "#b5bdc7",
          0.6,
          0.09,
        );
        ctx.fillStyle = "#b5bdc7";
        ctx.globalAlpha = 0.38;
        ctx.beginPath();
        for (const q of planMarkers(
          v,
          session.t,
          Math.min(stop, session.t + 32),
          markerStep(camera.scale, v.ship.state),
        )) {
          const p = project3(q.y, q.t);
          if (!occluder(p, spheres)) {
            ctx.moveTo(p[0] + 1, p[1]);
            ctx.arc(p[0], p[1], 1, 0, 2 * Math.PI);
          }
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const entryDelay = v.expedition?.instance?.epochOffset ?? 0,
        entryFirst = v.expedition
          ? Math.max(
              0,
              Math.floor((session.start() - entryDelay) / v.expedition.period),
            )
          : 0;
      const entryArcs = v.stagedService
        ? []
        : v.expedition
          ? Array.from(
              {
                length: Math.max(
                  0,
                  Math.floor(
                    (session.end() - entryDelay) / v.expedition.period,
                  ) -
                    entryFirst +
                    1,
                ),
              },
              (_, i) => {
                const index = entryFirst + i,
                  offset = entryDelay + index * v.expedition!.period,
                  e = v.expedition!.template.entry!;
                return {
                  id: expeditionId(v.expedition!, index, "terminal-braking"),
                  start: e.brakingEpoch + offset,
                  end: e.recovery.t + offset,
                  direction: [0, 0, 0] as Vec3,
                  throttle: 1,
                };
              },
            )
          : v.entry
            ? [
                {
                  id: "terminal-braking",
                  start: v.entry.brakingEpoch,
                  end: v.entry.recovery.t,
                  direction: [0, 0, 0] as Vec3,
                  throttle: 1,
                },
              ]
            : [];
      if (layers.plan && isSelected)
        for (const arc of [...v.arcs, ...entryArcs]) {
          const stop = nextArrival(v)?.t ?? session.end();
          if (
            arc.throttle === 0 ||
            arc.end <= session.t ||
            arc.start >= stop ||
            arc.end > session.end() ||
            (isPresent(v, session.t) &&
              sampleVessel(v, session.t).activity?.kind === "fault")
          )
            continue;
          const curve = [
            project3(
              sampleVessel(v, Math.max(session.start(), arc.start)).y,
              Math.max(session.start(), arc.start),
            ),
            ...sampleWindow(v.samples, arc.start, arc.end, false, false).map(
              (s) => project3(s.y, s.t),
            ),
            project3(sampleVessel(v, arc.end).y, arc.end),
          ];
          const length = curve
            .slice(1)
            .reduce(
              (sum, p, i) =>
                sum + Math.hypot(p[0] - curve[i][0], p[1] - curve[i][1]),
              0,
            );
          const maintenance = !!session.run.maintained?.[id] || !!v.maintenance;
          const count = Math.max(
            2,
            Math.min(
              maintenance ? 12 : 40,
              Math.ceil(length / (maintenance ? 32 : 14)),
            ),
          );
          // Samples stay anchored to the whole arc, so whiskers disappear as flown
          // rather than crawling along the remaining portion during playback.
          for (let i = 0; i < count; i++) {
            const epoch =
              arc.start + ((i + 0.5) / count) * (arc.end - arc.start);
            if (epoch < session.t || epoch > stop) continue;
            const sample = sampleVessel(v, epoch),
              force = sample.thrust?.force ?? 0;
            const point = project3(sample.y, epoch),
              d = cameraVector(
                camera,
                transformDirection(
                  session.run,
                  sample.thrust?.direction ??
                    directionAt(arc, epoch - arc.start),
                  epoch,
                  frame,
                ),
              ),
              n = Math.hypot(d[0], d[1]);
            if (n < 1e-10 || force <= 0) continue;
            // Exhaust-side whiskers share the ship's burn schematic convention.
            // A visibility floor and square-root scale show small burns without
            // letting large engines dominate the drawing. Force includes cap taper.
            const pixels = maintenance
              ? 2 +
                7 *
                  Math.sqrt(
                    Math.min(
                      1,
                      force /
                        (v.surfaceEngine &&
                        v.surfaceFlights?.some(
                          (f) =>
                            epoch >= f.start &&
                            epoch < f.start + surfaceDuration,
                        )
                          ? v.surfaceEngine.maxThrust
                          : v.ship.engine!.maxThrust),
                    ),
                  )
              : 3 +
                15 *
                  Math.sqrt(
                    Math.min(
                      1,
                      force /
                        (v.surfaceEngine &&
                        v.surfaceFlights?.some(
                          (f) =>
                            epoch >= f.start &&
                            epoch < f.start + surfaceDuration,
                        )
                          ? v.surfaceEngine.maxThrust
                          : v.ship.engine!.maxThrust),
                    ),
                  );
            const tip: ScreenPoint = [
              point[0] - d[0] * pixels,
              point[1] + d[1] * pixels,
              point[2] - d[2] * pixels,
            ];
            if (occluder(point, spheres)) continue;
            worldPath(
              [point, tip],
              maintenance ? "#85c9c0" : "#f0cf8f",
              maintenance ? 0.8 : 1,
              maintenance ? 0.4 : 0.75,
            );
            thrustWhiskers.push({
              vessel: id,
              t: epoch,
              force,
              from: [point[0], point[1]],
              to: [tip[0], tip[1]],
            });
          }
        }
    }
    function label(
      id: string,
      text: string,
      x: number,
      y: number,
      color: string,
    ) {
      if (!layers.labels) return;
      ctx.font = "11px Space Grotesk, sans-serif";
      labelRequests.push({
        id,
        text,
        x,
        y,
        color,
        width: ctx.measureText(text).width,
        priority: id === selected ? 100 : id === hovered ? 90 : 0,
      });
    }
    const icons: {
      depth: number;
      draw: () => void;
    }[] = [];
    for (const port of portsOf(session.run)) {
      const powered = session.run.maintained?.[port.id],
        known = powered ? sampleVessel(powered, session.t) : undefined,
        epoch =
          known?.activity?.kind === "fault"
            ? known.activity.knownEpoch!
            : session.t;
      const state =
        known?.activity?.kind === "fault"
          ? known.y
          : displayPortState(port, session.run.portSamples, session.t);
      if (port.rail.kind === "surface") {
        const rail = port.rail,
          body = session.run.world.bodies.find((b) => b.id === rail.bodyId)!,
          center = bodyState(body, session.t);
        for (let i = 0; i < 3; i++)
          state[i] =
            center[i] + ((state[i] - center[i]) * body.radius) / rail.radius;
      }
      const p3 = project3(state, epoch);
      if (occluder(p3, spheres)) continue;
      const p: [number, number] = [p3[0], p3[1]];
      icons.push({
        depth: p3[2],
        draw: () => {
          if (port.rail.kind === "surface") {
            const outward = cameraVector(
              camera,
              transformDirection(
                session.run!,
                surfaceNormal(port, session.t),
                session.t,
                frame,
              ),
            );
            ctx.save();
            ctx.translate(...p);
            ctx.rotate(Math.atan2(-outward[1], outward[0]));
            path(
              [
                [0, -7],
                [0, 7],
              ],
              colors.station,
              2,
            );
            path(
              [
                [0, -7],
                [4, -7],
              ],
              colors.station,
              1,
            );
            path(
              [
                [0, 7],
                [4, 7],
              ],
              colors.station,
              1,
            );
            ctx.restore();
          } else {
            ctx.save();
            ctx.translate(...p);
            ctx.rotate(Math.PI / 4);
            ctx.strokeStyle = colors.station;
            ctx.lineWidth = 1.2;
            ctx.strokeRect(-4, -4, 8, 8);
            ctx.restore();
          }
          const thrust = known?.thrust;
          if (selected === port.id && thrust && thrust.force > 0) {
            const d = cameraVector(
              camera,
              transformDirection(
                session.run!,
                thrust.direction,
                session.t,
                frame,
              ),
            );
            path(
              [
                [p[0] - d[0] * 5, p[1] + d[1] * 5],
                [p[0] - d[0] * 15, p[1] + d[1] * 15],
              ],
              "#ffe0a0",
              2,
              0.9,
            );
          }
          if (selected === port.id) {
            ctx.beginPath();
            ctx.arc(...p, 10, 0, Math.PI * 2);
            ctx.strokeStyle = "#c7d5de";
            ctx.stroke();
          }
          if (known?.activity?.kind === "fault") {
            path(
              [
                [p[0] - 5, p[1] - 5],
                [p[0] + 5, p[1] + 5],
              ],
              "#ef8a81",
              2,
            );
            path(
              [
                [p[0] - 5, p[1] + 5],
                [p[0] + 5, p[1] - 5],
              ],
              "#ef8a81",
              2,
            );
          }
          label(
            port.id,
            port.id + (known?.activity?.kind === "fault" ? " · fault" : ""),
            ...p,
            "#a7bac7",
          );
          hits.push({
            id: port.id,
            name: port.id,
            x: p[0],
            y: p[1],
            depth: p3[2],
          });
        },
      });
    }
    for (const v of session.run.vessels) {
      if (!isPresent(v, session.t)) continue;
      const state = sampleVessel(v, session.t);
      if (state.opacity === 0) continue;
      const epoch =
          state.activity?.kind === "fault"
            ? state.activity.knownEpoch!
            : session.t,
        p = project(state.y, epoch);
      if (
        !p.every(Number.isFinite) ||
        occluder(project3(state.y, epoch), spheres)
      )
        continue;
      const transformed = transform(session.run, state.y, epoch, frame),
        velocity = cameraVector(camera, transformed.slice(3));
      icons.push({
        depth: project3(state.y, epoch)[2],
        draw: () => {
          if (state.activity?.kind === "fault") {
            path(
              [
                [p[0] - 5, p[1] - 5],
                [p[0] + 5, p[1] + 5],
              ],
              "#ef8a81",
              2,
            );
            path(
              [
                [p[0] - 5, p[1] + 5],
                [p[0] + 5, p[1] - 5],
              ],
              "#ef8a81",
              2,
            );
            label(v.id, `${v.name} · fault`, ...p, "#ef8a81");
            hits.push({
              id: v.id,
              name: v.name,
              x: p[0],
              y: p[1],
              depth: project3(state.y, epoch)[2],
            });
            return;
          }
          if (layers.glow && state.aero && state.aero.heatProxy > 1e-8) {
            const intensity = Math.min(
                1,
                state.aero.heatProxy / (v.entry?.heatScale ?? 1),
              ),
              radius = 10 + 15 * Math.sqrt(intensity),
              d = cameraVector(
                camera,
                transformDirection(
                  session.run!,
                  state.aero.relativeVelocity,
                  session.t,
                  frame,
                ),
              );
            ctx.save();
            ctx.translate(...p);
            ctx.rotate(Math.atan2(-d[1], d[0]));
            ctx.scale(1, 0.65);
            const glow = ctx.createRadialGradient(4, 0, 1, 4, 0, radius);
            glow.addColorStop(0, `rgba(255,225,158,${intensity * 0.75})`);
            glow.addColorStop(0.35, `rgba(245,145,93,${intensity * 0.5})`);
            glow.addColorStop(1, "rgba(245,145,93,0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(4, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          if (layers.aero && selected === v.id && state.aero)
            for (const [kind, vector, color] of [
              ["drag", state.aero.drag, "#80c6ed"],
              ["lift", state.aero.lift, "#bb9fee"],
            ] as const) {
              const force = Math.hypot(...vector);
              if (force < 1e-10) continue;
              const d = cameraVector(
                  camera,
                  transformDirection(
                    session.run!,
                    vector.map((x) => x / force) as Vec3,
                    session.t,
                    frame,
                  ),
                ),
                pixels = 40 * Math.sqrt(force / (1 + force)),
                origin = project3(state.y, session.t),
                tip: ScreenPoint = [
                  origin[0] + d[0] * pixels,
                  origin[1] - d[1] * pixels,
                  origin[2] + d[2] * pixels,
                ];
              worldPath([origin, tip], color, 1.5, 0.9);
              const length = Math.hypot(tip[0] - origin[0], tip[1] - origin[1]);
              if (length > 2) {
                const x = (tip[0] - origin[0]) / length,
                  y = (tip[1] - origin[1]) / length;
                path(
                  [
                    [tip[0] - x * 5 - y * 3, tip[1] - y * 5 + x * 3],
                    [tip[0], tip[1]],
                    [tip[0] - x * 5 + y * 3, tip[1] - y * 5 - x * 3],
                  ],
                  color,
                  1.5,
                  0.9,
                );
              }
              aeroVectors.push({
                vessel: v.id,
                kind,
                force,
                from: p,
                to: [tip[0], tip[1]],
              });
            }
          if (state.thrust && state.thrust.force > 0) {
            const direction = cameraVector(
                camera,
                transformDirection(
                  session.run!,
                  state.thrust.direction,
                  session.t,
                  frame,
                ),
              ),
              dx = direction[0],
              dy = -direction[1],
              length = Math.hypot(dx, dy);
            if (length > 1e-10)
              path(
                [
                  [p[0] - dx * 5, p[1] - dy * 5],
                  [p[0] - dx * 15, p[1] - dy * 15],
                ],
                "#ffe0a0",
                2,
                0.9,
              );
          }
          ctx.save();
          ctx.globalAlpha = state.opacity ?? 1;
          ctx.translate(...p);
          if (v.glyph)
            drawRocket(
              ctx,
              v.glyph,
              v.color,
              cameraVector(
                camera,
                transformDirection(
                  session.run!,
                  rocketAxis(v, state, session.t),
                  session.t,
                  frame,
                ),
              ),
            );
          else {
            const angle =
              Math.hypot(velocity[0], velocity[1]) > 1e-10
                ? Math.atan2(-velocity[1], velocity[0])
                : 0;
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(-4, -3.5);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-4, 3.5);
            ctx.closePath();
            ctx.fillStyle = v.color;
            ctx.fill();
          }
          ctx.restore();
          if (selected === v.id) {
            ctx.beginPath();
            ctx.arc(...p, 11, 0, Math.PI * 2);
            ctx.strokeStyle = v.color;
            ctx.globalAlpha = 0.65 * (state.opacity ?? 1);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          if (
            (state.opacity ?? 1) > 0.5 &&
            (!state.logistics?.dockedPortId || selected === v.id)
          )
            label(v.id, v.name, ...p, v.color);
          hits.push({
            id: v.id,
            name: v.name,
            x: p[0],
            y: p[1],
            depth: project3(state.y, epoch)[2],
          });
        },
      });
    }
    if (layers.equilibria)
      for (const marker of equilibriumMarkers()) {
        const point = project3(
          equilibriumPoint(marker.x, marker.y, session.t),
          session.t,
        );
        if (occluder(point, spheres)) continue;
        path(
          [
            [point[0] - 4, point[1] - 4],
            [point[0] + 4, point[1] + 4],
          ],
          "#94a899",
          1,
          0.7,
        );
        path(
          [
            [point[0] - 4, point[1] + 4],
            [point[0] + 4, point[1] - 4],
          ],
          "#94a899",
          1,
          0.7,
        );
        if (layers.labels)
          label(
            "equilibrium-" + marker.id,
            marker.id,
            point[0] + 7,
            point[1] - 5,
            "#94a899",
          );
      }
    icons.sort((a, b) => a.depth - b.depth).forEach((icon) => icon.draw());
    placedLabels = labelLayout.layout(labelRequests, performance.now());
    ctx.font = "11px Space Grotesk, sans-serif";
    for (const l of placedLabels) {
      ctx.globalAlpha = l.alpha;
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, l.left, l.top);
    }
    ctx.globalAlpha = 1;
    if (cameraPreset !== "top")
      for (const [i, color] of ["#d99086", "#96bb8e", "#8caed8"].entries()) {
        const unit = [0, 0, 0];
        unit[i] = 1;
        const d = cameraVector(camera, unit);
        const origin: [number, number] = [width - 45, height - 43],
          tip: [number, number] = [
            origin[0] + d[0] * 24,
            origin[1] - d[1] * 24,
          ];
        path([origin, tip], color, 1.5, 0.85);
        ctx.fillStyle = color;
        ctx.font = "10px ui-monospace";
        ctx.fillText("XYZ"[i], tip[0] + 3, tip[1] - 3);
      }
    ctx.fillStyle = "#4c6477";
    ctx.font = "10px ui-monospace, monospace";
    const unit = 10 ** Math.floor(Math.log10(80 / camera.scale));
    const bar = unit * camera.scale;
    ctx.fillRect(20, height - 22, bar, 1);
    ctx.fillText(
      `${Number(unit.toPrecision(2))} ${session.run.world.units.length}`,
      20,
      height - 29,
    );
  }
  $<HTMLSelectElement>("frame").onchange = (e) => {
    frame = (e.target as HTMLSelectElement).value;
    reliefOrigins.clear();
    fit();
    updatePanels();
  };
  $("camera-view").onchange = (e) => {
    const p = (e.target as HTMLSelectElement).value;
    if (p !== "custom") setCamera(p as CameraPreset);
  };
  $("drag-mode").onclick = () => {
    panMode = !panMode;
    cameraControls();
  };
  $("track-selected").onclick = () =>
    track(tracking === "off" ? "follow" : tracking);
  $("tracking").onchange = (e) =>
    track((e.target as HTMLSelectElement).value as typeof tracking);
  $("fit").onclick = () => {
    track("off");
    fit();
    actions.changed();
    updatePanels();
  };
  $("launch-view").onclick = () => {
    if (
      session.run?.entry ||
      (vessel()?.entry && session.t >= (vessel()!.entry!.activeFrom ?? 0))
    ) {
      frame = "inertial";
      $<HTMLSelectElement>("frame").value = frame;
      const entry = vessel()?.entry,
        spatial =
          entry &&
          (entry.physics.scenario.ship.state[2] !== 0 ||
            entry.physics.scenario.ship.state[5] !== 0);
      setCamera(spatial ? "front" : "top");
      if (spatial) {
        const y = sampleVessel(vessel()!, session.t).y,
          b = bodyState(session.run!.world.bodies[0], session.t),
          rad = y.slice(0, 3).map((x, i) => x - b[i]),
          n = Math.hypot(...rad),
          normal = rad.map((x) => x / n) as Vec3;
        const equator = Math.hypot(normal[0], normal[1]),
          east: Vec3 =
            equator > 1e-10
              ? [-normal[1] / equator, normal[0] / equator, 0]
              : [0, 1, 0];
        const north: Vec3 = [
          -normal[2] * east[1],
          normal[2] * east[0],
          normal[0] * east[1] - normal[1] * east[0],
        ];
        camera.rig = { right: east, forward: north, up: normal };
        cameraPreset = "custom";
      }
      track("follow");
      camera.scale = Math.min(width, height) / 0.3;
      updatePanels();
      return;
    }
    const pads =
      session.run?.world.ports.filter((p) => p.rail.kind === "surface") ?? [];
    const y = selectedState();
    const pad =
      pads.find((p) => p.id === selected) ||
      pads.slice().sort((a, b) => {
        const distance = (p: typeof a) =>
          y
            ? displayPortState(p, session.run!.portSamples, session.t)
                .slice(0, 3)
                .reduce((n, x, i) => n + (x - y[i]) ** 2, 0)
            : 0;
        return distance(a) - distance(b);
      })[0];
    if (!pad) return;
    track("off");
    frame = pad.id;
    $<HTMLSelectElement>("frame").value = frame;
    const ownerId = pad.rail.kind === "surface" ? pad.rail.bodyId : undefined;
    const surfaceBody =
      session.run!.world.bodies.find((b) => b.id === ownerId) ??
      session.run!.world.bodies[0];
    const theta =
      pad.rail.kind === "surface"
        ? pad.rail.phase + pad.rail.rate * session.t
        : 0;
    if (pad.rail.kind === "surface" && pad.rail.latitude !== undefined) {
      const normal = surfaceNormal(pad, session.t),
        east: Vec3 = [-Math.sin(theta), Math.cos(theta), 0],
        north: Vec3 = [
          -Math.sin(pad.rail.latitude) * Math.cos(theta),
          -Math.sin(pad.rail.latitude) * Math.sin(theta),
          Math.cos(pad.rail.latitude),
        ];
      setCamera("front");
      camera.rig = { right: east, forward: north, up: normal };
      camera.center = normal.map((v) => v * 0.075 * surfaceBody.radius) as Vec3;
      cameraPreset = "custom";
      cameraControls();
    } else {
      setCamera("top");
      camera.center = [
        Math.cos(theta) * 0.075 * surfaceBody.radius,
        Math.sin(theta) * 0.075 * surfaceBody.radius,
        0,
      ];
    }
    camera.scale = Math.min(width, height) / (0.22 * surfaceBody.radius);
    updatePanels();
  };
  for (const key of Object.keys(layers) as (keyof typeof layers)[]) {
    $<HTMLInputElement>(`layer-${key}`).onchange = (e) => {
      layers[key] = (e.target as HTMLInputElement).checked;
      if (key === "relief" && layers.relief) {
        if (cameraPreset === "top") setCamera("oblique");
      }
      cleared = false;
      $("clear-view").setAttribute("aria-pressed", "false");
      actions.changed();
      updatePanels();
    };
  }
  $<HTMLInputElement>("grid-strength").oninput = (e) => {
    gridStrength = Number((e.target as HTMLInputElement).value);
    $("grid-strength-value").textContent = Math.round(gridStrength * 100) + "%";
    actions.changed();
    if (session.ready) updatePanels();
  };
  $<HTMLInputElement>("relief-height").oninput = (e) => {
    reliefGain = Number((e.target as HTMLInputElement).value);
    $("relief-value").textContent =
      reliefGain.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "×";
    actions.changed();
    if (session.ready) updatePanels();
  };
  $<HTMLInputElement>("trail-length").oninput = (e) => {
    trailScale = Number((e.target as HTMLInputElement).value);
    trailScales.set(session.currentSet, trailScale);
    syncTrail();
    actions.changed();
    if (session.ready) updatePanels();
  };
  $<HTMLInputElement>("see-through").onchange = (e) => {
    seeThroughBodies = (e.target as HTMLInputElement).checked;
    actions.changed();
    updatePanels();
  };
  $("clear-view").onclick = () => {
    if (!cleared) {
      savedLayers = { ...layers };
      layers = {
        orbits: false,
        trails: false,
        plan: false,
        labels: false,
        atmosphere: false,
        aero: false,
        glow: false,
        field: false,
        relief: false,
        equilibria: false,
        grid: false,
      };
    } else layers = { ...savedLayers };
    cleared = !cleared;
    $("clear-view").setAttribute("aria-pressed", String(cleared));
    for (const key of Object.keys(layers) as (keyof typeof layers)[])
      $<HTMLInputElement>(`layer-${key}`).checked = layers[key];
    updatePanels();
  };
  let drag:
    | { x: number; y: number; camera: Camera; rotate: boolean; moved: boolean }
    | undefined;
  canvas.oncontextmenu = (e) => e.preventDefault();
  function hitAt(x: number, y: number) {
    return hits
      .filter((h) => {
        const r = h.radius ?? 14,
          dx = x - h.x,
          dy = y - h.y;
        if (Math.hypot(dx, dy) >= r) return false;
        return (
          !h.radius ||
          !occluder(
            [x, y, h.depth + Math.sqrt(Math.max(0, r * r - dx * dx - dy * dy))],
            spheres.filter((s) => s.id !== h.id),
          )
        );
      })
      .sort((a, b) => b.depth - a.depth);
  }
  canvas.onpointerdown = (e) => {
    if (e.button > 2) return;
    canvas.focus();
    canvas.setPointerCapture(e.pointerId);
    drag = {
      x: e.clientX,
      y: e.clientY,
      camera: structuredClone(camera),
      rotate:
        cameraPreset !== "top" && !panMode && !e.shiftKey && e.button === 0,
      moved: false,
    };
    $("hit-menu").hidden = true;
  };
  canvas.onpointermove = (e) => {
    if (!drag) {
      const r = canvas.getBoundingClientRect();
      hovered = hitAt(e.clientX - r.left, e.clientY - r.top)[0]?.id ?? "";
      return;
    }
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    drag.moved ||= Math.hypot(dx, dy) > 4;
    if (drag.moved) {
      Object.assign(camera, structuredClone(drag.camera));
      if (drag.rotate) {
        orbitAround(camera, pivot(), dx, dy);
        cameraPreset = "custom";
        cameraControls();
      } else pan(camera, dx, dy);
      captureTrackingOffset();
    }
  };
  canvas.onpointerup = (e) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = undefined;
    if (moved || e.button !== 0) return;
    const rect = canvas.getBoundingClientRect(),
      x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    const found = hitAt(x, y);
    if (found.length === 1) select(found[0].id);
    else if (found.length > 1) {
      const menu = $("hit-menu"),
        menuRevision = session.revision;
      menu.innerHTML = found
        .map((h) => `<button data-hit="${esc(h.id)}">${esc(h.name)}</button>`)
        .join("");
      menu.hidden = false;
      menu.style.left = `${Math.max(8, Math.min(e.clientX, window.innerWidth - 180))}px`;
      menu.style.top = `${Math.max(8, Math.min(e.clientY, window.innerHeight - found.length * 40 - 16))}px`;
      menu.querySelectorAll<HTMLButtonElement>("[data-hit]").forEach(
        (b) =>
          (b.onclick = () => {
            menu.hidden = true;
            if (menuRevision === session.revision && root.isConnected)
              select(b.dataset.hit!);
          }),
      );
    }
  };
  canvas.onpointerleave = () => {
    hovered = "";
  };
  canvas.onpointercancel = () => {
    drag = undefined;
  };
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoom(
        camera,
        Math.exp(-e.deltaY * 0.0015),
        e.clientX - rect.left - width / 2,
        e.clientY - rect.top - height / 2,
        session.run?.playback?.maxZoom ?? 1e6,
      );
      captureTrackingOffset();
    },
    { passive: false },
  );
  root.addEventListener("pointerdown", (e) => {
    if (
      !canvas.contains(e.target as Node) &&
      !$("hit-menu").contains(e.target as Node)
    )
      $("hit-menu").hidden = true;
  });
  root.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).matches("input, select, button, summary"))
      return;
    if (e.code === "Space") {
      e.preventDefault();
      actions.play();
    }
    if (e.key.toLowerCase() === "f") $("fit").click();
    if (e.key.toLowerCase() === "t") setCamera("top");
    if (
      e.target === canvas &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    ) {
      e.preventDefault();
      const dx = e.key === "ArrowLeft" ? -18 : e.key === "ArrowRight" ? 18 : 0,
        dy = e.key === "ArrowUp" ? -18 : e.key === "ArrowDown" ? 18 : 0;
      if (e.shiftKey || cameraPreset === "top" || panMode) pan(camera, dx, dy);
      else {
        orbitAround(camera, pivot(), dx, dy);
        cameraPreset = "custom";
        cameraControls();
      }
      captureTrackingOffset();
    }
    if (e.key === "Escape") {
      $("hit-menu").hidden = true;
      root
        .querySelectorAll<HTMLDetailsElement>("details[open]")
        .forEach((d) => (d.open = false));
    }
  });

  // Place popovers below the whole toolbar, including its wrapped rows.
  function positionMenus() {
    for (const details of root.querySelectorAll<HTMLDetailsElement>(
      "details[open]",
    )) {
      const popup = details.querySelector<HTMLElement>(
        ".popover,.layer-options",
      );
      if (!popup) continue;
      const summary = details.querySelector("summary")!.getBoundingClientRect(),
        bar = root.querySelector(".view-tools")!.getBoundingClientRect();
      popup.style.left =
        Math.max(8, Math.min(summary.left, innerWidth - 238)) + "px";
      popup.style.top = Math.min(bar.bottom + 5, innerHeight - 60) + "px";
      popup.style.maxHeight =
        Math.min(640, Math.max(40, innerHeight - bar.bottom - 15)) + "px";
    }
  }
  for (const details of root.querySelectorAll<HTMLDetailsElement>("details"))
    details.addEventListener("toggle", () => {
      if (details.open) {
        for (const other of root.querySelectorAll<HTMLDetailsElement>(
          "details[open]",
        ))
          if (other !== details) other.open = false;
        positionMenus();
      }
    });
  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    width = r.width;
    height = r.height;
    const dpr = actions.quality();
    const w = Math.round(width * dpr),
      h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    renderProjection = undefined;
    positionMenus();
  }
  function update() {
    if (!session.run || !session.ready) return;
    if (layers.relief && potentialLayer.stats.reliefError) {
      layers.relief = false;
      layers.field = true;
      $<HTMLInputElement>("layer-field").checked = true;
      $<HTMLInputElement>("layer-relief").checked = false;
      $<HTMLInputElement>("layer-relief").disabled = true;
      $("layer-relief").title = potentialLayer.stats.reliefError;
    }
    $("frame-name").textContent =
      $<HTMLSelectElement>("frame").selectedOptions[0]?.textContent ?? "";
    const reference = [
      ...session.run.vessels,
      ...Object.values(session.run.maintained ?? {}),
    ].find((v) => v.id === frame);
    if (
      reference &&
      ((!isPresent(reference, session.t) && !reference.attachment) ||
        sampleVessel(reference, session.t).activity?.kind === "fault")
    ) {
      frame = "inertial";
      $<HTMLSelectElement>("frame").value = frame;
    }
    if (reference?.expedition) {
      const pose = sampleVessel(reference, session.t);
      if (pose.opacity === 0) {
        // Vessel-centered axes retain their physical meaning. While ground
        // transport is hidden, change to inertial coordinates and preserve the
        // camera's world position instead of redefining the physical frame.
        const origin = pose.frameOrigin ?? pose.y;
        camera.center = camera.center.map((x, i) => x + origin[i]) as Vec3;
        frame = "inertial";
        $<HTMLSelectElement>("frame").value = frame;
      }
    }
    syncTracking();

    for (const option of $<HTMLSelectElement>("frame").options) {
      const v = [
        ...session.run.vessels,
        ...Object.values(session.run.maintained ?? {}),
      ].find((v) => v.id === option.value);
      option.disabled =
        !!v &&
        ((!isPresent(v, session.t) && !v.attachment) ||
          sampleVessel(v, session.t).activity?.kind === "fault" ||
          (sampleVessel(v, session.t).opacity === 0 && !v.attachment));
    }
  }
  function reset() {
    $("hit-menu").hidden = true;
    root
      .querySelectorAll<HTMLDetailsElement>("details[open]")
      .forEach((d) => (d.open = false));
    drag = undefined;
    potentialLayer.dispose();
    // A released WebGL context belongs to its old canvas. New generation,
    // new canvases: late events cannot poison the replacement renderer.
    for (const id of ["field-space", "relief-space"]) {
      const old = $(id);
      old.replaceWith(old.cloneNode(false));
    }
    $("field-key").hidden = true;
    potentialLayer = new PotentialLayer(
      $<HTMLCanvasElement>("field-space"),
      $<HTMLCanvasElement>("relief-space"),
    );
    renderedEpoch = undefined;
    labelLayout.reset();
    hits = [];
    placedLabels = [];
    tracking = "off";
    trackingTarget = "";
    trackingOffset = [0, 0, 0];
    delete camera.rig;
    const run = session.run;
    if (!run) return;
    selected = run.vessels[0]?.id ?? "";
    frame = run.binary
      ? "libration"
      : run.id === "selene-ground-service"
        ? "moon"
        : "inertial";
    cameraPreset = [
      "orison-steered",
      "aster-northern-launch",
      "helion-orison-observatory-mission",
      "helion-orison-survey",
      "selene-ground-service",
      "orison-relay-network",
    ].includes(run.id)
      ? "oblique"
      : "top";
    orient(camera, cameraPreset);
    if (run.id === "aster-northern-launch") camera.yaw = 2.6;
    if (run.id === "selene-ground-service") camera.yaw = 1.2;
    panMode = false;
    trailScale = trailScales.get(run.id) ?? 1;
    syncTrail();
    $("frame").innerHTML =
      '<option value="inertial">' +
      (run.solar ? "Heliocentric" : "Inertial") +
      '</option><option value="rotating">' +
      esc(run.rotating.name) +
      "</option>" +
      (run.binary ? '<option value="libration">L2 rotating</option>' : "") +
      [
        ...run.world.bodies.map((b) => [b.id, b.id]),
        ...run.stations.map((s) => [s.id, s.id]),
        ...run.vessels.map((v) => [v.id, v.name]),
      ]
        .map(
          ([id, name]) =>
            '<option value="' +
            esc(id) +
            '">' +
            esc(name) +
            " centered</option>",
        )
        .join("");
    $<HTMLSelectElement>("frame").value = frame;
    $("launch-view").hidden =
      !run.entry && !run.world.ports.some((p) => p.rail.kind === "surface");
    root
      .querySelectorAll<HTMLElement>(".entry-layer")
      .forEach((e) => (e.hidden = !run.atmosphere));
    cameraControls();
    resize();
    fit();
  }
  root.addEventListener("pointerdown", () => actions.activate());
  root.addEventListener("focusin", () => actions.activate());
  function readState() {
    return {
      renderedEpoch,
      selected,
      frame,
      trailScale,
      trailSpan: trailSpan(),
      layers: { ...layers },
      reliefGain,
      gridStrength,
      field: potentialLayer.stats,
      equilibria: equilibriumMarkers().map((e) => ({
        ...e,
        screen: project(equilibriumPoint(e.x, e.y, session.t), session.t),
      })),
      aeroVectors,
      thrustWhiskers,
      hits,
      labels: placedLabels.map(({ id, anchor, alpha, left, top }) => ({
        id,
        anchor,
        alpha,
        left,
        top,
      })),
      camera: {
        ...structuredClone(camera),
        preset: cameraPreset,
        panMode,
        tracking,
        trackingTarget,
        trackingOffset: [...trackingOffset],
      },
      seeThroughBodies,
      size: { width, height, backing: canvas.width * canvas.height },
    };
  }
  return {
    root,
    canvas,
    camera,
    get selected() {
      return selected;
    },
    set selected(id: string) {
      select(id);
    },
    get frame() {
      return frame;
    },
    set frame(id: string) {
      frame = id;
      $<HTMLSelectElement>("frame").value = id;
      reliefOrigins.clear();
    },
    get tracking() {
      return tracking;
    },
    vessel,
    bodyState,
    displayPortState,
    project,
    project3,
    equilibriumMarkers,
    equilibriumPoint,
    trailSpan,
    surfaceReference,
    fit,
    track,
    setCamera,
    select,
    reset,
    resize,
    update,
    render: draw,
    get trailScale() {
      return trailScale;
    },
    get layers() {
      return layers;
    },
    get reliefGain() {
      return reliefGain;
    },
    get gridStrength() {
      return gridStrength;
    },
    debug: readState,
    copyFrom(other: { debug: typeof readState; camera: Camera }) {
      const d = other.debug();
      selected = d.selected;
      frame = d.frame;
      layers = { ...d.layers };
      trailScale = d.trailScale;
      reliefGain = d.reliefGain;
      gridStrength = d.gridStrength;
      seeThroughBodies = d.seeThroughBodies;
      Object.assign(camera, structuredClone(other.camera));
      cameraPreset = d.camera.preset;
      tracking = d.camera.tracking;
      trackingTarget = d.camera.trackingTarget;
      trackingOffset = d.camera.trackingOffset as Vec3;
      for (const key of Object.keys(layers) as (keyof typeof layers)[])
        $<HTMLInputElement>("layer-" + key).checked = layers[key];
      $<HTMLSelectElement>("frame").value = frame;
      $<HTMLInputElement>("see-through").checked = seeThroughBodies;
      $<HTMLInputElement>("grid-strength").value = String(gridStrength);
      $<HTMLInputElement>("relief-height").value = String(reliefGain);
      syncTrail();
      cameraControls();
    },
    suspend() {
      canvas.width = canvas.height = 1;
      renderProjection = undefined;
      potentialLayer.suspend();
      root
        .querySelectorAll<HTMLDetailsElement>("details[open]")
        .forEach((d) => (d.open = false));
      $("hit-menu").hidden = true;
    },
    dispose() {
      observer.disconnect();
      potentialLayer.dispose();
      root.remove();
      canvas.width = canvas.height = 1;
      hits = [];
      placedLabels = [];
      reliefOrigins.clear();
    },
  };
}
export type Viewport = ReturnType<typeof createViewport>;
