import {directionAt} from './steering';
import {forceSensitivityStep} from './sensitivity';
import {paidCapture,CaptureFailure} from './capture';
import {resolveBurn} from './burns';
import {distance, relativeSpeed, norm, dot} from './vectors';
import { bodyState, bodyAcceleration, certifiedCoast, derivative } from './dynamics';
import { portState, logisticsResult, copyLogistics, type LogisticsState } from './logistics';
import { MODEL, parseBundle, validateBundle, type Bundle, type State } from './schema';
import {intervalStep,massLaw,massAt,thrustAt,thrustBound,propulsiveDeltaV,type MassLaw} from './propulsion';

export type Status = 'running' | 'horizon' | 'collision' | 'unsupported-approach' | 'burn-rejected' | 'work-limit' | 'operation-rejected' | 'fuel-depleted';
export interface LedgerEntry {
  t: number; kind: 'burn' | 'burn-rejected' | 'collision' | 'unsupported-approach' | 'work-limit' | 'dock' | 'land' | 'undock' | 'launch' | 'transfer-start' | 'transfer' | 'operation-rejected' | 'thrust-start' | 'thrust-end' | 'fuel-depleted';
  id: string; deltaV: number; fuelUsed: number; propellantBefore: number; propellantAfter: number;
  portId?: string; cargoBefore?: number; cargoAfter?: number; portCargoBefore?: number; portCargoAfter?: number;
  portPropellantBefore?: number; portPropellantAfter?: number; detail?: string; positionError?: number;
}
export interface Sample {
  t: number; y: State; propellant: number; burnCursor: number; status: Status; detail: string; logistics?: LogisticsState;
  fuelUsed?:number; thrust?:{id:string;force:number;acceleration:number;direction:[number,number,number]};
}
export interface EventBoundary {t: number; before: Sample; after: Sample}
export interface CoastSegment { t0: number; y0: State; t1: number; y1: State; massLaw?:MassLaw }
interface ActiveThrust {index:number;law:MassLaw;fuelBefore:number;usageBefore:number}
interface Node extends Sample { nextGridIndex: number; thrustCursor?:number; activeThrust?:ActiveThrust }
export interface Snapshot {
  schemaVersion: 3; modelVersion: typeof MODEL; requestedEpoch: number;
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
  #boundaries: EventBoundary[] = [];
  #portRunners=new Map<string,Runner>();
  #requestedEpoch: number;
  constructor(value: unknown) {
    this.#bundle = validateBundle(value);
    const s = this.#bundle.scenario;
    this.#requestedEpoch = s.epoch;
    this.#nodes.push({ t: s.epoch, y: [...s.ship.state], propellant: s.ship.propellant,
      burnCursor: 0, nextGridIndex: 1, status: 'running', detail: '',
      ...(this.#bundle.program.thrustArcs?{thrustCursor:0,fuelUsed:0}:{}),
      ...(s.logistics ? {logistics: {operationCursor: 0, cargoMass: s.ship.cargoMass, fuelUsed: 0, ports: s.logistics.ports.map(p => ({id: p.id, cargo: p.cargo, propellant: p.propellant}))}} : {}) });
    for(const port of s.logistics?.ports??[]) {
      if(port.rail.kind!=='ballistic' && port.rail.kind!=='powered')continue;
      const rail=port.rail, scenario=clone(s);delete scenario.logistics;delete scenario.rendezvous;
      scenario.epoch=rail.epoch;scenario.duration=rail.validUntil-rail.epoch;scenario.policy=clone(rail.policy);
      scenario.bodies.forEach(b=>b.radius+=rail.minClearance);
      scenario.ship={id:port.id,state:[...rail.state],dryMass:1,cargoMass:0,propellant:0,tankCapacity:0,exhaustVelocity:1};
      if(rail.kind==='powered')scenario.ship={...clone(rail.propulsion),id:port.id,state:[...rail.state],cargoMass:0};
      const target=new Runner({scenario,program:rail.kind==='powered'?clone(rail.program):{schemaVersion:3,id:'ballistic-station-coast-v2',burns:[]}});
      const terminal=target.advanceTo(rail.validUntil);
      if(terminal.status!=='horizon' || terminal.t!==rail.validUntil || rail.kind==='powered' && terminal.propellant<rail.minPropellant)throw new Error(`Unsafe ${rail.kind} station ${port.id}: ${terminal.status} ${terminal.detail}`);
      this.#portRunners.set(port.id,target);
    }
    for (const body of s.bodies) {
      const b = bodyState(body, s.epoch), y = s.ship.state;
      if (distance(y,b) <= body.radius) {
        this.#stop('collision', body.id); break;
      }
    }
    this.#applyEvents();
  }
  // Dedicated canonical, burn-free targets. Drawing interpolation is never used
  // for capture/dwell/undock, and the full validity interval was safety certified.
  portState(id:string,t:number):State {
    const scenario=this.#bundle.scenario;
    if(!Number.isFinite(t)||t<scenario.epoch||t>scenario.epoch+scenario.duration)throw new Error('Epoch outside scenario');
    const port=this.#bundle.scenario.logistics?.ports.find(p=>p.id===id);
    if(!port)throw new Error('Unknown port');
    return port.rail.kind==='ballistic'||port.rail.kind==='powered' ? this.portSample(id,t).y : portState(port,t);
  }
  portSample(id:string,t:number):Sample {
    const target=this.#portRunners.get(id);if(!target || !Number.isFinite(t) || t<this.#bundle.scenario.epoch || t>this.#bundle.scenario.epoch+this.#bundle.scenario.duration)throw new Error('Invalid canonical target query');
    const sample=target.sample(t);if(sample.t!==t || !['running','horizon'].includes(sample.status))throw new Error('Target has no valid physical state');return sample;
  }
  portBoundaries(id:string):EventBoundary[]{const target=this.#portRunners.get(id);if(!target)throw new Error('Unknown trajectory target');return target.eventBoundaries;}
  portLedger(id:string):LedgerEntry[]{const target=this.#portRunners.get(id);if(!target)throw new Error('Unknown trajectory target');return target.ledger;}
  get bundle(): Bundle { return clone(this.#bundle); }
  get eventBoundaries(): EventBoundary[] { return clone(this.#boundaries.filter(e=>e.t<=this.current.t)); }
  get retainedNodes(): number { return this.#nodes.length; }
  // Diagnostic serialization size of this runner's owned data, not JS heap
  // allocation or child ephemerides. Query sparingly, after preparation.
  ownStorageBytes():number {return new TextEncoder().encode(JSON.stringify({bundle:this.#bundle,nodes:this.#nodes,ledger:this.#ledger,boundaries:this.#boundaries})).byteLength;}
  get retainedTreeNodes():number{return this.retainedNodes+[...this.#portRunners.values()].reduce((n,r)=>n+r.retainedTreeNodes,0);}
  treeStorageBytes():number{return this.ownStorageBytes()+[...this.#portRunners.values()].reduce((n,r)=>n+r.treeStorageBytes(),0);}
  get ledger(): LedgerEntry[] { return clone(this.#ledger.filter(e => e.t <= this.current.t)); }
  get current(): Sample { return this.sample(this.#requestedEpoch); }
  #last(): Node { return this.#nodes[this.#nodes.length - 1]; }
  #stop(kind: 'collision' | 'unsupported-approach' | 'work-limit', id: string): void {
    const n = this.#last(); this.#closeThrust(kind); n.status = kind; n.detail = id;
    this.#ledger.push({ t: n.t, kind, id, deltaV: 0, fuelUsed: 0,
      propellantBefore: n.propellant, propellantAfter: n.propellant });
  }
  #applyBurn(): void {
    const n = this.#last(), s = this.#bundle.scenario, b = this.#bundle.program.burns[n.burnCursor];
    if (n.status !== 'running' || !b || b.t !== n.t) return;
    if (n.logistics?.dockedPortId) { this.#rejectOperation(b.id, 'Undock before a burn'); return; }
    const ref = bodyState(s.bodies.find(body => body.id === b.referenceBodyId)!, n.t);
    let dv: [number,number,number];
    try {dv=resolveBurn(b,n.y,ref);} catch(error) {
      n.status='burn-rejected'; n.detail=`${b.id}: ${(error as Error).message}`;
      this.#ledger.push({t:n.t,kind:'burn-rejected',id:b.id,deltaV:0,fuelUsed:0,propellantBefore:n.propellant,propellantAfter:n.propellant});return;
    }
    const deltaV = norm(dv);
    const mass = s.ship.dryMass + (n.logistics?.cargoMass ?? s.ship.cargoMass) + n.propellant;
    const used = mass * -Math.expm1(-deltaV / s.ship.exhaustVelocity);
    const before = n.propellant;
    const v = [n.y[3]+dv[0],n.y[4]+dv[1],n.y[5]+dv[2]];
    if (!Number.isFinite(used) || !v.every(Number.isFinite) || used > before) {
      n.status = 'burn-rejected'; n.detail = b.id;
      this.#ledger.push({ t: n.t, kind: 'burn-rejected', id: b.id, deltaV, fuelUsed: 0,
        propellantBefore: before, propellantAfter: before });
      return;
    }
    n.y = [n.y[0], n.y[1], n.y[2], v[0],v[1],v[2]]; n.propellant -= used; n.burnCursor++;
    if (n.logistics) n.logistics.fuelUsed += used;
    if(n.fuelUsed!==undefined)n.fuelUsed+=used;
    this.#ledger.push({ t: n.t, kind: 'burn', id: b.id, deltaV, fuelUsed: used,
      propellantBefore: before, propellantAfter: n.propellant });
  }
  #rejectOperation(id: string, detail: string): void {
    const n = this.#last(); this.#closeThrust('operation-rejected'); n.status = 'operation-rejected'; n.detail = `${id}: ${detail}`;
    this.#ledger.push({t: n.t, kind: 'operation-rejected', id, deltaV: 0, fuelUsed: 0, propellantBefore: n.propellant, propellantAfter: n.propellant, detail});
  }
  #applyEvents(): void {
    const n=this.#last();
    const arc=this.#bundle.program.thrustArcs?.[n.thrustCursor??0],active=n.activeThrust;
    if(this.#bundle.program.burns[n.burnCursor]?.t!==n.t &&
      this.#bundle.program.operations?.[n.logistics?.operationCursor??0]?.t!==n.t && n.logistics?.service?.end!==n.t &&
      arc?.start!==n.t && !(active && (this.#bundle.program.thrustArcs![active.index].end===n.t || active.law.depletionEpoch===n.t)))return;
    const before=clone(n), cursor=this.#ledger.length;
    this.#performEvents();
    if(this.#ledger.length!==cursor) {
      const sample = ({nextGridIndex: _grid,activeThrust:_active,thrustCursor:_cursor, ...s}: Node): Sample => s;
      this.#boundaries.push({t:n.t,before:sample(before),after:sample(clone(n))});
    }
  }
  #performEvents(): void {
    const n = this.#last(), s = this.#bundle.scenario, l = n.logistics, spec = s.logistics;
    if (n.status !== 'running') return;
    if(n.activeThrust) {
      const arc=this.#bundle.program.thrustArcs![n.activeThrust.index];
      if(n.t===arc.end)this.#closeThrust('completed');
      else if(n.t===n.activeThrust.law.depletionEpoch){this.#closeThrust('fuel-depleted');n.status='fuel-depleted';n.detail=arc.id;return;}
    }
    if (!l || !spec) { this.#applyBurn(); this.#startThrust(); return; }
    // End thrust, completion, undock, impulse, dock, transfer start, start thrust.
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
      if (op.kind === 'dock' || op.kind==='land') {
        if (l.dockedPortId) { this.#rejectOperation(op.id, `Already docked at ${l.dockedPortId}`); return; }
        if(port.rail.kind==='powered' && port.rail.program.thrustArcs!.some(a=>a.throttle>0&&n.t>=a.start&&n.t<a.end)){this.#rejectOperation(op.id,'Capture during station maintenance');return;}
        const y = this.portState(port.id, n.t);
        if(op.kind==='dock' && port.rail.kind==='surface' && (n.t!==s.epoch || n.y.some((v,i)=>v!==y[i]))) {
          this.#rejectOperation(op.id,'Surface attachment requires exact initial pad state; use land for later arrival');return;
        }
        let positionTolerance=spec.capture.position;
        if(op.kind==='land') {
          if(port.rail.kind!=='surface' || n.activeThrust){this.#rejectOperation(op.id,'Landing requires surface support and ended thrust');return;}
          const rail=port.rail,body=s.bodies.find(b=>b.id===rail.bodyId)!;
          const clearance=distance(y,bodyState(body,n.t))-body.radius;
          positionTolerance=Math.min(positionTolerance,clearance/4);
          if(!Number.isFinite(clearance) || clearance<=0){this.#rejectOperation(op.id,'Invalid landing support clearance');return;}
        }
        let capture;
        try{capture=paidCapture(n.y,y,{dryMass:s.ship.dryMass,cargoMass:l.cargoMass,propellant:n.propellant,exhaustVelocity:s.ship.exhaustVelocity},{position:positionTolerance,velocity:spec.capture.velocity},port.id);}
        catch(error){if(!(error instanceof CaptureFailure))throw error;this.#rejectOperation(op.id,error.message);return;}
        n.propellant=capture.propellantAfter;l.fuelUsed+=capture.fuelUsed;
        if(n.fuelUsed!==undefined)n.fuelUsed+=capture.fuelUsed;
        // Explicit constrained-port interface: all residual velocity matching is paid.
        n.y=capture.y;l.dockedPortId=port.id;
        this.#ledger.push({t:n.t,kind:op.kind,id:op.id,portId:port.id,positionError:capture.positionError,deltaV:capture.deltaV,fuelUsed:capture.fuelUsed,propellantBefore:capture.propellantBefore,propellantAfter:capture.propellantAfter});
      } else if (l.dockedPortId !== port.id) { this.#rejectOperation(op.id, `Dock at ${port.id} first`); return; }
      else if(op.kind==='launch') {
        const index=n.thrustCursor??0,arc=this.#bundle.program.thrustArcs?.[index];
        if(port.rail.kind!=='surface' || !arc || arc.id!==op.thrustArcId || arc.start!==n.t || n.activeThrust) {
          this.#rejectOperation(op.id,'Launch requires its next powered arc and surface support');return;
        }
        const law=massLaw(s.ship.engine!,arc,s.ship.dryMass+l.cargoMass,n.propellant,s.ship.exhaustVelocity);
        const surface=port.rail;
        const force=thrustAt(law,n.t),body=s.bodies.find(b=>b.id===surface.bodyId)!;
        const b=bodyState(body,n.t),r=distance(n.y,b),normal=n.y.slice(0,3).map((x,i)=>(x-b[i])/r);
        const bodyA=bodyAcceleration(body,n.t),gravity=derivative(s,n.t,n.y).slice(3).map((x,i)=>x-bodyA[i]),outward=force/massAt(law,n.t)*dot(directionAt(arc,0),normal as [number,number,number]);
        const relative=n.y.slice(3).map((v,i)=>v-b[i+3]),radialSpeed=dot(relative as [number,number,number],normal as [number,number,number]);
        const tangentialSquared=relative.reduce((n,v)=>n+v*v,0)-radialSpeed**2;
        const radial=outward+dot(gravity as [number,number,number],normal as [number,number,number])+Math.max(0,tangentialSquared)/r;
        // Relative radial-distance acceleration, not an extra inertial force.
        const margin=1e-12*Math.max(1,body.mu/r**2,outward);
        if(n.propellant<=0 || force<=0 || !Number.isFinite(radial) || radial<=margin) {
          this.#rejectOperation(op.id,'Insufficient outward acceleration to leave support');return;
        }
        // All checks precede this atomic release + first mass-law activation.
        delete l.dockedPortId;
        n.activeThrust={index,law,fuelBefore:n.propellant,usageBefore:n.fuelUsed??0};n.thrustCursor=index+1;
        this.#ledger.push({t:n.t,kind:'launch',id:op.id,portId:port.id,deltaV:0,fuelUsed:0,propellantBefore:n.propellant,propellantAfter:n.propellant});
        this.#ledger.push({t:n.t,kind:'thrust-start',id:arc.id,deltaV:0,fuelUsed:0,propellantBefore:n.propellant,propellantAfter:n.propellant});
      }
      else if (op.kind === 'undock') {
        if(port.rail.kind==='surface'){this.#rejectOperation(op.id,'Use powered launch to leave surface support');return;}
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
    while (operations[l.operationCursor]?.t === n.t && (operations[l.operationCursor].kind === 'undock' || operations[l.operationCursor].kind==='launch') && n.status === 'running') operate();
    this.#applyBurn();
    while (operations[l.operationCursor]?.t === n.t && n.status === 'running') operate();
    this.#startThrust();
    if (logisticsResult(spec, l, n.propellant, n.t).complete) l.completedAt ??= n.t; else delete l.completedAt;
  }
  #startThrust():void {
    const n=this.#last(),s=this.#bundle.scenario,index=n.thrustCursor??0,arc=this.#bundle.program.thrustArcs?.[index];
    if(n.status!=='running' || !arc || arc.start!==n.t)return;
    if(n.logistics?.dockedPortId || n.logistics?.service){this.#rejectOperation(arc.id,'Undock before powered flight');return;}
    const law=massLaw(s.ship.engine!,arc,s.ship.dryMass+(n.logistics?.cargoMass??s.ship.cargoMass),n.propellant,s.ship.exhaustVelocity);
    n.activeThrust={index,law,fuelBefore:n.propellant,usageBefore:n.fuelUsed??0};n.thrustCursor=index+1;
    this.#ledger.push({t:n.t,kind:'thrust-start',id:arc.id,deltaV:0,fuelUsed:0,propellantBefore:n.propellant,propellantAfter:n.propellant});
    if(law.depletionEpoch===n.t && arc.end>n.t){this.#closeThrust('fuel-depleted');n.status='fuel-depleted';n.detail=arc.id;}
  }
  #closeThrust(reason:string):void {
    const n=this.#last(),active=n.activeThrust;if(!active)return;
    const arc=this.#bundle.program.thrustArcs![active.index];
    this.#ledger.push({t:n.t,kind:reason==='fuel-depleted'?'fuel-depleted':'thrust-end',id:arc.id,
      deltaV:propulsiveDeltaV(active.law,n.t),fuelUsed:active.fuelBefore-n.propellant,
      propellantBefore:active.fuelBefore,propellantAfter:n.propellant,detail:reason});
    delete n.activeThrust;
  }
  #interval(n:Node,end:number):{y:State;propellant:number;fuelUsed?:number} {
    const active=n.activeThrust;
    const y=end===n.t || n.logistics?.dockedPortId?[...n.y] as State:intervalStep(this.#bundle.scenario,n.t,n.y,end-n.t,active?.law);
    const propellant=active?massAt(active.law,end)-active.law.nonfuel:n.propellant;
    return {y,propellant,...(n.fuelUsed!==undefined?{fuelUsed:active?active.usageBefore+active.fuelBefore-propellant:n.fuelUsed}:{})};
  }
  segmentState(segment:CoastSegment,t:number):State {
    if(!Number.isFinite(t) || t<segment.t0 || t>segment.t1)throw new Error('Epoch outside segment');
    return intervalStep(this.#bundle.scenario,segment.t0,segment.y0,t-segment.t0,segment.massLaw);
  }
  #coast(end: number, depth = 0): boolean {
    const n = this.#last(), s = this.#bundle.scenario, dt = end - n.t;
    if (this.#nodes.length >= s.policy.maxNodes) { this.#stop('work-limit', 'retained-node budget'); return false; }
    if (n.logistics?.dockedPortId) {
      const port = s.logistics!.ports.find(p => p.id === n.logistics!.dockedPortId)!;
      this.#nodes.push({...n, logistics: copyLogistics(n.logistics), t: end, y: this.portState(port.id, end)}); return true;
    }
    if (!certifiedCoast(s, n.t, n.y, dt,thrustBound(n.activeThrust?.law))) {
      if (depth >= s.policy.maxSubdivision || n.t + dt / 2 === n.t) {
        this.#stop('unsupported-approach', 'clearance certificate exhausted'); return false;
      }
      const middle = n.t + dt / 2;
      return this.#coast(middle, depth + 1) && this.#coast(end, depth + 1);
    }
    const propagated=this.#interval(n,end),y=propagated.y;
    if (y.some(v => !Number.isFinite(v))) { this.#stop('unsupported-approach', 'nonfinite propagation'); return false; }
    const next={ ...n, ...(n.logistics ? {logistics: copyLogistics(n.logistics)} : {}),...propagated,t: end };
    if(next.logistics && n.activeThrust)next.logistics.fuelUsed+=(next.fuelUsed!-n.fuelUsed!);
    this.#nodes.push(next);
    return true;
  }
  #ensure(t: number): void {
    const s = this.#bundle.scenario;
    while (this.#last().t <= t && this.#last().status === 'running') {
      const n = this.#last(), grid = s.epoch + n.nextGridIndex * s.policy.step;
      const burn = this.#bundle.program.burns[n.burnCursor];
      const operation = this.#bundle.program.operations?.[n.logistics?.operationCursor ?? 0];
      const active=n.activeThrust,arc=this.#bundle.program.thrustArcs?.[n.thrustCursor??0];
      const end = Math.min(grid, burn?.t ?? Infinity, operation?.t ?? Infinity, n.logistics?.service?.end ?? Infinity, s.epoch + s.duration,
        arc?.start??Infinity,active?this.#bundle.program.thrustArcs![active.index].end:Infinity,
        ...(active?.law.steering?.keys.map(k=>active.law.epoch+k.offset).filter(epoch=>epoch>n.t)??[]),
        active?.law.depletionEpoch??Infinity,(active?.law.capEpoch??-Infinity)>n.t?active!.law.capEpoch!:Infinity);
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
    const propagated=this.#interval(n,t),y=n.logistics?.dockedPortId?this.portState(n.logistics.dockedPortId,t):propagated.y;
    const logistics=n.logistics?copyLogistics(n.logistics):undefined;
    if(logistics && n.activeThrust)logistics.fuelUsed+=propagated.fuelUsed!-n.fuelUsed!;
    const active=n.activeThrust,arc=active?this.#bundle.program.thrustArcs![active.index]:undefined;
    return { t, ...propagated,y, burnCursor: n.burnCursor, status: n.status, detail: n.detail, ...(logistics ? {logistics} : {}),
      ...(active && n.status==='running'?{thrust:{id:arc!.id,force:thrustAt(active.law,t),acceleration:thrustAt(active.law,t)/massAt(active.law,t)*norm(directionAt(active.law,t-active.law.epoch)),direction:directionAt(active.law,t-active.law.epoch)}}:{}) };
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
        y1: this.#interval(a,end).y,...(a.activeThrust?{massLaw:clone(a.activeThrust.law)}:{}) });
    }
    return segments;
  }
  // Candidate guidance only: differentiate the actual retained RK4 grid and
  // safety subdivisions. This never creates or replaces a physical checkpoint.
  terminalForceJacobian():number[][]|undefined {
    const s=this.#bundle.scenario,arcs=this.#bundle.program.thrustArcs;
    if(this.#last().status!=='horizon'||!arcs||arcs.length!==2||arcs.some(a=>a.steering)||this.#bundle.program.burns.length||s.logistics)return;
    for(const n of this.#nodes){const law=n.activeThrust?.law;if(law&&((law.capEpoch??Infinity)<=arcs[n.activeThrust!.index].end||(law.depletionEpoch??Infinity)<=arcs[n.activeThrust!.index].end))return;}
    let tangent=Array(36).fill(0),massGradient=Array(6).fill(0),anchorGradient=massGradient,pulse=-1;
    for(let i=1;i<this.#nodes.length;i++){
      const a=this.#nodes[i-1],b=this.#nodes[i],active=a.activeThrust,law=active?.law;
      if(active&&pulse!==active.index){pulse=active.index;anchorGradient=[...massGradient];}
      tangent=forceSensitivityStep(s,a.t,a.y,b.t-a.t,law,pulse,anchorGradient,tangent);
      if(law)massGradient=anchorGradient.map((v,j)=>v-(Math.floor(j/3)===pulse?(b.t-law.epoch)*law.direction[j%3]*(law.force?1:0)/law.exhaustVelocity:0));
    }
    return Array.from({length:6},(_,i)=>tangent.slice(i*6,i*6+6));
  }
  reset(): Sample { this.#requestedEpoch = this.#bundle.scenario.epoch; return this.current; }
  snapshot(): Snapshot {
    const current = this.current, anchor = this.#nodes[this.#index(current.t)];
    return clone({ schemaVersion: 3, modelVersion: MODEL, requestedEpoch: this.#requestedEpoch,
      anchor, ledger: this.#ledger.filter(e => e.t <= anchor.t) });
  }
  // Saved programs are durable. M0 reload validates a snapshot by forward replay;
  // it never trusts a supplied state, cursor or ledger as authoritative physics.
  static restore(bundle: Bundle, value: unknown): Runner {
    if (!value || typeof value !== 'object') throw new Error('Invalid snapshot');
    if ((value as Snapshot).schemaVersion !== 3 || (value as Snapshot).modelVersion !== MODEL) throw new Error('Unsupported snapshot version; recover the scenario/program and replay without the old snapshot');
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
