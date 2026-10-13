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
uniform vec3 view,bounds;
uniform vec2 gridOffset;
uniform float gain,colored,gridStep,gridPhase,outline,gridStrength;
float tone(float p){return clamp(log(max(.095,-p)/.095)/log(1.4/.095),0.,1.);}
void main(){float fade=1.-smoothstep(8.,11.,length(q));float r=length(q),m=length(q-vec2(5.,0.));if(r<=1.||m<=.2)discard;if(outline>.5){discard;}float p=-1./r-.03/m;float t=tone(p),u=t*4.;vec3 a,b;
if(u<1.){a=vec3(12,20,29);b=vec3(17,29,36);}else if(u<2.){a=vec3(17,29,36);b=vec3(24,43,42);}else if(u<3.){a=vec3(24,43,42);b=vec3(54,63,45);}else{a=vec3(54,63,45);b=vec3(104,90,62);}
vec3 tint=mix(a,b,clamp(u-min(3.,floor(u)),0.,1.))/255.;
float levels[10]=float[10](-.1,-.13,-.17,-.22,-.29,-.38,-.5,-.66,-.87,-1.15);float contour=0.;float w=max(fwidth(p),.000001);for(int i=0;i<10;i++)contour=max(contour,1.-smoothstep(0.,.65*w,abs(p-levels[i])));
float c=cos(gridPhase),s=sin(gridPhase);vec2 coordinate=(mat2(c,s,-s,c)*q+gridOffset)/max(gridStep,.000001);vec2 distance=abs(fract(coordinate+.5)-.5)/max(fwidth(coordinate),vec2(.000001));float grid=gridStep>0.?1.-smoothstep(.15,.85,min(distance.x,distance.y)):0.;
vec2 grad=vec2(q.x/(r*r*r)+.03*(q.x-5.)/(m*m*m),q.y/(r*r*r)+.03*q.y/(m*m*m));vec2 slope=(t>0.&&t<1.)?(-2.4*gain/(log(1.4/.095)*p))*grad:vec2(0.);vec3 normal=normalize(vec3(-slope,1.));float facing=abs(dot(normal,normalize(view)));float silhouette=1.-smoothstep(.012,.045,facing);
vec2 boundary=min(q-bounds.xy,bounds.xy+vec2(bounds.z)-q)/max(fwidth(q),vec2(.000001));float rim=abs(normalize(view).z)<.45?1.-smoothstep(.3,1.2,min(boundary.x,boundary.y)):0.;
float line=max(max(grid*.33*gridStrength,contour*.28*colored),silhouette*.65);float fill=colored*.20*t;float baseAlpha=line+fill*(1.-line);float alpha=baseAlpha*fade;if(alpha<.002)discard;vec3 rgb=(vec3(.52,.64,.66)*line+tint*fill*(1.-line))/baseAlpha;color=vec4(rgb,alpha);}`;
// Disposable display mesh; no spacecraft state or event time enters its buffers.
export class ReliefRenderer {
 private gl:WebGL2RenderingContext|null;private program?:WebGLProgram;private count=0;private key='';private meshKey='';private meshBytes=0;private vb?:WebGLBuffer;private ib?:WebGLBuffer;private eb?:WebGLBuffer;private edgeCount=0;private locations=new Map<string,WebGLUniformLocation|null>();
 error='';hits=0;
 constructor(private canvas:HTMLCanvasElement){
  this.gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false});const gl=this.gl;
  if(!gl){this.error='WebGL2 unavailable';return;}
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.error='Relief context lost';this.key='';});
  const shader=(kind:number,source:string)=>{const s=gl.createShader(kind)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)??'Relief shader');return s;};
  try{
   const vertex=shader(gl.VERTEX_SHADER,VERTEX),fragment=shader(gl.FRAGMENT_SHADER,FRAGMENT),p=gl.createProgram()!;gl.attachShader(p,vertex);gl.attachShader(p,fragment);gl.linkProgram(p);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)??'Relief link');this.program=p;gl.useProgram(p);
   this.vb=gl.createBuffer()!;this.ib=gl.createBuffer()!;this.eb=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,this.vb);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib);const attribute=gl.getAttribLocation(p,'uv');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  }catch(error){this.error=String(error);}
 }
 private mesh(bounds:Bounds){
  const key=[bounds.x,bounds.y,bounds.span].join(',');if(key===this.meshKey)return;this.meshKey=key;const gl=this.gl!;
  const coordinates=(low:number,axis:number)=>{const values=Array.from({length:97},(_,i)=>low+bounds.span*i/96);for(const [center,radius] of (axis===0?[[0,1],[5,.2]]:[[0,1],[0,.2]]))for(let i=-48;i<=48;i++){const point=center+Math.sign(i)*radius*4*(i/48)**2;if(point>low&&point<low+bounds.span)values.push(point);}return [...new Set(values)].sort((a,b)=>a-b);};
  const xs=coordinates(bounds.x,0),ys=coordinates(bounds.y,1),vertices=new Float32Array(xs.length*ys.length*2),indices=new Uint32Array((xs.length-1)*(ys.length-1)*6);let v=0,k=0;
  for(const y of ys)for(const x of xs){vertices[v++]=(x-bounds.x)/bounds.span;vertices[v++]=(y-bounds.y)/bounds.span;}
  for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){const a=j*xs.length+i,b=a+1,c=a+xs.length,d=c+1;indices.set([a,b,d,a,d,c],k);k+=6;}
  const edge:number[]=[];const segment=(a:number,b:number)=>edge.push(a,b);for(let i=0;i<xs.length-1;i++){segment(i,i+1);segment((ys.length-1)*xs.length+i,(ys.length-1)*xs.length+i+1);}for(let j=0;j<ys.length-1;j++){segment(j*xs.length,(j+1)*xs.length);segment(j*xs.length+xs.length-1,(j+1)*xs.length+xs.length-1);}const boundary=new Uint32Array(edge);this.edgeCount=boundary.length;gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.eb!);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,boundary,gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.vb!);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib!);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);this.count=indices.length;this.meshBytes=vertices.byteLength+indices.byteLength+boundary.byteLength;
 }
 get bytes(){return this.canvas.width*this.canvas.height*8+this.meshBytes;}
 hide(){this.canvas.hidden=true;if(this.canvas.width>1||this.canvas.height>1){this.canvas.width=this.canvas.height=1;this.key='';}}
 draw(width:number,height:number,epoch:number,project:ReliefProjection,bounds:Bounds,gain:number,originHeight:number,colored=true,gridStep=1,gridPhase=0,gridOffset:readonly number[]=[0,0],gridStrength=.55){
  const gl=this.gl;if(!gl||!this.program||this.error){this.hide();return false;}this.canvas.hidden=false;
  const angle=RATE*epoch,c=Math.cos(angle),s=Math.sin(angle),at=(x:number,y:number,z=0)=>project([c*x-s*y,s*x+c*y,z-gain*originHeight,0,0,0]);
  const origin=at(0,0),axes=[at(1,0),at(0,1),at(0,0,1)].map(p=>p.map((x,i)=>x-origin[i]));
  const key=[...origin,...axes.flat(),width,height,bounds.x,bounds.y,bounds.span,gain,colored?1:0,gridStep,gridPhase,gridStrength,...gridOffset].map(v=>Math.round(v*1e8)/1e8).join(',');if(key===this.key){this.hits++;return true;}this.key=key;
  this.mesh(bounds);const ratio=Math.min(1,1024/Math.max(width,height));const w=Math.ceil(width*ratio),h=Math.ceil(height*ratio);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const loc=(name:string)=>{if(!this.locations.has(name))this.locations.set(name,gl.getUniformLocation(this.program!,name));return this.locations.get(name)!;};
  gl.uniform3fv(loc('origin'),origin.slice(0,3));for(let i=0;i<3;i++)gl.uniform3fv(loc(['axisX','axisY','axisZ'][i]),axes[i]);gl.uniform3f(loc('bounds'),bounds.x,bounds.y,bounds.span);gl.uniform2f(loc('viewport'),width,height);gl.uniform1f(loc('gain'),gain);gl.uniform1f(loc('gridStrength'),gridStrength);gl.uniform1f(loc('colored'),colored?1:0);gl.uniform1f(loc('gridStep'),gridStep);gl.uniform1f(loc('gridPhase'),gridPhase);gl.uniform2f(loc('gridOffset'),gridOffset[0],gridOffset[1]);gl.uniform3f(loc('view'),axes[0][2],axes[1][2],axes[2][2]);gl.uniform1f(loc('outline'),0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib!);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_INT,0);const toward=Math.hypot(axes[0][2],axes[1][2],axes[2][2]);if(Math.abs(axes[2][2])/toward<.45){gl.uniform1f(loc('outline'),1);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.eb!);gl.drawElements(gl.LINES,this.edgeCount,gl.UNSIGNED_INT,0);}return true;
 }
}
