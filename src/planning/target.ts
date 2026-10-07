import { validateBundle, type Bundle } from '../sim/schema';

// A massless target coasts through the same dynamics. It is not a source body.
export function targetBundle(bundle: Bundle): Bundle {
  const target = bundle.scenario.rendezvous?.target;
  if (!target) throw new Error('No rendezvous target');
  const scenario = structuredClone(bundle.scenario);
  delete scenario.rendezvous;
  scenario.ship.id = target.id; scenario.ship.state = [...target.state];
  return validateBundle({ scenario, program: { schemaVersion: 1, id: 'target-coast-v1', burns: [] } });
}
