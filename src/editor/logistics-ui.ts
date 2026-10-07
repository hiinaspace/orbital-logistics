import type { Prediction } from '../planning/predict';
import type { Sample } from '../sim/runner';
import { compareOperations, type Operation, type Program } from '../sim/schema';
import type { EditorSession } from './session';

export function mountLogistics(host: HTMLElement, api: {
  session: () => EditorSession; edit: (change: () => void) => void;
  preview: (t: number) => void; epoch: () => number; example: () => void;
}) {
  host.innerHTML = `<div class="section-title"><h2>Port operations</h2><button id="op-new" aria-label="Add port operation">+</button></div>
    <div id="operations"></div>
    <details id="op-editor" hidden open><summary id="op-title">Operation</summary>
      <label>Epoch <input id="op-time" type="number" step="0.001"></label>
      <label>Action <select id="op-kind"><option value="dock">Dock</option><option value="transfer">Transfer</option><option value="undock">Undock</option></select></label>
      <label>Port <select id="op-port"></select></label>
      <div id="op-transfer"><label>Cargo (+load / −unload) <input id="op-cargo" type="number" step="0.01" value="0"></label>
      <label>Refuel <input id="op-fuel" type="number" step="0.01" min="0" value="0"></label></div>
      <div class="buttons"><button id="op-save">Save operation</button><button id="op-delete">Delete</button><button id="op-close">Close</button></div>
    </details>
    <details><summary>Inventories at preview</summary><div id="inventories"></div></details>
    <dl id="trip-results"></dl><button id="round-trip">Example round trip</button>`;
  const el = <T extends HTMLElement>(id: string) => host.querySelector<T>('#'+id)!;
  let selected: string | undefined, revision = -1, installed: EditorSession | undefined;
  const kindFields = () => { el('op-transfer').hidden = el<HTMLSelectElement>('op-kind').value !== 'transfer'; };
  const label = (op: Operation) => op.kind === 'transfer' ? `${op.cargo > 0 ? 'Load' : op.cargo < 0 ? 'Unload' : 'Refuel'}${op.propellant && op.cargo ? ' + refuel' : ''}` : op.kind === 'dock' ? 'Dock' : 'Undock';
  function fill(op?: Operation) {
    selected = op?.id;
    el('op-editor').hidden = false; el<HTMLDetailsElement>('op-editor').open = true;
    el('op-title').textContent = op ? `${label(op)} · ${op.portId}` : 'New operation';
    el<HTMLInputElement>('op-time').value = String(op?.t ?? api.epoch());
    el<HTMLSelectElement>('op-kind').value = op?.kind ?? 'dock';
    el<HTMLSelectElement>('op-port').value = op?.portId ?? api.session().scenario.logistics!.ports[0].id;
    el<HTMLInputElement>('op-cargo').value = String(op?.kind === 'transfer' ? op.cargo : 0);
    el<HTMLInputElement>('op-fuel').value = String(op?.kind === 'transfer' ? op.propellant : 0);
    el<HTMLButtonElement>('op-delete').disabled = !op; kindFields();
  }
  function select(op?: Operation) {fill(op); if (op) api.preview(op.t);}
  el('op-new').addEventListener('click', () => select());
  el('op-kind').addEventListener('change', kindFields);
  el('op-close').addEventListener('click', () => {selected = undefined; el('op-editor').hidden = true;});
  el('op-save').addEventListener('click', () => api.edit(() => {
    const program = api.session().draft; let id = selected ?? 'operation';
    while (!selected && [...(program.operations ?? []), ...program.burns].some(o => o.id === id)) id += '-new';
    const kind = el<HTMLSelectElement>('op-kind').value as Operation['kind'];
    const op: Operation = {id, kind, t: el<HTMLInputElement>('op-time').valueAsNumber, portId: el<HTMLSelectElement>('op-port').value,
      ...(kind === 'transfer' ? {cargo: el<HTMLInputElement>('op-cargo').valueAsNumber, propellant: el<HTMLInputElement>('op-fuel').valueAsNumber} : {})} as Operation;
    program.operations = [...(program.operations ?? []).filter(o => o.id !== id), op].sort(compareOperations);
    api.session().change(program); selected = id; api.preview(op.t);
  }));
  el('op-delete').addEventListener('click', () => api.edit(() => {
    const program = api.session().draft; program.operations = program.operations!.filter(o => o.id !== selected);
    api.session().change(program); selected = undefined; el('op-editor').hidden = true;
  }));
  el('round-trip').addEventListener('click', api.example);
  function rows(container: HTMLElement, values: [string, string][]) {
    container.replaceChildren(...values.map(([name, value]) => {const row = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = name; b.textContent = value; row.append(a,b); return row;}));
  }
  return {
    update(prediction: Prediction, sample: Sample, pending: boolean) {
      const session = api.session(), spec = session.scenario.logistics; host.hidden = !spec; if (!spec) return;
      el('round-trip').hidden = session.scenario.id.startsWith('m4-');
      if (installed !== session) {
        installed = session; revision = -1; selected = undefined; el('op-editor').hidden = true;
        el('op-port').replaceChildren(...spec.ports.map(p => {const option = document.createElement('option'); option.value = p.id; option.textContent = p.id; return option;}));
      }
      if (revision !== session.revision) {
        revision = session.revision; const program: Program = session.draft;
        if (selected && !program.operations?.some(o => o.id === selected)) {selected = undefined; el('op-editor').hidden = true;}
        el('operations').replaceChildren(...(program.operations ?? []).map(op => {
          const button = document.createElement('button'); button.className = 'burn-row'; button.dataset.operation = op.id;
          button.textContent = `${label(op)} ${op.portId} · ${op.t.toFixed(3)}`;
          button.addEventListener('click', () => select(op)); return button;
        }));
        if (selected) fill(program.operations?.find(o => o.id === selected));
      }
      if (sample.logistics) rows(el('inventories'), [['Tug cargo', `${sample.logistics.cargoMass.toFixed(3)} / ${spec.cargoCapacity.toFixed(3)}`],
        ['Tug fuel', sample.propellant.toFixed(3)], ...sample.logistics.ports.map(p => [p.id, `${p.cargo.toFixed(3)} cargo · ${p.propellant.toFixed(3)} fuel`] as [string,string])]);
      const result = prediction.logistics;
      rows(el('trip-results'), [['Completion time', pending ? '…' : result?.complete ? result.completedAt!.toFixed(3) : '—'], ['Propellant used', pending ? '…' : result?.propellantUsed.toFixed(5) ?? '—'], ['Hardware', String(spec.objective.hardwareCost)]]);
    }
  };
}
