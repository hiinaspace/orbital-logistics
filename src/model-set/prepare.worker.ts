import {isObservatoryMission,prepareObservatoryMission,type ObservatoryMission} from '../binary/mission';
import {isBinary,prepareBinary,type BinarySet} from '../binary/model';
import {isPassThrough,type PassThroughDefinition,type PassThroughProfile,type FleetProfile} from '../cycler/types';
import {prepareFleet} from '../cycler/fleet';
import {preparePassThrough} from '../cycler/prepare';
import {createPassThroughView} from '../cycler/view';
import {isCompact,type CompactDefinition,type CompactProfile} from '../compact/types';
import {prepareCompact} from '../compact/prepare';
import {createView,cycleRow} from '../compact/view';
import {isSolar,prepareSolar,type SolarDefinition,type SolarArtifact} from '../solar/view';
import {isStagedApollo,prepareStagedApollo,type StagedApolloMission} from './staged-apollo';
import {isApollo,prepareApollo,type ApolloMission} from './apollo';
import {isSurfaceShuttle,prepareSurfaceShuttle,type SurfaceShuttle} from './surface-shuttle';
import {isDirectSurface,prepareDirectSurface,type DirectSurfaceSet} from './direct-surface';
import {isAtmosphericMission,prepareAtmosphericMission,type AtmosphericMission} from './atmospheric-mission';
import {isEntry,prepareEntry,type EntryFlight} from './entry';
import {isStaged,prepareStaged,type StagedFlight} from './staging';
import { prepareSet, type ModelSet } from './model';
self.onmessage = async (event: MessageEvent<{revision: number; set: ObservatoryMission|BinarySet|PassThroughDefinition|CompactDefinition|SolarDefinition|StagedApolloMission|ApolloMission|ModelSet|StagedFlight|EntryFlight|AtmosphericMission|DirectSurfaceSet|SurfaceShuttle}>) => {
  try { if(isObservatoryMission(event.data.set)){self.postMessage({revision:event.data.revision,run:prepareObservatoryMission(event.data.set).view});return;}if(isBinary(event.data.set)){self.postMessage({revision:event.data.revision,run:prepareBinary(event.data.set)});return;}if(isPassThrough(event.data.set)){const response=await fetch(event.data.set.artifactUrl!);if(!response.ok)throw Error('Pass-through profile unavailable');const data=await response.text();if(data.length>2_500_000)throw Error('Pass-through profile bytes');const value=JSON.parse(data);const p=event.data.set.modelVersion==='cycler-fleet-set-v1'?prepareFleet(value as FleetProfile):preparePassThrough(value as PassThroughProfile).template;self.postMessage({revision:event.data.revision,run:createPassThroughView(p,event.data.set)});return;}if(isCompact(event.data.set)){const response=await fetch(event.data.set.artifactUrl!);if(!response.ok)throw Error('Compact profile unavailable');const data=await response.text();if(data.length>1_000_000)throw Error('Compact profile bytes');const p=prepareCompact(JSON.parse(data) as CompactProfile).template;self.postMessage({revision:event.data.revision,run:createView(p,event.data.set,0,p.period,[cycleRow(p,0)])});return;}if(isSolar(event.data.set)){
   const response=await fetch(event.data.set.artifactUrl!);if(!response.ok)throw Error('Solar artifact unavailable');
   const data=await response.text();if(data.length>16*1024*1024)throw Error('Solar artifact byte budget');
   self.postMessage({revision:event.data.revision,run:prepareSolar(JSON.parse(data) as SolarArtifact)});return;
  }self.postMessage({revision: event.data.revision, run: isStagedApollo(event.data.set)?prepareStagedApollo(event.data.set).view:isApollo(event.data.set)?prepareApollo(event.data.set).view:isSurfaceShuttle(event.data.set)?prepareSurfaceShuttle(event.data.set).view:isDirectSurface(event.data.set)?prepareDirectSurface(event.data.set).view:isAtmosphericMission(event.data.set)?prepareAtmosphericMission(event.data.set).view:isEntry(event.data.set)?prepareEntry(event.data.set).view:isStaged(event.data.set)?prepareStaged(event.data.set).view:prepareSet(event.data.set)}); }
  catch (error) { self.postMessage({revision: event.data.revision, error: error instanceof Error ? error.message : String(error)}); }
};
