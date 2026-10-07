import {logisticsResult} from '../sim/logistics';
import {Runner, type Sample} from '../sim/runner';
import {validateBundle, type Bundle, type Program, type Scenario} from '../sim/schema';
import {puzzleFor, puzzles} from './catalog';
export interface Solution {
  puzzleId: string; scenario: Scenario; program: Program;
  score: {time: number; fuel: number; hardware: number};
}
export function solutionFromRun(bundle: Bundle, sample: Sample): Solution | undefined {
  const puzzle = puzzleFor(bundle.scenario), spec = bundle.scenario.logistics;
  if (!puzzle || !spec || sample.status !== 'horizon' || sample.t !== bundle.scenario.epoch + bundle.scenario.duration || !sample.logistics) return;
  const result = logisticsResult(spec, sample.logistics, sample.propellant, sample.t);
  if (!result.complete || result.completedAt === undefined) return;
  return {puzzleId: puzzle.id, scenario: structuredClone(bundle.scenario), program: structuredClone(bundle.program),
    score: {time: result.completedAt - bundle.scenario.epoch, fuel: result.propellantUsed, hardware: result.hardwareCost}};
}
export function retainSolution(records: Solution[], next: Solution): Solution[] {
  const dominates = (a: Solution, b: Solution) => a.puzzleId === b.puzzleId &&
    a.score.time <= b.score.time && a.score.fuel <= b.score.fuel && a.score.hardware <= b.score.hardware;
  if (records.some(r => dominates(r,next))) return records;
  return [...records.filter(r => r.puzzleId !== next.puzzleId), ...[...records.filter(r => r.puzzleId === next.puzzleId && !dominates(next,r)), next].sort((a,b) => a.score.time - b.score.time).slice(0,12)];
}
export function readSolutions(json: string | null): Solution[] {
  if (!json || json.length > 1024*1024) return [];
  try {
    const values: unknown = JSON.parse(json); if (!Array.isArray(values) || values.length > 24) return [];
    let records: Solution[] = [];
    for (const value of values) {
      try {
        if (!value || typeof value !== 'object') continue;
        const record = value as Solution, puzzle = puzzles.find(p => p.id === record.puzzleId); if (!puzzle) continue;
        const bundle = validateBundle({scenario: record.scenario, program: record.program});
        if (puzzleFor(bundle.scenario)?.id !== puzzle.id) continue;
        // Stored scores are untrusted; replay the saved program against fixed rules.
        const verified = solutionFromRun(bundle, new Runner(bundle).advanceTo(bundle.scenario.epoch + bundle.scenario.duration));
        if (verified) records = retainSolution(records,verified);
      } catch { /* One obsolete/broken record does not hide other solutions. */ }
    }
    return records;
  } catch { return []; }
}
