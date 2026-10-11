// Opt-in, bounded presentation diagnostics. It never changes the simulation,
// playback clock, layer preferences or renderer behavior.
export const viewerProfile={
 active:false,rows:{} as Record<string,number[]>,last:0,
 start(){this.rows={};this.last=0;this.active=true;},
 record(name:string,value:number){if(!this.active)return;const rows=this.rows[name]??(this.rows[name]=[]);if(rows.length<10000)rows.push(value);},
 frame(now:number){if(this.active){if(this.last)this.record('frameGap',now-this.last);this.last=now;}},
 stop(){this.active=false;return this.rows;}
};
