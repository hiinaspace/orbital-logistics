import { bodyState, certifiedCoast, rk4 } from './dynamics';
import { portState, logisticsResult, copyLogistics, type LogisticsState } from './logistics';
import { MODEL, parseBundle, validateBundle, type Bundle, type State } from './schema';

export type Status = 'running' | 'horizon' | 'collision' | 'unsupported-approach' | 'burn-rejected' | 'work-limit' | 'operation-rejected';
export interface LedgerEntry {
  t: number; kind: 'burn' | 'burn-rejected' | 'collision' | 'unsupported-approach' | 'work-limit' | 'dock' | 'undock' | 'transfer-start' | 'transfer' | 'operation-rejected';
  id: string; deltaV: number; fuelUsed: number; propellantBefore: number; propellantAfter: number;
  portId?: string; cargoBefore?: number; cargoAfter?: number; portCargoBefore?: number; portCargoAfter?: number;
  portPropellantBefore?: number; portPropellantAfter?: number; detail?: string;
}
export interface Sample {
  t: number; y: State; propellant: number; burnCursor: number; status: Status; detail: string; logistics?: LogisticsState;
}
export interface CoastSegment { t0: number; y0: State; t1: number; y1: State }
interface Node extends Sample { nextGridIndex: number }
export interface Snapshot {
  schemaVersion: 1; modelVersion: typeof MODEL; requestedEpoch: number;
  anchor: Node; ledger: LedgerEntry[];
}
const clone = <T>(value: T): T => structuredClone(value);
function orderedJSON(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

export class Runner {
  // Private ownership prevents view code and callers from changing the model.
  readonly #bundle: Bundle;
  #nodes: Node[] = [];
  #ledger: LedgerEntry[] = [];
  #requestedEpoch: number;
  constructor(value: Bundle) {
    this.#bundle = validateBundle(value);
    const s = this.#bundle.scenario;
    this.#requestedEpoch = s.epoch;
    this.#nodes.push({ t: s.epoch, y: [...s.ship.state], propellant: s.ship.propellant,
      burnCursor: 0, nextGridIndex: 1, status: 'running', detail: '',
      ...(s.logistics ? {logistics: {operationCursor: 0, cargoMass: s.ship.cargoMass, fuelUsed: 0, ports: s.logistics.ports.map(p => ({id: p.id, cargo: p.cargo, propellant: p.propellant}))}} : {}) });
    for (const body of s.bodies) {
      const b = bodyState(body, s.epoch), y = s.ship.state;
      if (Math.hypot(y[0] - b[0], y[1] - b[1]) <= body.radius) {
        this.#stop('collision', body.id); break;
      }
    }
    this.#applyEvents();
  }
  get bundle(): Bundle { return clone(this.#bundle); }
  get retainedNodes(): number { return this.#nodes.length; }
  get ledger(): LedgerEntry[] { return clone(this.#ledger.filter(e => e.t <= this.current.t)); }
  get current(): Sample { return this.sample(this.#requestedEpoch); }
  #last(): Node { return this.#nodes[this.#nodes.length - 1]; }
  #stop(kind: 'collision' | 'unsupported-approach' | 'work-limit', id: string): void {
    const n = this.#last(); n.status = kind; n.detail = id;
    this.#ledger.push({ t: n.t, kind, id, deltaV: 0, fuelUsed: 0,
      propellantBefore: n.propellant, propellantAfter: n.propellant });
  }
  #applyBurn(): void {
    const n = this.#last(), s = this.#bundle.scenario, b = this.#bundle.program.burns[n.burnCursor];
    if (n.status !== 'running' || !b || b.t !== n.t) return;
    if (n.logistics?.dockedPortId) { this.#rejectOperation(b.id, 'Undock before a burn'); return; }
    const ref = bodyState(s.bodies.find(body => body.id === b.referenceBodyId)!, n.t);
    const dx = n.y[0] - ref[0], dy = n.y[1] - ref[1], r = Math.hypot(dx, dy);
    const deltaV = Math.hypot(b.radial, b.transverse);
    const mass = s.ship.dryMass + (n.logistics?.cargoMass ?? s.ship.cargoMass) + n.propellant;
    const used = mass * -Math.expm1(-deltaV / s.ship.exhaustVelocity);
    const before = n.propellant;
    const vx = n.y[2] + (b.radial * dx - b.transverse * dy) / r;
    const vy = n.y[3] + (b.radial * dy + b.transverse * dx) / r;
    if (!Number.isFinite(used + vx + vy) || used > before) {
      n.status = 'burn-rejected'; n.detail = b.id;
      this.#ledger.push({ t: n.t, kind: 'burn-rejected', id: b.id, deltaV, fuelUsed: 0,
        propellantBefore: before, propellantAfter: before });
      return;
    }
    n.y = [n.y[0], n.y[1], vx, vy]; n.propellant -= used; n.burnCursor++;
    if (n.logistics) n.logistics.fuelUsed += used;
    this.#ledger.push({ t: n.t, kind: 'burn', id: b.id, deltaV, fuelUsed: used,
      propellantBefore: before, propellantAfter: n.propellant });
  }
  #rejectOperation(id: string, detail: string): void {
    const n = this.#last(); n.status = 'operation-rejected'; n.detail = `${id}: ${detail}`;
    this.#ledger.push({t: n.t, kind: 'operation-rejected', id, deltaV: 0, fuelUsed: 0, propellantBefore: n.propellant, propellantAfter: n.propellant, detail});
  }
  #applyEvents(): void {
    const n = this.#last(), s = this.#bundle.scenario, l = n.logistics, spec = s.logistics;
    if (n.status !== 'running') return;
    if (!l || !spec) { this.#applyBurn(); return; }
    // Fixed simultaneous order: completion, undock, burn, dock, transfer start.
    if (l.service?.end === n.t) {
      const service = l.service, port = l.ports.find(p => p.id === service.portId)!;
      this.#ledger.push({t: n.t, kind: 'transfer', id: service.id, portId: port.id, deltaV: 0, fuelUsed: 0,
        propellantBefore: n.propellant, propellantAfter: n.propellant + service.propellant,
        cargoBefore: l.cargoMass, cargoAfter: l.cargoMass + service.cargo, portCargoBefore: port.cargo, portCargoAfter: port.cargo - service.cargo,
        portPropellantBefore: port.propellant, portPropellantAfter: port.propellant - service.propellant});
      l.cargoMass += service.cargo; port.cargo -= service.cargo;
      n.propellant += service.propellant; port.propellant -= service.propellant; delete l.service;
    }
    const operations = this.#bundle.program.operations ?? [];
    const operate = () => {
      const op = operations[l.operationCursor], port = spec.ports.find(p => p.id === op.portId)!;
      if (l.service) { this.#rejectOperation(op.id, `Service ${l.service.id} finishes at t ${l.service.end.toFixed(3)}`); return; }
      if (op.kind === 'dock') {
        if (l.dockedPortId) { this.#rejectOperation(op.id, `Already docked at ${l.dockedPortId}`); return; }
        const y = portState(port, n.t), distance = Math.hypot(n.y[0] - y[0], n.y[1] - y[1]), speed = Math.hypot(n.y[2] - y[2], n.y[3] - y[3]);
        if (distance > spec.capture.position || speed > spec.capture.velocity) {
          this.#rejectOperation(op.id, `Capture ${port.id}: miss ${distance.toExponential(2)}, speed ${speed.toExponential(2)}`); return;
        }
        const used = (s.ship.dryMass + l.cargoMass + n.propellant) * -Math.expm1(-speed / s.ship.exhaustVelocity);
        if (used > n.propellant || !Number.isFinite(used)) { this.#rejectOperation(op.id, 'Not enough fuel for capture residual'); return; }
        const before = n.propellant; n.propellant -= used; l.fuelUsed += used;
        // Explicit constrained-port interface: bounded position attachment and a
        // fully charged residual velocity impulse. There is no free capture burn.
        n.y = y; l.dockedPortId = port.id;
        this.#ledger.push({t: n.t, kind: 'dock', id: op.id, portId: port.id, deltaV: speed, fuelUsed: used, propellantBefore: before, propellantAfter: n.propellant});
      } else if (l.dockedPortId !== port.id) { this.#rejectOperation(op.id, `Dock at ${port.id} first`); return; }
      else if (op.kind === 'undock') {
        delete l.dockedPortId;
        this.#ledger.push({t: n.t, kind: 'undock', id: op.id, portId: port.id, deltaV: 0, fuelUsed: 0, propellantBefore: n.propellant, propellantAfter: n.propellant});
      } else {
        const stock = l.ports.find(p => p.id === port.id)!, cargo = l.cargoMass + op.cargo, portCargo = stock.cargo - op.cargo;
        const fuel = n.propellant + op.propellant, portFuel = stock.propellant - op.propellant;
        if (cargo < 0 || cargo > spec.cargoCapacity || portCargo < 0 || portCargo > port.cargoCapacity || fuel > s.ship.tankCapacity || portFuel < 0 || !Number.isFinite(s.ship.dryMass + cargo + fuel)) {
          this.#rejectOperation(op.id, 'Transfer exceeds cargo, fuel stock or capacity'); return;
        }
        l.service = {id: op.id, portId: port.id, end: n.t + port.serviceDuration, cargo: op.cargo, propellant: op.propellant};
        this.#ledger.push({t: n.t, kind: 'transfer-start', id: op.id, portId: port.id, deltaV: 0, fuelUsed: 0, propellantBefore: n.propellant, propellantAfter: n.propellant});
      }
      l.operationCursor++;
    };
    while (operations[l.operationCursor]?.t === n.t && operations[l.operationCursor].kind === 'undock' && n.status === 'running') operate();
    this.#applyBurn();
    while (operations[l.operationCursor]?.t === n.t && n.status === 'running') operate();
    if (logisticsResult(spec, l, n.propellant, n.t).complete) l.completedAt ??= n.t; else delete l.completedAt;
  }
  #coast(end: number, depth = 0): boolean {
    const n = this.#last(), s = this.#bundle.scenario, dt = end - n.t;
    if (this.#nodes.length >= s.policy.maxNodes) { this.#stop('work-limit', 'retained-node budget'); return false; }
    if (n.logistics?.dockedPortId) {
      const port = s.logistics!.ports.find(p => p.id === n.logistics!.dockedPortId)!;
      this.#nodes.push({...n, logistics: copyLogistics(n.logistics), t: end, y: portState(port, end)}); return true;
    }
    if (!certifiedCoast(s, n.t, n.y, dt)) {
      if (depth >= s.policy.maxSubdivision || n.t + dt / 2 === n.t) {
        this.#stop('unsupported-approach', 'clearance certificate exhausted'); return false;
      }
      const middle = n.t + dt / 2;
      return this.#coast(middle, depth + 1) && this.#coast(end, depth + 1);
    }
    const y = rk4(s, n.t, n.y, dt);
    if (y.some(v => !Number.isFinite(v))) { this.#stop('unsupported-approach', 'nonfinite propagation'); return false; }
    this.#nodes.push({ ...n, ...(n.logistics ? {logistics: copyLogistics(n.logistics)} : {}), t: end, y });
    return true;
  }
  #ensure(t: number): void {
    const s = this.#bundle.scenario;
    while (this.#last().t <= t && this.#last().status === 'running') {
      const n = this.#last(), grid = s.epoch + n.nextGridIndex * s.policy.step;
      const burn = this.#bundle.program.burns[n.burnCursor];
      const operation = this.#bundle.program.operations?.[n.logistics?.operationCursor ?? 0];
      const end = Math.min(grid, burn?.t ?? Infinity, operation?.t ?? Infinity, n.logistics?.service?.end ?? Infinity, s.epoch + s.duration);
      if (!this.#coast(end)) break;
      if (end === grid) this.#last().nextGridIndex++;
      this.#applyEvents();
      if (this.#last().status === 'running' && end === s.epoch + s.duration) this.#last().status = 'horizon';
    }
  }
  #index(t: number): number {
    let lo = 0, hi = this.#nodes.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (this.#nodes[mid].t <= t) lo = mid; else hi = mid - 1;
    }
    return lo;
  }
  sample(t: number): Sample {
    const s = this.#bundle.scenario;
    if (!Number.isFinite(t) || t < s.epoch || t > s.epoch + s.duration) throw new Error('Epoch outside scenario');
    // Compute the entire canonical interval, including deterministic safety
    // subdivisions. Never retain a request-dependent partial endpoint.
    this.#ensure(t);
    const last = this.#last();
    if (t > last.t) t = last.t; // Terminated forecasts have no continuation.
    const n = this.#nodes[this.#index(t)];
    const y = n.logistics?.dockedPortId ? portState(s.logistics!.ports.find(p => p.id === n.logistics!.dockedPortId)!, t) : t === n.t ? [...n.y] as State : rk4(s, n.t, n.y, t - n.t);
    return { t, y, propellant: n.propellant, burnCursor: n.burnCursor, status: n.status, detail: n.detail, ...(n.logistics ? {logistics: copyLogistics(n.logistics)} : {}) };
  }
  advanceTo(t: number): Sample { const result = this.sample(t); this.#requestedEpoch = t; return result; }
  advance(dt: number): Sample {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Invalid advance duration');
    return this.advanceTo(Math.min(this.#requestedEpoch + dt, this.#bundle.scenario.epoch + this.#bundle.scenario.duration));
  }
  seek(t: number): Sample { return this.advanceTo(t); }
  // Continuous coast brackets, with pre-impulse endpoints. Event diagnostics
  // use these canonical brackets, never decimated display samples or burn jumps.
  coastSegments(horizon: number): CoastSegment[] {
    this.sample(horizon);
    const segments: CoastSegment[] = [];
    for (let i = 1; i < this.#nodes.length; i++) {
      const a = this.#nodes[i - 1], b = this.#nodes[i];
      if (a.t >= horizon || a.status !== 'running') break;
      if (a.logistics?.dockedPortId) continue;
      const end = Math.min(b.t, horizon);
      segments.push({ t0: a.t, y0: [...a.y], t1: end,
        y1: end === b.t && a.burnCursor === b.burnCursor && a.logistics?.operationCursor === b.logistics?.operationCursor ? [...b.y] : rk4(this.#bundle.scenario, a.t, a.y, end - a.t) });
    }
    return segments;
  }
  reset(): Sample { this.#requestedEpoch = this.#bundle.scenario.epoch; return this.current; }
  snapshot(): Snapshot {
    const current = this.current, anchor = this.#nodes[this.#index(current.t)];
    return clone({ schemaVersion: 1, modelVersion: MODEL, requestedEpoch: this.#requestedEpoch,
      anchor, ledger: this.#ledger.filter(e => e.t <= anchor.t) });
  }
  // Saved programs are durable. M0 reload validates a snapshot by forward replay;
  // it never trusts a supplied state, cursor or ledger as authoritative physics.
  static restore(bundle: Bundle, value: unknown): Runner {
    if (!value || typeof value !== 'object') throw new Error('Invalid snapshot');
    const snapshot = value as Snapshot, runner = new Runner(bundle);
    runner.advanceTo(snapshot.requestedEpoch);
    if (orderedJSON(runner.snapshot()) !== orderedJSON(value)) throw new Error('Snapshot does not match deterministic replay');
    return runner;
  }
  serialize(): string { return JSON.stringify({ ...this.bundle, snapshot: this.snapshot() }, null, 2) + '\n'; }
  static deserialize(json: string): Runner {
    const bundle = parseBundle(json), value = JSON.parse(json);
    return value.snapshot === undefined ? new Runner(bundle) : Runner.restore(bundle, value.snapshot);
  }
}
