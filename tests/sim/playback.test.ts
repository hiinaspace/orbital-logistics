import {test} from 'node:test';
import assert from 'node:assert/strict';
import {speedPosition,speedAtPosition,maximumPlaybackRate} from '../../src/traffic/playback';
test('bidirectional speed has an exact pause, symmetric limits and fine slow-speed resolution',()=>{
 for(const maximum of [.02,2,4,16]){
  assert.equal(speedAtPosition(0,maximum),0);
  assert.equal(speedAtPosition(2,maximum),maximum);
  assert.equal(speedAtPosition(-2,maximum),-maximum);
  let previous=-Infinity;
  for(let i=-1000;i<=1000;i++){
   const position=i/1000,rate=speedAtPosition(position,maximum);
   assert.ok(rate>=previous);previous=rate;
   assert.ok(Math.abs(speedPosition(rate,maximum)-position)<=(Math.abs(position)<=.01?.01:.000050001));
   assert.ok(Math.abs(rate+speedAtPosition(-position,maximum))<1e-12);
  }
  for(const rate of [.001,.01,.1,.5,1,2,4,16].filter(r=>r<=maximum)){
   assert.equal(speedAtPosition(speedPosition(rate,maximum),maximum),rate);
   assert.equal(speedAtPosition(speedPosition(-rate,maximum),maximum),-rate);
  }
 }
 // A physical 0.1x speed gets substantial travel on the control even at a16x cap.
 assert.ok(speedPosition(.2,16)-speedPosition(.1,16)>.07);
 assert.equal(maximumPlaybackRate('orison-relay-network'),2);
});
