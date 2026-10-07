import returnTicket from '../../fixtures/m4-return-ticket.json';
import expressReturn from '../../fixtures/m4-express-return.json';
import {validateBundle, type Scenario} from '../sim/schema';
export const puzzles = [
  {id: 'return-ticket', title: '1 · Return ticket', brief: 'Deliver 0.2 to Depot. Bring the tug home empty with at least 0.05 fuel.', bundle: validateBundle(returnTicket)},
  {id: 'express-return', title: '2 · Express return', brief: 'Same delivery. Home by t 18.25, empty, with at least 0.05 fuel.', bundle: validateBundle(expressReturn)},
];
export function puzzleFor(scenario: Scenario) {
  // Identity includes all fixed physics, inventories and rules, not only an ID.
  return puzzles.find(p => JSON.stringify(p.bundle.scenario) === JSON.stringify(scenario));
}
