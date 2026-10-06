import { predict } from './predict';
import { validateBundle } from '../sim/schema';
self.onmessage = ({ data }) => {
  try { self.postMessage({ result: predict(validateBundle(data.bundle), data.revision, data.horizon, true) }); }
  catch (error) { self.postMessage({ error: (error as Error).message, revision: data.revision }); }
};
