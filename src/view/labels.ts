export interface Label {id:string; text:string; x:number; y:number; width:number; priority:number; color:string}
export interface PlacedLabel extends Label {anchor:number; alpha:number; left:number; top:number}
interface Memory {anchor:number; visible:boolean; pending?:number; alpha:number; last:number}
const offsets=(width:number)=>[[13,-10],[13,19],[-width-13,-10],[-width-13,19],[13,-28],[13,36]];
const overlaps=(a:{left:number;top:number;width:number},b:{left:number;top:number;width:number})=>
  a.left+a.width+4>b.left && b.left+b.width+4>a.left && Math.abs(a.top-b.top)<17;
// Anchors never chase a newly freed slot. Only visibility changes, with dwell and
// fade in presentation time. Scene changes reset; frame/seek/pan/zoom retain IDs.
export class StableLabels {
  #memory=new Map<string,Memory>();
  reset(){this.#memory.clear();}
  layout(labels:Label[],now:number):PlacedLabel[] {
    const occupied:PlacedLabel[]=[], result:PlacedLabel[]=[];
    for(const label of [...labels].sort((a,b)=>b.priority-a.priority || a.id.localeCompare(b.id))) {
      let memory=this.#memory.get(label.id);
      const place=(anchor:number):PlacedLabel=>({...label,anchor,alpha:1,left:label.x+offsets(label.width)[anchor][0],top:label.y+offsets(label.width)[anchor][1]});
      if(!memory) {
        const anchor=offsets(label.width).findIndex((_,i)=>!occupied.some(b=>overlaps(place(i),b)));
        memory={anchor:Math.max(0,anchor),visible:anchor>=0,pending:undefined,alpha:anchor>=0?1:0,last:now};this.#memory.set(label.id,memory);
      }
      const p=place(memory.anchor), wanted=label.priority>=100 || !occupied.some(b=>overlaps(p,b));
      if(wanted===memory.visible)memory.pending=undefined;
      else {
        memory.pending??=now;
        if(label.priority>=100 || now-memory.pending>=(wanted?260:150)){memory.visible=wanted;memory.pending=undefined;}
      }
      const delta=Math.max(0,Math.min(100,now-memory.last))/140;memory.last=now;
      memory.alpha=memory.visible?Math.min(1,memory.alpha+delta):Math.max(0,memory.alpha-delta);
      p.alpha=memory.alpha;result.push(p);
      // Higher priority objects reserve a slot even during their fade-in.
      if(wanted)occupied.push(p);
    }
    return result;
  }
}
