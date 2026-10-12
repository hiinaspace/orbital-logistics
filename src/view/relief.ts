import {RATE} from '../compact/physics';
import type {Bounds} from './potential-field';
export type ReliefProjection=(point:[number,number,number,number,number,number])=>readonly number[];
const VERTEX=`#version 300 es
precision highp float;
in vec2 uv;
uniform vec3 origin,axisX,axisY,axisZ;
uniform vec3 bounds;
uniform vec2 viewport;
uniform float gain;
out vec2 q;
float tone(float p){return clamp(log(max(.095,-p)/.095)/log(1.4/.095),0.,1.);}
void main(){q=bounds.xy+uv*bounds.z;float p=-1./max(1.,length(q))-.03/max(.2,length(q-vec2(5.,0.)));float z=-2.4*gain*tone(p);vec3 screen=origin+axisX*q.x+axisY*q.y+axisZ*z;gl_Position=vec4(2.*screen.x/viewport.x-1.,1.-2.*screen.y/viewport.y,-screen.z/(8.*max(viewport.x,viewport.y)),1.);}`;
const FRAGMENT=`#version 300 es
precision highp float;
in vec2 q;
out vec4 color;
float tone(float p){return clamp(log(max(.095,-p)/.095)/log(1.4/.095),0.,1.);}
void main(){float r=length(q),m=length(q-vec2(5.,0.));if(r<=1.||m<=.2)discard;float p=-1./r-.03/m;float u=tone(p)*4.;vec3 a,b;
if(u<1.){a=vec3(12,20,29);b=vec3(17,29,36);}else if(u<2.){a=vec3(17,29,36);b=vec3(24,43,42);}else if(u<3.){a=vec3(24,43,42);b=vec3(54,63,45);}else{a=vec3(54,63,45);b=vec3(104,90,62);}
vec3 base=mix(vec3(12,20,29),mix(a,b,clamp(u-min(3.,floor(u)),0.,1.)),185./255.);
float levels[10]=float[10](-.1,-.13,-.17,-.22,-.29,-.38,-.5,-.66,-.87,-1.15);float line=0.;float w=max(fwidth(p),.000001);for(int i=0;i<10;i++)line=max(line,1.-smoothstep(0.,.65*w,abs(p-levels[i])));
color=vec4(mix(base/255.,vec3(.52,.61,.53),line*.22),1.);}`;
// Disposable display mesh; no spacecraft state or event time enters its buffers.
export class ReliefRenderer {
 private gl:WebGL2RenderingContext|null;private program?:WebGLProgram;private count=0;private key='';private meshKey='';private meshBytes=0;private vb?:WebGLBuffer;private ib?:WebGLBuffer;private locations=new Map<string,WebGLUniformLocation|null>();
 error='';hits=0;
 constructor(private canvas:HTMLCanvasElement){
  this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false});const gl=this.gl;
  if(!gl){this.error='WebGL2 unavailable';return;}
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.error='Relief context lost';this.key='';});
  const shader=(kind:number,source:string)=>{const s=gl.createShader(kind)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)??'Relief shader');return s;};
  try{
   const vertex=shader(gl.VERTEX_SHADER,VERTEX),fragment=shader(gl.FRAGMENT_SHADER,FRAGMENT),p=gl.createProgram()!;gl.attachShader(p,vertex);gl.attachShader(p,fragment);gl.linkProgram(p);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)??'Relief link');this.program=p;gl.useProgram(p);
   this.vb=gl.createBuffer()!;this.ib=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,this.vb);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib);const attribute=gl.getAttribLocation(p,'uv');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);gl.enable(gl.DEPTH_TEST);
  }catch(error){this.error=String(error);}
 }
 private mesh(bounds:Bounds){
  const key=[bounds.x,bounds.y,bounds.span].join(',');if(key===this.meshKey)return;this.meshKey=key;const gl=this.gl!;
  const coordinates=(low:number,axis:number)=>{const values=Array.from({length:97},(_,i)=>low+bounds.span*i/96);for(const [center,radius] of (axis===0?[[0,1],[5,.2]]:[[0,1],[0,.2]]))for(let i=-48;i<=48;i++){const point=center+Math.sign(i)*radius*4*(i/48)**2;if(point>low&&point<low+bounds.span)values.push(point);}return [...new Set(values)].sort((a,b)=>a-b);};
  const xs=coordinates(bounds.x,0),ys=coordinates(bounds.y,1),vertices=new Float32Array(xs.length*ys.length*2),indices=new Uint32Array((xs.length-1)*(ys.length-1)*6);let v=0,k=0;
  for(const y of ys)for(const x of xs){vertices[v++]=(x-bounds.x)/bounds.span;vertices[v++]=(y-bounds.y)/bounds.span;}
  for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){const a=j*xs.length+i,b=a+1,c=a+xs.length,d=c+1;indices.set([a,b,d,a,d,c],k);k+=6;}
  gl.bindBuffer(gl.ARRAY_BUFFER,this.vb!);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib!);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);this.count=indices.length;this.meshBytes=vertices.byteLength+indices.byteLength;
 }
 get bytes(){return this.canvas.width*this.canvas.height*8+this.meshBytes;}
 hide(){this.canvas.hidden=true;if(this.canvas.width>1||this.canvas.height>1){this.canvas.width=this.canvas.height=1;this.key='';}}
 draw(width:number,height:number,epoch:number,project:ReliefProjection,bounds:Bounds,gain:number,originHeight:number){
  const gl=this.gl;if(!gl||!this.program||this.error){this.hide();return false;}this.canvas.hidden=false;
  const angle=RATE*epoch,c=Math.cos(angle),s=Math.sin(angle),at=(x:number,y:number,z=0)=>project([c*x-s*y,s*x+c*y,z-gain*originHeight,0,0,0]);
  const origin=at(0,0),axes=[at(1,0),at(0,1),at(0,0,1)].map(p=>p.map((x,i)=>x-origin[i]));
  const key=[...origin,...axes.flat(),width,height,bounds.x,bounds.y,bounds.span,gain].map(v=>Math.round(v*1e8)/1e8).join(',');if(key===this.key){this.hits++;return true;}this.key=key;
  this.mesh(bounds);const ratio=Math.min(1,1024/Math.max(width,height));const w=Math.ceil(width*ratio),h=Math.ceil(height*ratio);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(12/255,20/255,29/255,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const loc=(name:string)=>{if(!this.locations.has(name))this.locations.set(name,gl.getUniformLocation(this.program!,name));return this.locations.get(name)!;};
  gl.uniform3fv(loc('origin'),origin.slice(0,3));for(let i=0;i<3;i++)gl.uniform3fv(loc(['axisX','axisY','axisZ'][i]),axes[i]);gl.uniform3f(loc('bounds'),bounds.x,bounds.y,bounds.span);gl.uniform2f(loc('viewport'),width,height);gl.uniform1f(loc('gain'),gain);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_INT,0);return true;
 }
}
