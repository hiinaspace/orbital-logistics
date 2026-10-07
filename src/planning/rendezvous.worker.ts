import { proposeEncounter } from './encounters';
import { solveRendezvous } from './rendezvous';
import { predict } from './predict';
import { validateBundle } from '../sim/schema';
self.onmessage = ({ data }) => {
  const { revision, burnId, horizon, generation } = data;
  try {
    const bundle = validateBundle(data.bundle), result = data.opportunityId ? proposeEncounter(bundle, data.opportunityId) : solveRendezvous(bundle, burnId, 96, data.portTarget);
    const prediction = result.status === 'proposed' ? predict({ scenario: bundle.scenario, program: result.proposal.program }, revision, horizon, true) : undefined;
    self.postMessage({ generation, revision, horizon, scenarioId: bundle.scenario.id, modelVersion: bundle.scenario.modelVersion, result, prediction });
  } catch (error) { self.postMessage({ generation, revision, error: (error as Error).message }); }
};
