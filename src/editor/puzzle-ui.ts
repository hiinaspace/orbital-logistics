import type {EditorSession} from './session';
import {puzzleFor, puzzles} from '../puzzles/catalog';
import {readSolutions, retainSolution, solutionFromRun, type Solution} from '../puzzles/solutions';
import type {Bundle} from '../sim/schema';
const KEY = 'orbital-logistics-solutions-v1';
export function mountPuzzles(host: HTMLElement, api: {session: () => EditorSession; replay: (bundle: Bundle) => void; restart: (bundle: Bundle) => void}) {
  host.innerHTML = `<div class="section-title"><h2 id="puzzle-title"></h2><button id="puzzle-restart">New attempt</button></div><p id="puzzle-brief"></p><div id="puzzle-run" role="status"></div>
    <details id="solutions"><summary>Solutions <span id="solution-count">0</span></summary><div id="solution-list"></div></details>`;
  const el = <T extends HTMLElement>(id: string) => host.querySelector<T>('#'+id)!;
  let records: Solution[] = []; let storageAvailable = true;
  try { records = readSolutions(localStorage.getItem(KEY)); } catch {storageAvailable = false;}
  el('puzzle-restart').addEventListener('click', () => { const puzzle = puzzleFor(api.session().scenario); if (puzzle) api.restart(puzzle.bundle); });
  let rendered = '', checkedRun: object | undefined;
  function download(record: Solution) {
    const puzzle = puzzles.find(p => p.id === record.puzzleId)!;
    const url = URL.createObjectURL(new Blob([JSON.stringify({...puzzle.bundle, program: record.program},null,2)+'\n'],{type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = record.puzzleId+'-solution.json'; link.click(); URL.revokeObjectURL(url);
  }
  return { update() {
    const session = api.session(), puzzle = puzzleFor(session.scenario); host.hidden = !puzzle; if (!puzzle) return;
    el('puzzle-title').textContent = puzzle.title; el('puzzle-brief').textContent = puzzle.brief;
    const live = session.execution.current;
    if (live.status === 'horizon' && checkedRun !== session.execution) {
      checkedRun = session.execution;
      const record = solutionFromRun({scenario: session.scenario, program: session.accepted},live);
      if (record) {
        records = retainSolution(records,record);
        try {localStorage.setItem(KEY,JSON.stringify(records));} catch {storageAvailable = false;}
      }
    }
    const result = solutionFromRun({scenario: session.scenario, program: session.accepted},live);
    el('puzzle-run').textContent = result ? `Solved · time ${result.score.time.toFixed(3)} · fuel ${result.score.fuel.toFixed(5)}${storageAvailable ? '' : ' · saved for this session'}` : '';
    const shown = records.filter(r => r.puzzleId === puzzle.id), signature = JSON.stringify(shown)+puzzle.id;
    if (signature === rendered) return; rendered = signature;
    el('solution-count').textContent = String(shown.length); el('solution-list').replaceChildren();
    if (!shown.length) {el('solution-list').textContent = 'Run a successful plan to save a solution.'; return;}
    const table = document.createElement('table'); table.innerHTML = '<thead><tr><th>Time</th><th>Fuel</th><th>Hardware</th><th></th></tr></thead>';
    const body = document.createElement('tbody'); table.append(body);
    for (const record of shown) {
      const row = document.createElement('tr');
      for (const text of [record.score.time.toFixed(3),record.score.fuel.toFixed(5),String(record.score.hardware)]) {const cell = document.createElement('td'); cell.textContent = text; row.append(cell);}
      const cell = document.createElement('td'), replay = document.createElement('button'), save = document.createElement('button');
      replay.textContent = 'Replay'; save.textContent = '↓'; save.setAttribute('aria-label','Download solution');
      replay.addEventListener('click',() => api.replay({...puzzle.bundle,program:record.program})); save.addEventListener('click',() => download(record));
      cell.append(replay,save); row.append(cell); body.append(row);
    }
    el('solution-list').append(table);
  }};
}
