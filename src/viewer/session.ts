import PrepareWorker from "../model-set/prepare.worker?worker";
import TrafficWorker from "../traffic/traffic.worker?worker";
import { SurveyStore } from "../binary/survey-store";
import type { SurveyDefinition } from "../binary/survey";
import type { SurveyDelta } from "../binary/survey-engine";
import { FleetViewStore } from "../cycler/service-store";
import type { FleetServiceDefinition } from "../cycler/service-view";
import type { FleetDelta } from "../cycler/service-engine";
import { AsterSystemViewStore } from "../aster-system/view";
import type {
  AsterSystemDefinition,
  AsterSystemDelta,
} from "../aster-system/engine";
import { NetworkViewStore } from "../network/view";
import type { NetworkDefinition } from "../network/model";
import type { NetworkDelta } from "../network/engine";
import { LunarViewStore } from "../lunar/view";
import { LUNAR_LEAD, type LunarDefinition } from "../lunar/world";
import type { LunarDelta } from "../lunar/engine";
import { TrafficViewStore } from "../traffic/view";
import type { TrafficDefinition } from "../traffic/planner";
import type { TrafficDelta } from "../traffic/engine";
import { EXPEDITION_LEAD } from "../expedition/engine";
import {
  adaptivePlaybackLead,
  bufferedEdge,
  maximumPlaybackRate,
} from "../traffic/playback";
import { setEvents, type SceneView, type SetEvent } from "../model-set/model";
import { viewerProfile } from "../view/profile";
import { catalog, type ExhibitId } from "./catalog";
import { loadExhibit } from "./loaders";

/** Sole owner of simulation lifetime, bounded requests and the shared clock.
 * Publication refresh remains cursor-dependent; worker revision is not its key.
 * Viewports only read this session and cannot ingest or advance it. */
