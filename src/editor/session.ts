import { Runner } from '../sim/runner';
import { parseBundle, validateBundle, type Bundle, type Burn, type Program } from '../sim/schema';
import { inspectEvents } from '../planning/events';
import type { Encounter } from '../planning/events';
import { predict } from '../planning/predict';

const clone = <T>(value: T): T => structuredClone(value);
export class EditorSession {
  readonly scenario: Bundle['scenario'];
  readonly baseline: Program;
  #draft: Program; #accepted: Program;
  #undo: Program[] = []; #redo: Program[] = []; #gesture?: Program;
  #gestureRedo?: Program[];
  revision = 0;
  execution: Runner;
  constructor(bundle: Bundle, baseline = bundle.program) {
    const validated = validateBundle(bundle);
    this.scenario = validated.scenario;
    this.baseline = validateBundle({ scenario: this.scenario, program: baseline }).program;
    this.#draft = clone(validated.program); this.#accepted = clone(validated.program);
    this.execution = new Runner(validated);
  }
  get draft(): Program { return clone(this.#draft); }
  get accepted(): Program { return clone(this.#accepted); }
  get bundle(): Bundle { return { scenario: clone(this.scenario), program: this.draft }; }
  get canUndo(): boolean { return this.#undo.length > 0; }
  get canRedo(): boolean { return this.#redo.length > 0; }
  get changed(): boolean { return JSON.stringify(this.#draft) !== JSON.stringify(this.#accepted); }
  change(program: Program): void {
    const next = validateBundle({ scenario: this.scenario, program }).program;
    if (JSON.stringify(next) === JSON.stringify(this.#draft)) return;
    if (!this.#gesture) { this.#undo.push(this.draft); if (this.#undo.length > 64) this.#undo.shift(); }
    this.#redo = []; this.#draft = next; this.revision++;
  }
  addBurn(t: number, referenceBodyId: string): string {
    if (this.#draft.burns.length >= 8) throw new Error('Eight maneuvers maximum');
    let index = 1; while (this.#draft.burns.some(b => b.id === `burn-${index}`)) index++;
    const id = `burn-${index}`;
    const program = this.draft;
    program.burns.push({ id, t, referenceBodyId, basis: 'radial-transverse-ccw-v1', radial: 0, transverse: 0 });
    program.burns.sort((a, b) => a.t - b.t); this.change(program); return id;
  }
  updateBurn(id: string, edit: Partial<Burn>): void {
    const program = this.draft, burn = program.burns.find(b => b.id === id);
    if (!burn) throw new Error('Unknown maneuver');
    Object.assign(burn, edit);
    if (edit.t !== undefined || edit.referenceBodyId !== undefined) delete burn.snap;
    if (edit.t !== undefined || edit.referenceBodyId !== undefined || edit.radial !== undefined || edit.transverse !== undefined) delete burn.assist;
    program.burns.sort((a, b) => a.t - b.t); this.change(program);
  }
  removeBurn(id: string): void { const program = this.draft; program.burns = program.burns.filter(b => b.id !== id); this.change(program); }
  beginGesture(): void { if (!this.#gesture) { this.#gesture = this.draft; this.#gestureRedo = clone(this.#redo); } }
  endGesture(commit: boolean): void {
    if (!this.#gesture) return;
    const before = this.#gesture, redo = this.#gestureRedo!; this.#gesture = undefined; this.#gestureRedo = undefined;
    if (JSON.stringify(before) === JSON.stringify(this.#draft)) { this.#redo = redo; return; }
    if (commit) { this.#undo.push(before); if (this.#undo.length > 64) this.#undo.shift(); }
    else { this.#draft = before; this.#redo = redo; this.revision++; }
  }
  undo(): void {
    this.endGesture(false); const previous = this.#undo.pop();
    if (previous) { this.#redo.push(this.draft); this.#draft = previous; this.revision++; }
  }
  redo(): void {
    this.endGesture(false); const next = this.#redo.pop();
    if (next) { this.#undo.push(this.draft); this.#draft = next; this.revision++; }
  }
  snapCandidates(id: string): Encounter[] {
    const burn = this.#draft.burns.find(b => b.id === id);
    if (!burn) return [];
    const prefix = { scenario: this.scenario, program: { ...this.draft, burns: this.#draft.burns.filter(b => b.t < burn.t) } };
    return inspectEvents(prefix, new Runner(prefix), burn.referenceBodyId, this.scenario.epoch + this.scenario.duration).apsides;
  }
  snap(id: string, event: Encounter, window: [number, number]): void {
    const program = this.draft, burn = program.burns.find(b => b.id === id);
    if (!burn || event.kind === 'endpoint' || event.bodyId !== burn.referenceBodyId) throw new Error('Invalid snap');
    burn.t = event.t; burn.snap = { bodyId: event.bodyId, kind: event.kind, window, resolvedEpoch: event.t };
    program.burns.sort((a, b) => a.t - b.t); this.change(program);
  }
  snapState(id: string): 'current' | 'stale' | 'missing' | 'ambiguous' | undefined {
    const burn = this.#draft.burns.find(b => b.id === id), snap = burn?.snap;
    if (!snap) return undefined;
    const candidates = this.snapCandidates(id).filter(e => e.kind === snap.kind && e.t >= snap.window[0] && e.t <= snap.window[1]);
    if (candidates.length === 0) return 'missing'; if (candidates.length > 1) return 'ambiguous';
    return Math.abs(candidates[0].t - snap.resolvedEpoch) < 1e-6 ? 'current' : 'stale';
  }
  execute(): void {
    if (this.#gesture) throw new Error('Finish the handle edit first');
    for (const burn of this.#draft.burns) {
      const snap = this.snapState(burn.id); if (snap && snap !== 'current') throw new Error(`Re-snap ${burn.id}: ${snap}`);
    }
    const check = new Runner(this.bundle), terminal = check.sample(this.scenario.epoch + this.scenario.duration);
    if (terminal.status !== 'horizon') throw new Error(`Plan stopped: ${terminal.status}`);
    if (predict(this.bundle, this.revision, this.scenario.epoch + this.scenario.duration, true).accuracy?.status !== 'converged') throw new Error('Trajectory accuracy unresolved');
    this.#accepted = this.draft; this.execution = new Runner(this.bundle);
  }
  serialize(previewEpoch: number): string {
    return JSON.stringify({ ...this.bundle, editor: { schemaVersion: 1, baseline: this.baseline,
      accepted: this.accepted, previewEpoch, snapshot: this.execution.snapshot() } }, null, 2) + '\n';
  }
  static deserialize(json: string): { session: EditorSession; previewEpoch: number } {
    const bundle = parseBundle(json), value = JSON.parse(json), editor = value.editor;
    const session = new EditorSession(bundle, editor?.baseline ?? bundle.program);
    let previewEpoch = bundle.scenario.epoch;
    if (editor) {
      if (editor.schemaVersion !== 1 || !Number.isFinite(editor.previewEpoch) || editor.previewEpoch < bundle.scenario.epoch ||
          editor.previewEpoch > bundle.scenario.epoch + bundle.scenario.duration) throw new Error('Invalid editor session');
      session.#accepted = validateBundle({ scenario: bundle.scenario, program: editor.accepted }).program;
      session.execution = Runner.restore({ scenario: bundle.scenario, program: session.accepted }, editor.snapshot);
      previewEpoch = editor.previewEpoch;
    } else if (value.snapshot) session.execution = Runner.restore(bundle, value.snapshot);
    return { session, previewEpoch };
  }
}
