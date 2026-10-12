// Drawing opacity only. Scale decay to the visible history and fade the oldest
// fifth to zero before samples are evicted; no change to physical retention.
export function trailOpacity(epoch:number,cursor:number,oldest:number,selected:boolean,maxAge=12):number {
 const age=cursor-epoch,span=Math.max(0,Math.min(maxAge,cursor-oldest)),base=selected?.7:.4;
 if(age<0||age>span)return 0;
 if(age===0)return base;
 if(span===0)return 0;
 const edge=Math.max(0,Math.min(1,(span-age)/(span*.2)));
 return base*Math.exp(-age/Math.max(1e-9,span/3))*edge*edge*(3-2*edge);
}
