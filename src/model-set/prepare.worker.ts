import {isApollo,prepareApollo,type ApolloMission} from './apollo';
import {isSurfaceShuttle,prepareSurfaceShuttle,type SurfaceShuttle} from './surface-shuttle';
import {isDirectSurface,prepareDirectSurface,type DirectSurfaceSet} from './direct-surface';
import {isAtmosphericMission,prepareAtmosphericMission,type AtmosphericMission} from './atmospheric-mission';
import {isEntry,prepareEntry,type EntryFlight} from './entry';
import {isStaged,prepareStaged,type StagedFlight} from './staging';
import { prepareSet, type ModelSet } from './model';
self.onmessage = (event: MessageEvent<{revision: number; set: ApolloMission|ModelSet|StagedFlight|EntryFlight|AtmosphericMission|DirectSurfaceSet|SurfaceShuttle}>) => {
  try { self.postMessage({revision: event.data.revision, run: isApollo(event.data.set)?prepareApollo(event.data.set).view:isSurfaceShuttle(event.data.set)?prepareSurfaceShuttle(event.data.set).view:isDirectSurface(event.data.set)?prepareDirectSurface(event.data.set).view:isAtmosphericMission(event.data.set)?prepareAtmosphericMission(event.data.set).view:isEntry(event.data.set)?prepareEntry(event.data.set).view:isStaged(event.data.set)?prepareStaged(event.data.set).view:prepareSet(event.data.set)}); }
  catch (error) { self.postMessage({revision: event.data.revision, error: error instanceof Error ? error.message : String(error)}); }
};
