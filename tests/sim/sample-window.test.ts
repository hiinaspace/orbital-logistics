import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleWindow} from '../../src/viewer/sample-window';
test('indexed display windows preserve exact filter membership, duplicate event epochs and edge order',()=>{
 const rows=[0,.001,1,1,1,1.00001,2,10].map((t,i)=>({t,id:i}));
 for(const start of [-Infinity,-1,0,.0005,1,1.00001,10,11,Infinity])for(const end of [-Infinity,0,1,1.00001,2,10,Infinity])for(const left of [true,false])for(const right of [true,false]){
  const expected=rows.filter(s=>(left?s.t>=start:s.t>start)&&(right?s.t<=end:s.t<end));
  const actual=sampleWindow(rows,start,end,left,right);assert.deepEqual(actual,expected);for(const row of actual)assert.equal(row,rows[row.id]);
 }
 assert.deepEqual(sampleWindow([],0,1),[]);
});
