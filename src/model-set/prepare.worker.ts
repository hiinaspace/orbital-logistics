import {isEntry,prepareEntry,type EntryFlight} from './entry';
import {isStaged,prepareStaged,type StagedFlight} from './staging';
import { prepareSet, type ModelSet } from './model';
self.onmessage = (event: MessageEvent<{revision: number; set: ModelSet|StagedFlight|EntryFlight}>) => {
  try { self.postMessage({revision: event.data.revision, run: isEntry(event.data.set)?prepareEntry(event.data.set).view:isStaged(event.data.set)?prepareStaged(event.data.set).view:prepareSet(event.data.set)}); }
  catch (error) { self.postMessage({revision: event.data.revision, error: error instanceof Error ? error.message : String(error)}); }
};
