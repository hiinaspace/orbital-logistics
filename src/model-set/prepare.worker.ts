import { prepareSet, type ModelSet } from './model';
self.onmessage = (event: MessageEvent<{revision: number; set: ModelSet}>) => {
  try { self.postMessage({revision: event.data.revision, run: prepareSet(event.data.set)}); }
  catch (error) { self.postMessage({revision: event.data.revision, error: error instanceof Error ? error.message : String(error)}); }
};
