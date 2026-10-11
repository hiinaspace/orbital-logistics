import {readFileSync,writeFileSync} from 'node:fs';
import {integrateSolar} from '../src/solar/validation';
import {AU_KM,YEAR_SECONDS} from '../src/solar/ephemeris';
import type {SolarArtifact} from '../src/solar/view';
const artifact=JSON.parse(readFileSync('fixtures/model-sets/solar-cycler.json','utf8')) as SolarArtifact;
const results=artifact.vessels.flatMap(v=>v.arcs.map(arc=>{
 const normal=integrateSolar(artifact,arc,8192),fine=integrateSolar(artifact,arc,16384),reference=arc.endpoint;
 const distance=(a:number[],b:number[],i:number,scale:number)=>Math.hypot(...a.slice(i,i+3).map((x,j)=>x-b[i+j]))*scale;
 const oracleDv=v.rows.find(r=>r[0]===arc.end)![8]-v.rows.find(r=>r[0]===arc.start)![8]-(v.captures?.find(c=>c.t===arc.end)?.paidDeltaV??0);
 const fuelFractionError=Math.abs(Math.exp(-fine[6]/artifact.exhaustVelocity)-Math.exp(-oracleDv/artifact.exhaustVelocity));
 const result={vessel:v.id,arc:arc.id,positionRefinementMeters:distance(normal,fine,0,AU_KM*1000),velocityRefinementMetersS:distance(normal,fine,3,AU_KM*1000/YEAR_SECONDS),positionOracleMeters:distance(fine,reference,0,AU_KM*1000),velocityOracleMetersS:distance(fine,reference,3,AU_KM*1000/YEAR_SECONDS),deltaVkmS:fine[6]*AU_KM/YEAR_SECONDS,fuelFractionError};
 if(result.positionOracleMeters>1||result.velocityOracleMetersS>.0001)throw Error('Solar independent integration gate: '+JSON.stringify(result));
 if(fuelFractionError>1e-6)throw Error('Solar fuel agreement gate');
 return result;
}));
const coasts=artifact.vessels[0].coasts!.map((coast,index)=>{
 const arc={...coast,id:`coast-${index}`,referenceBody:0,localInitial:coast.initial,keys:[[coast.start,0,0,0],[coast.end,0,0,0]],coefficients:[[[0,0,0],[0,0,0],[0,0,0],[0,0,0]]]};
 const normal=integrateSolar(artifact,arc,8192),fine=integrateSolar(artifact,arc,16384);
 const distance=(a:number[],b:number[],i:number,scale:number)=>Math.hypot(...a.slice(i,i+3).map((x,j)=>x-b[i+j]))*scale;
 const result={arc:arc.id,positionRefinementMeters:distance(normal,fine,0,AU_KM*1000),velocityRefinementMetersS:distance(normal,fine,3,AU_KM*1000/YEAR_SECONDS),positionOracleMeters:distance(fine,coast.endpoint,0,AU_KM*1000),velocityOracleMetersS:distance(fine,coast.endpoint,3,AU_KM*1000/YEAR_SECONDS)};
 if(result.positionOracleMeters>1000||result.velocityOracleMetersS>.01)throw Error('Solar coast gate: '+JSON.stringify(result));
 return result;
});
writeFileSync('docs/design/solar-cycler/numerics.json',JSON.stringify({burns:results,coasts},null,2)+'\n');console.log({burns:results,coasts});
