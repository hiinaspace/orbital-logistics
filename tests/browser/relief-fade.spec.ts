import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {transformSync} from 'rolldown/utils';
import {RATE} from '../../src/compact/physics';
// Isolated production shader class, compiled without changing its implementation.
// The test canvas does not touch the app's field buffers, physics or active view.
const source=readFileSync('src/view/relief.ts','utf8').replace("import {RATE} from '../compact/physics';",`const RATE=${RATE};`).replace("import type {Bounds} from './potential-field';",'').replace('export class ReliefRenderer','class ReliefRenderer')+'\n(window as any).FadeProbe=ReliefRenderer;';
const script=transformSync('relief-probe.ts',source,{lang:'ts',target:'es2022'}).code.replace('export {};','');
test('production relief alpha fades radially across overview and detail meshes',async({page})=>{
 await page.goto('/');await page.addScriptTag({content:script});
 const samples=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');document.body.append(canvas);const renderer=new (window as any).FadeProbe(canvas),gl=canvas.getContext('webgl2')!;
  const projection=(p:number[])=>[256+16*p[0],256-16*p[1],-16*p[2]];
  const sample=(x:number,y:number)=>{const pixels=new Uint8Array(5*5*4);gl.readPixels(Math.round(256+16*x)-2,512-Math.round(256-16*y)-2,5,5,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let max=0;for(let i=3;i<pixels.length;i+=4)max=Math.max(max,pixels[i]);return max;};
  const overview={x:-12,y:-12,span:24};if(!renderer.draw(512,512,0,projection,overview,1,0,false,1,0,[0,0],1))throw Error(renderer.error);
  const full={inside:sample(8,0),fade:sample(10,0),outside:sample(11.5,0),corner:sample(10,10)};
  renderer.draw(512,512,0,projection,overview,1,0,false,1,0,[0,0],.5);const dim=sample(8,0);
  renderer.draw(512,512,0,projection,overview,1,0,false,1,0,[0,0],0);const zero=sample(8,0);
  const local=(p:number[])=>[256+16*(p[0]-8),256-16*p[1],-16*p[2]];renderer.draw(512,512,0,local,{x:7.5,y:-.5,span:1},1,0,false,1,0,[0,0],1);
  const pixel=new Uint8Array(5*5*4);gl.readPixels(254,254,5,5,gl.RGBA,gl.UNSIGNED_BYTE,pixel);let detail=0;for(let i=3;i<pixel.length;i+=4)detail=Math.max(detail,pixel[i]);canvas.remove();return {full,dim,zero,detail};
 });
 expect(samples.full.inside).toBeGreaterThan(20);expect(samples.full.fade).toBeGreaterThan(0);expect(samples.full.fade).toBeLessThan(samples.full.inside*.6);expect(samples.full.outside).toBe(0);expect(samples.full.corner).toBe(0);expect(samples.dim).toBeLessThan(samples.full.inside*.65);expect(samples.dim).toBeGreaterThan(samples.full.inside*.35);expect(samples.zero).toBe(0);// Different triangulation changes fwidth at grid crossings; allow <6.3% alpha raster variance.
 expect(Math.abs(samples.detail-samples.full.inside)).toBeLessThan(16);
 writeFileSync('docs/evidence/relief-fade-pixels.json',JSON.stringify(samples,null,2)+'\n');
});
