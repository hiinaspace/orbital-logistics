import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StableLabels,type Label} from '../../src/view/labels';
const label=(id:string,x:number,y=0,priority=0):Label=>({id,text:id,x,y,priority,width:60,color:'#fff'});
test('moving and reversing labels retain anchors through transient collisions and selection changes',()=>{
  const layout=new StableLabels(),initial=layout.layout([label('a',0),label('b',200)],0);
  const anchors=initial.map(l=>l.anchor);
  for(const [time,x] of [[16,150],[32,0],[48,200],[64,100],[80,200]])assert.deepEqual(layout.layout([label('a',0),label('b',x)],time).map(l=>l.anchor),anchors);
  // Sustained collision fades a lower priority label; separation has longer dwell.
  for(let t=100;t<=500;t+=20)layout.layout([label('a',0),label('b',0)],t);
  assert.equal(layout.layout([label('a',0),label('b',0)],520).find(l=>l.id==='b')!.alpha,0);
  const selected=layout.layout([label('a',0),label('b',0,0,100)],540).find(l=>l.id==='b')!;
  assert.ok(selected.alpha>0);assert.equal(selected.anchor,anchors[1]);
  layout.reset();assert.equal(layout.layout([label('b',0)],600)[0].alpha,1);
});