export function createSceneSession(
  changed: (kind: "loading" | "ready" | "publication" | "controls") => void,
) {
  let run: SceneView | undefined,
    worker: Worker | undefined,
    revision = 0;
  let traffic:
    | SurveyStore
    | FleetViewStore
    | AsterSystemViewStore
    | NetworkViewStore
    | LunarViewStore
    | TrafficViewStore
    | undefined;
  let pending = false,
    sequence = 0,
    requestedTarget = 0,
    desiredTarget = 0,
    liveMode = true,
    liveError = "",
    trafficDirty = false;
  let trafficRequestStart = 0,
    lastTrafficRefresh = 0;
  let events: SetEvent[] = [],
    t = 0,
    playing = false,
    ready = false,
    currentSet: ExhibitId = "aster-selene-cycler-fleet-service";
  let playbackRate = 1,
    resumeRate = 1,
    lastFrame = performance.now();
  const speeds = new Map<string, number>(),
    resumeSpeeds = new Map<string, number>();
  const start = () => run!.window.start,
    end = () => run!.window.end,
    cursorEnd = () => traffic?.frontier ?? end();
  const trafficRefreshDue = () => performance.now() - lastTrafficRefresh > 100;
  const playbackLead = () =>
    traffic instanceof SurveyStore
      ? 32
      : traffic instanceof FleetViewStore ||
          traffic instanceof AsterSystemViewStore
        ? EXPEDITION_LEAD
        : traffic instanceof LunarViewStore
          ? LUNAR_LEAD
          : traffic instanceof NetworkViewStore
            ? adaptivePlaybackLead
            : 0;
  const liveEdge = () =>
    traffic
      ? bufferedEdge(traffic.frontier, traffic.oldest, playbackLead())
      : 0;
  function refreshTraffic() {
    if (!traffic) return;
    const began = performance.now();
    trafficDirty = false;
    run = traffic.view(t);
    events = setEvents(run);
    viewerProfile.record("refresh", performance.now() - began);
    lastTrafficRefresh = performance.now();
    changed("publication");
  }
  function requestTraffic(target: number) {
    if (
      !traffic ||
      !worker ||
      pending ||
      liveError ||
      traffic.halt ||
      !playing ||
      playbackRate <= 0 ||
      !liveMode ||
      document.hidden ||
      target <= traffic.frontier
    )
      return;
    trafficRequestStart = performance.now();
    pending = true;
    requestedTarget = Math.min(
      traffic.frontier + 1,
      Math.max(traffic.frontier, target),
    );
    worker.postMessage({
      generation: revision,
      sequence: ++sequence,
      target: requestedTarget,
      after: traffic.frontier,
    });
  }
  function goLive() {
    if (!traffic) return;
    if (playbackRate <= 0) {
      playbackRate = Math.abs(resumeRate) || 1;
      resumeRate = playbackRate;
    }
    traffic.release();
    if (!liveMode) t = Math.max(t, liveEdge());
    desiredTarget = t + playbackLead();
    liveMode = !!playbackLead() || (!liveError && !traffic.halt);
    playing = (!liveError && !traffic.halt) || t < traffic.frontier;
    lastFrame = performance.now();
    refreshTraffic();
    changed("controls");
  }
  function seek(time: number, pause = true) {
    if (!ready) return;
    t = Math.max(traffic?.oldest ?? start(), Math.min(cursorEnd(), time));
    if (pause) {
      playing = false;
      if (traffic) liveMode = false;
    }
    refreshTraffic();
    changed("controls");
  }
  function fail(error: string) {
    pending = false;
    liveError = error;
    playing = playing && ready && !!playbackLead() && t < traffic!.frontier;
    if (!playbackLead()) liveMode = false;
    changed("controls");
  }
  async function loadSet(id: ExhibitId) {
    if (ready) {
      speeds.set(currentSet, playbackRate);
      resumeSpeeds.set(currentSet, resumeRate);
    }
    currentSet = id;
    playbackRate =
      speeds.get(id) ??
      (id.startsWith("aster-selene-cycler")
        ? 0.5
        : id === "solar-cycler"
          ? 4
          : id === "selene-ground-service"
            ? 0.01
            : [
                  "helion-orison-observatory-mission",
                  "aster-northern-launch",
                ].includes(id)
              ? 0.1
              : 1);
    resumeRate = resumeSpeeds.get(id) ?? (playbackRate || 1);
    playbackRate =
      Math.sign(playbackRate) *
      Math.min(Math.abs(playbackRate), maximumPlaybackRate(id));
    resumeRate =
      Math.sign(resumeRate) *
      Math.min(Math.abs(resumeRate), maximumPlaybackRate(id));
    if (playbackRate) resumeRate = playbackRate;
    worker?.terminate();
    worker = undefined;
    traffic = undefined;
    pending = false;
    sequence = 0;
    desiredTarget = 0;
    liveError = "";
    liveMode = playbackRate >= 0;
    trafficDirty = false;
    revision++;
    ready = false;
    playing = false;
    run = undefined;
    events = [];
    t = 0;
    const generation = revision;
    changed("loading");
    let definition: unknown;
    try {
      definition = await loadExhibit(id);
    } catch (error) {
      if (generation === revision) {
        liveError = "Scene failed: " + String(error);
        changed("controls");
      }
      return;
    }
    if (generation !== revision) return;
    if (!catalog.find((s) => s.id === id)!.continuous) {
      const owner = new PrepareWorker({ name: "scene-prepare" });
      worker = owner;
      owner.onmessage = (
        e: MessageEvent<{ revision: number; run?: SceneView; error?: string }>,
      ) => {
        if (generation !== revision || e.data.revision !== revision) return;
        if (e.data.error) {
          liveError = e.data.error;
          owner.terminate();
          worker = undefined;
          changed("controls");
          return;
        }
        run = e.data.run!;
        events = setEvents(run);
        ready = true;
        playing = playbackRate !== 0;
        t = 0;
        owner.terminate();
        worker = undefined;
        changed("ready");
      };
      owner.onerror = (e) => {
        if (generation === revision) {
          liveError = "Scene failed: " + (e.message || "worker failed");
          changed("controls");
        }
      };
      owner.postMessage({ revision, set: definition });
      return;
    }
    traffic =
      id === "helion-orison-survey"
        ? new SurveyStore(definition as SurveyDefinition)
        : id === "aster-selene-cycler-fleet-service"
          ? new FleetViewStore(definition as FleetServiceDefinition)
          : id === "aster-selene-system"
            ? new AsterSystemViewStore(definition as AsterSystemDefinition)
            : id === "selene-ground-service"
              ? new LunarViewStore(definition as LunarDefinition)
              : id === "orison-relay-network"
                ? new NetworkViewStore(definition as NetworkDefinition)
                : new TrafficViewStore(definition as TrafficDefinition);
    worker = new TrafficWorker({ name: "continuous-traffic" });
    pending = true;
    trafficRequestStart = performance.now();
    worker.onmessage = (
      e: MessageEvent<{
        generation: number;
        sequence: number;
        delta?:
          | SurveyDelta
          | FleetDelta
          | AsterSystemDelta
          | NetworkDelta
          | LunarDelta
          | TrafficDelta;
        error?: string;
      }>,
    ) => {
      if (
        generation !== revision ||
        e.data.generation !== revision ||
        e.data.sequence !== sequence
      )
        return;
      viewerProfile.record(
        "workerTurnaround",
        performance.now() - trafficRequestStart,
      );
      pending = false;
      if (e.data.error) {
        fail("Simulation stopped: " + e.data.error);
        return;
      }
      const first = !ready,
        previous = traffic!.frontier,
        began = performance.now(),
        held = !liveMode || (!playing && !first);
      try {
        if (traffic instanceof SurveyStore)
          traffic.ingest(e.data.delta as SurveyDelta, held);
        else if (traffic instanceof FleetViewStore)
          traffic.ingest(e.data.delta as FleetDelta, held);
        else if (traffic instanceof AsterSystemViewStore)
          traffic.ingest(e.data.delta as AsterSystemDelta, held);
        else if (traffic instanceof NetworkViewStore)
          traffic.ingest(e.data.delta as NetworkDelta, held);
        else if (traffic instanceof LunarViewStore)
          traffic.ingest(e.data.delta as LunarDelta, held);
        else traffic!.ingest(e.data.delta as TrafficDelta, held);
      } catch (error) {
        worker?.terminate();
        fail("Simulation stopped: " + String(error));
        return;
      }
      viewerProfile.record("ingestion", performance.now() - began);
      if (first) {
        ready = true;
        playing = playbackRate !== 0;
        t = 0;
      } else if (liveMode && playing && !playbackLead()) t = traffic!.frontier;
      if (
        first ||
        previous !== traffic!.frontier ||
        (traffic instanceof LunarViewStore &&
          (e.data.delta as LunarDelta).missions.length)
      ) {
        if (first || !playing || t > run!.window.end || trafficRefreshDue())
          refreshTraffic();
        else trafficDirty = true;
      }
      if (first) changed("ready");
    };
    worker.onerror = (e) => {
      if (generation === revision)
        fail("Simulation stopped: " + (e.message || "worker failed"));
    };
    worker.postMessage({ generation, sequence, definition });
  }
  function advance(now: number, replay: boolean) {
    const dt = Math.max(0, Math.min(0.1, (now - lastFrame) / 1000));
    lastFrame = now;
    if (ready && playing && traffic && !document.hidden) {
      if (liveMode) {
        if (playbackLead()) {
          t = Math.min(traffic.frontier, t + dt * playbackRate);
          desiredTarget = t + playbackLead();
          if ((traffic.halt || liveError) && t >= traffic.frontier)
            playing = false;
          if (
            trafficRefreshDue() ||
            t > run!.window.end ||
            t > run!.traffic!.frontier
          )
            refreshTraffic();
        } else
          desiredTarget = Math.min(
            traffic.frontier + 1,
            Math.max(traffic.frontier, desiredTarget) + dt * playbackRate,
          );
        requestTraffic(desiredTarget);
      } else {
        t = Math.max(
          traffic.oldest,
          Math.min(traffic.frontier, t + dt * playbackRate),
        );
        if (
          (playbackRate < 0 && t <= traffic.oldest) ||
          ((traffic.halt || liveError) && t >= traffic.frontier)
        )
          playing = false;
        else if (playbackRate > 0 && t >= liveEdge()) {
          traffic.release();
          desiredTarget = t + playbackLead();
          liveMode = true;
        }
        if (
          trafficRefreshDue() ||
          (playbackLead() &&
            (t > run!.window.end || t > run!.traffic!.frontier))
        )
          refreshTraffic();
      }
    }
    if (ready && playing && !traffic) {
      t = Math.max(
        start(),
        Math.min(
          end(),
          t + dt * playbackRate * (run?.playback?.rateScale ?? 1),
        ),
      );
      if (
        (playbackRate > 0 && t >= end()) ||
        (playbackRate < 0 && t <= start())
      ) {
        if (replay) t = playbackRate > 0 ? start() : end();
        else playing = false;
      }
    }
    if (ready && trafficDirty && trafficRefreshDue()) refreshTraffic();
  }
  function togglePlay() {
    if (!ready) return;
    if (!playbackRate) playbackRate = resumeRate;
    if (!traffic && !playing) {
      if (playbackRate > 0 && t >= end()) t = start();
      else if (playbackRate < 0 && t <= start()) t = end();
    }
    playing = !playing;
    if (traffic && (!playing || playbackRate < 0)) {
      liveMode = false;
      refreshTraffic();
    }
    lastFrame = performance.now();
    changed("controls");
  }
  function setSpeed(rate: number) {
    const centered = playbackRate === 0;
    playbackRate = rate;
    if (rate) {
      resumeRate = rate;
      if (centered && ready) playing = true;
    } else playing = false;
    if (traffic && rate <= 0) {
      liveMode = false;
      if (ready) refreshTraffic();
    }
    lastFrame = performance.now();
    changed("controls");
  }
  function suspend() {
    lastFrame = performance.now();
    if (traffic) {
      playing = false;
      liveMode = false;
      changed("controls");
    }
  }
  return {
    get run() {
      return run;
    },
    get revision() {
      return revision;
    },
    get traffic() {
      return traffic;
    },
    get pending() {
      return pending;
    },
    get sequence() {
      return sequence;
    },
    get liveMode() {
      return liveMode;
    },
    get liveError() {
      return liveError;
    },
    get events() {
      return events;
    },
    get t() {
      return t;
    },
    get playing() {
      return playing;
    },
    get ready() {
      return ready;
    },
    get currentSet() {
      return currentSet;
    },
    get playbackRate() {
      return playbackRate;
    },
    get resumeRate() {
      return resumeRate;
    },
    start,
    end,
    cursorEnd,
    playbackLead,
    liveEdge,
    refreshTraffic,
    loadSet,
    seek,
    goLive,
    advance,
    togglePlay,
    setSpeed,
    suspend,
    dispose() {
      revision++;
      worker?.terminate();
      worker = undefined;
      traffic = undefined;
      run = undefined;
      ready = false;
      playing = false;
    },
  };
}
export type SceneSession = ReturnType<typeof createSceneSession>;

/** Read-only coherent presentation shared by every viewport. */
export type ScenePresentation = Pick<
  SceneSession,
  "run" | "ready" | "events" | "t" | "currentSet" | "start" | "end" | "revision"
>;
