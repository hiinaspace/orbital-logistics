import {viewerProfile} from './profile';
import {basisPoint,FIELD_LIMIT,SOURCES,type Bounds,type FieldGrid,type FieldRequest} from './potential-field';
type Project=(point:ReturnType<typeof basisPoint>)=>readonly number[];
interface Patch {grid:FieldGrid;image:HTMLCanvasElement;path:Path2D;bytes:number}
const OVERVIEW:Bounds={x:-12,y:-12,span:24};
const same=(a:Bounds,b:Bounds)=>a.x===b.x&&a.y===b.y&&a.span===b.span;
// One lazy display worker, one request and one replaceable desired region.
export class PotentialLayer {
 private worker?:Worker;private overview?:Patch;private detail?:Patch;
 private plateKey='';private plateHits=0;
 constructor(private plate:HTMLCanvasElement){}
 private desired?:Bounds;private pending?:FieldRequest;private serial=0;
 error='';visible=false;requests=0;
 get stats(){return {visible:this.visible,ready:!!this.overview,pending:!!this.pending,requests:this.requests,plateHits:this.plateHits,bytes:this.plate.width*this.plate.height*4+(this.overview?.bytes??0)+(this.detail?.bytes??0)+(this.pending?this.pending.size**2*16+20000*80:0),segments:(this.overview?.grid.segments.length??0)/4+(this.detail?.grid.segments.length??0)/4,error:this.error};}
 private request(bounds:Bounds,size:number){
  if(this.pending||this.error)return;
  if(!this.worker){this.worker=new Worker(new URL('./potential-worker.ts',import.meta.url),{type:'module'});
   this.worker.onerror=()=>{this.error='Field unavailable';this.pending=undefined;this.worker?.terminate();};
   this.worker.onmessage=(e:MessageEvent<{grid?:FieldGrid;error?:string;id?:number}>)=>{
    if(!this.pending)return;const expected=this.pending;this.pending=undefined;
    if(e.data.error){this.error=e.data.error;return;}const g=e.data.grid!;if(g.id!==expected.id){this.error='Field reply mismatch';return;}
    const uploadStart=performance.now();const image=document.createElement('canvas');image.width=image.height=g.size;
    image.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(g.pixels),g.size,g.size),0,0);
    const path=new Path2D();for(let i=0;i<g.segments.length;i+=4){path.moveTo(g.segments[i],g.segments[i+1]);path.lineTo(g.segments[i+2],g.segments[i+3]);}
    const patch={grid:g,image,path,bytes:g.pixels.byteLength+g.segments.byteLength*3+g.size**2*4};
    viewerProfile.record('fieldUpload',performance.now()-uploadStart);
    if(same(g.bounds,OVERVIEW))this.overview=patch;else this.detail=patch;
    if(this.stats.bytes>FIELD_LIMIT){this.error='Field storage budget';this.detail=undefined;}
   };
  }
  this.pending={id:++this.serial,bounds,size};this.requests++;this.worker.postMessage(this.pending);
 }
 draw(width:number,height:number,epoch:number,project:Project,enabled:boolean){
  this.visible=false;this.plate.hidden=!enabled;if(!enabled)return;
  const o=project(basisPoint(0,0,epoch)),x=project(basisPoint(1,0,epoch)),y=project(basisPoint(0,1,epoch));
  const a=x[0]-o[0],b=x[1]-o[1],c=y[0]-o[0],d=y[1]-o[1],det=a*d-b*c,scale=Math.max(Math.hypot(a,b),Math.hypot(c,d));
  if(Math.abs(det)<.12*scale**2){this.plate.hidden=true;return;}this.visible=true;
  // Invert only a well-conditioned physical plane. No source/cursor sampling.
  const corners=[[0,0],[width,0],[width,height],[0,height]].map(([u,v])=>[(d*(u-o[0])-c*(v-o[1]))/det,(-b*(u-o[0])+a*(v-o[1]))/det]);
  const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys);
  const span=2**Math.ceil(Math.log2(Math.max(right-left,top-bottom)*1.6));
  this.desired=span<16?{x:Math.round((left+right)/2/(span/8))*span/8-span/2,y:Math.round((bottom+top)/2/(span/8))*span/8-span/2,span}:undefined;
  if(!this.overview)this.request(OVERVIEW,256);
  else if(this.desired){const q=this.detail?.grid.bounds;const covered=q&&q.span<=span*2&&q.span>=span/2&&left>=q.x&&right<=q.x+q.span&&bottom>=q.y&&top<=q.y+q.span;if(!covered&&(!q||!same(q,this.desired)))this.request(this.desired,512);}
  const detail=this.desired?this.detail:undefined;
  const paint=(ctx:CanvasRenderingContext2D,patch:Patch,exclude?:Bounds)=>{
   const q=patch.grid.bounds;ctx.save();ctx.transform(a,b,c,d,o[0],o[1]);
   ctx.beginPath();ctx.rect(q.x,q.y,q.span,q.span);for(const s of SOURCES){ctx.moveTo(s.x+s.radius,s.y);ctx.arc(s.x,s.y,s.radius,0,2*Math.PI);}ctx.clip('evenodd');
   if(exclude){ctx.beginPath();ctx.rect(q.x,q.y,q.span,q.span);ctx.rect(exclude.x,exclude.y,exclude.span,exclude.span);ctx.clip('evenodd');}
   ctx.imageSmoothingEnabled=false;ctx.drawImage(patch.image,q.x,q.y,q.span,q.span);
   ctx.strokeStyle='rgba(170,191,172,.30)';ctx.lineWidth=.8/Math.sqrt(Math.abs(det));ctx.stroke(patch.path);ctx.restore();
  };
  const affine=[a,b,c,d,o[0],o[1],width,height].map(v=>Math.round(v*1e8)/1e8).join(',');
  // The field is an independent bounded canvas behind the moving freight.
  // An unchanged projection does not repaint it; a changed projection redraws
  // at the exact cursor rather than temporally decimating the physical field.
  const key=affine+':'+this.overview?.grid.id+':'+detail?.grid.id;
  if(key!==this.plateKey){const ratio=Math.min(1,1280/Math.max(width,height));const w=Math.ceil(width*ratio),h=Math.ceil(height*ratio);if(this.plate.width!==w||this.plate.height!==h){this.plate.width=w;this.plate.height=h;}const target=this.plate.getContext('2d')!;target.setTransform(1,0,0,1,0,0);target.fillStyle='#0c141d';target.fillRect(0,0,w,h);target.setTransform(ratio,0,0,ratio,0,0);if(this.overview)paint(target,this.overview,detail?.grid.bounds);if(detail)paint(target,detail);this.plateKey=key;}
  else this.plateHits++;
 }
}
