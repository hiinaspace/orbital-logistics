import {test,expect,type Page} from '@playwright/test';

async function state(page:Page){return JSON.parse(await page.locator('#state-json').textContent()??'{}');}
async function ready(page:Page){await expect.poll(async()=>(await state(page)).ready,{timeout:30000}).toBe(true);}
const physical=(s:any)=>({ships:s.ships.map(({screen,occludedBy,...rest}:any)=>rest),stocks:s.stocks,events:s.events,t:s.t});

for(const viewport of [{width:3840,height:2160},{width:1440,height:900},{width:1024,height:768},{width:390,height:844},{width:320,height:640}]){
 test(`viewer fits ${viewport.width}×${viewport.height} with usable overlays and controls`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize(viewport);await page.goto('/');await ready(page);
  await page.getByLabel('Model set').selectOption('crossing-planes');await ready(page);
  if((await state(page)).playing)await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByLabel('Simulation time').fill('8');
  await expect.poll(async()=>(await state(page)).t).toBe(8);
  const canvas=page.locator('#space'),box=(await canvas.boundingBox())!;
  if(viewport.width>=1000){expect(box).toEqual({x:0,y:0,width:viewport.width,height:viewport.height});}
  else {expect(box.width).toBeGreaterThan(viewport.width-24);expect(box.height).toBeGreaterThan(300);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width);
  const layers=page.locator('#layers');await layers.locator('summary').click();
  const options=(await layers.locator('.layer-options').boundingBox())!;
  expect(options.x).toBeGreaterThanOrEqual(0);expect(options.x+options.width).toBeLessThanOrEqual(viewport.width);
  await page.getByLabel('See-through bodies').check();await layers.locator('summary').click();
  // A pointer seek must reach the timeline through the floating panel, pause,
  // and remain independent of the canvas immediately underneath it.
  const track=page.locator('.timeline-track').first(),trackBox=(await track.boundingBox())!;
  await page.mouse.click(trackBox.x+trackBox.width*.65,trackBox.y+trackBox.height/2);
  await expect.poll(async()=>(await state(page)).t).not.toBe(8);
  expect((await state(page)).playing).toBe(false);
  await page.getByLabel('Simulation time').fill('8');
  await page.getByLabel('Camera view').selectOption('top');
  await canvas.scrollIntoViewIfNeeded();
  const currentBox=(await canvas.boundingBox())!;
  const before=await state(page);
  const point={x:currentBox.x+currentBox.width*.45,y:currentBox.y+currentBox.height*.45};
  expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,point)).toBe('space');
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+35,point.y+15,{steps:4});await page.mouse.up();
  await expect.poll(async()=>(await state(page)).camera.center).not.toEqual(before.camera.center);
  expect(physical(await state(page))).toEqual(physical(before));
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  // Select an actual unobstructed canvas hit using viewport-local coordinates.
  const hit=await page.evaluate(()=>{
   const s=JSON.parse(document.getElementById('state-json')!.textContent!),r=document.getElementById('space')!.getBoundingClientRect();
   return s.hits.find((h:any)=>h.id!==s.selected && document.elementFromPoint(r.left+h.x,r.top+h.y)?.id==='space');
  });
  expect(hit).toBeTruthy();
  const hitBox=(await canvas.boundingBox())!;
  await page.mouse.click(hitBox.x+hit.x,hitBox.y+hit.y);
  if(await page.locator('#hit-menu').isVisible())await page.locator(`[data-hit="${hit.id}"]`).click();
  await expect.poll(async()=>(await state(page)).selected).toBe(hit.id);
  expect(errors).toEqual([]);
  if([3840,1440,390].includes(viewport.width))await page.screenshot({path:`docs/evidence/full-browser-${viewport.width}.png`,fullPage:true});
 });
}
