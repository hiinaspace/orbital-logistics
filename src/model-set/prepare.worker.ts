import {isSolar,prepareSolar,type SolarDefinition,type SolarArtifact} from '../solar/view';
import {isStagedApollo,prepareStagedApollo,type StagedApolloMission} from './staged-apollo';
import {isApollo,prepareApollo,type ApolloMission} from './apollo';
import {isSurfaceShuttle,prepareSurfaceShuttle,type SurfaceShuttle} from './surface-shuttle';
import {isDirectSurface,prepareDirectSurface,type DirectSurfaceSet} from './direct-surface';
import {isAtmosphericMission,prepareAtmosphericMission,type AtmosphericMission} from './atmospheric-mission';
import {isEntry,prepareEntry,type EntryFlight} from './entry';
import {isStaged,prepareStaged,type StagedFlight} from './staging';
import { prepareSet, type ModelSet } from './model';
self.onmessage = async (event: MessageEvent<{revision: number; set: SolarDefinition|StagedApolloMission|ApolloMission|ModelSet|StagedFlight|EntryFlight|AtmosphericMission|DirectSurfaceSet|SurfaceShuttle}>) => {
  try { if(isSolar(event.data.set)){
   const response=await fetch(event.data.set.artifactUrl!);if(!response.ok)throw Error('Solar artifact unavailable');
   const data=await response.text();if(data.length>16*1024*1024)throw Error('Solar artifact byte budget');
   self.postMessage({revision:event.data.revision,run:prepareSolar(JSON.parse(data) as SolarArtifact)});return;
  }self.postMessage({revision: event.data.revision, run: isStagedApollo(event.data.set)?prepareStagedApollo(event.data.set).view:isApollo(event.data.set)?prepareApollo(event.data.set).view:isSurfaceShuttle(event.data.set)?prepareSurfaceShuttle(event.data.set).view:isDirectSurface(event.data.set)?prepareDirectSurface(event.data.set).view:isAtmosphericMission(event.data.set)?prepareAtmosphericMission(event.data.set).view:isEntry(event.data.set)?prepareEntry(event.data.set).view:isStaged(event.data.set)?prepareStaged(event.data.set).view:prepareSet(event.data.set)}); }
  catch (error) { self.postMessage({revision: event.data.revision, error: error instanceof Error ? error.message : String(error)}); }
};
