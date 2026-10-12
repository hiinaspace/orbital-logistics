import {sampleField,type FieldRequest} from './potential-field';
self.onmessage=(event:MessageEvent<FieldRequest>)=>{
 try {const grid=sampleField(event.data);self.postMessage({grid}, {transfer:[grid.pixels.buffer,grid.segments.buffer]});}
 catch(error){self.postMessage({id:event.data.id,error:String(error)});}
};
