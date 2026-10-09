import {AdaptiveViewStore} from '../adaptive/view';
import {sampleVessel,type SceneView,type VesselView,type ViewSample} from '../model-set/model';
import {validateNetwork,networkDepots,type NetworkDefinition} from './model';
import type {NetworkDelta} from './engine';
import type {ResourceAnchor} from '../traffic/resources';
const sorted=(rows:ResourceAnchor[])=>[...new Map(rows.map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);
export class NetworkViewStore {
 frontier=0;oldest=0;watermark=0;halt?:string;stats:Record<string,number>={};
 readonly lanes:AdaptiveViewStore[];readonly definition:NetworkDefinition;resources:ResourceAnchor[]=[];
 constructor(value:NetworkDefinition){this.definition=validateNetwork(value);this.lanes=this.definition.lanes.map(d=>new AdaptiveViewStore(d));}
 ingest(p:NetworkDelta,held=false){
  if(p.domain!=='maintained-network-v1'||p.lanes.length!==2)throw Error('Wrong maintained network packet');
  this.frontier=p.frontier;this.watermark=p.oldest;this.halt=p.halt;Object.assign(this.stats,p.stats);
  p.lanes.forEach((l,i)=>{if(l.ownerId!==this.definition.lanes[i].relay.id||l.visitorId!==this.definition.lanes[i].vessels[0].id)throw Error('Network stream owner mismatch');this.lanes[i].ingest(l,held);});this.resources=sorted([...this.resources,...p.resources]);if(!held)this.release();
  this.stats.viewBytes=this.lanes.reduce((n,l)=>n+(l.stats.viewBytes??0),0)+new TextEncoder().encode(JSON.stringify(this.resources)).byteLength;
  if(this.stats.viewBytes>16000000)throw Error('Network held display budget exceeded');
 }
 release(){this.oldest=this.watermark;this.lanes.forEach(l=>l.release());let i=0;while(i+1<this.resources.length&&this.resources[i+1].t<=this.oldest)i++;this.resources=this.resources.slice(i);}
 view(cursor:number):SceneView {
  if(cursor<this.oldest||cursor>this.frontier)throw Error('Cursor outside network history');
  const views=this.lanes.map(l=>l.view(Math.min(cursor,l.frontier))),healthy=views.filter((_,i)=>!this.lanes[i].halt),end=Math.min(...(healthy.length?healthy.map(v=>v.window.end):[this.frontier]));
  const vessels:VesselView[]=[],maintained:NonNullable<SceneView['maintained']>={},portSamples:SceneView['portSamples']={},ports:SceneView['world']['ports']=[];
  const faultView=(v:VesselView,at:number,reason:string):VesselView=>{
   if(at>end)return v;
   const owner=this.lanes.find(l=>l.definition.relay.id===v.id||l.definition.vessels[0].id===v.id)!;
   const head=v.samples.at(-1)!.t<at?owner.view(at):undefined,actual=head?(head.maintained?.[v.id]??head.vessels[0]):v;
   const known=sampleVessel(actual,at),s:ViewSample={...known,t:at,thrust:undefined,activity:{kind:'fault',knownEpoch:at,reason}};
   return {...v,samples:[...actual.samples.filter(s=>s.t<at),s,{...s,t:end}],arcs:v.arcs.filter(a=>a.start<at),ledger:v.ledger.filter(e=>e.t<=at),boundaries:v.boundaries.filter(b=>b.t<at)};
  };
  for(let i=0;i<views.length;i++){
   const v=views[i],lane=this.lanes[i],d=this.definition.lanes[i],failed=!!lane.halt;
   vessels.push(failed?faultView(v.vessels[0],lane.frontier,lane.halt!):v.vessels[0]);
   maintained[d.relay.id]=failed?{...v.maintained![d.relay.id],...faultView(v.maintained![d.relay.id],lane.frontier,lane.halt!)}:v.maintained![d.relay.id];
   ports.push(v.world.ports.find(p=>p.id===d.relay.id)!);portSamples[d.relay.id]=v.portSamples[d.relay.id];
  }
  // One surviving owner supplies the common ballistic hub. Its exact-key
  // canonical intervals match the other lane; display interpolation is local.
  const common=healthy[0]??views[this.lanes.reduce((best,l,i)=>l.frontier>this.lanes[best].frontier?i:best,0)],hub=this.definition.lanes[0].origin.id;ports.unshift(common.world.ports.find(p=>p.id===hub)!);portSamples[hub]=common.portSamples[hub];
  const stations=networkDepots(this.definition).map(p=>({...p,...(p.id===hub?{}:{maintenance:views.find(v=>v.maintained?.[p.id])!.stations.find(s=>s.id===p.id)!.maintenance})}));
  return {...common,id:this.definition.id,name:this.definition.name,description:this.definition.description,provenance:this.definition.provenance,stations,vessels,maintained,portSamples,world:{...common.world,ports},window:{start:this.oldest,end},traffic:{frontier:this.frontier,oldest:this.oldest,resources:this.resources,depots:networkDepots(this.definition),stats:this.stats,halt:this.halt}};
 }
}
