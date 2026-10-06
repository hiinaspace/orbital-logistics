// Pure propagation cost in installed Chrome; not an editor/input-to-paint benchmark.
import {writeFileSync} from 'node:fs';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
const server = await createServer({server:{host:'127.0.0.1',port:4179,strictPort:true}});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({channel:'chrome',headless:true});
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4179');
  const result = await page.evaluate(async () => {
    const model = await import('/spikes/numerics/model.ts');
    const data = await fetch('/spikes/numerics/encounter-samples.json').then(r => r.json());
    const {initial,horizon,step,burn} = data.meta;
    const times=[];
    let nodes;
    for (let i=0;i<12;i++) {
      const start=performance.now();
      nodes=model.canonical(initial,horizon,step,model.planetMoon,[burn]);
      const elapsed=performance.now()-start;
      if(i>=3) times.push(elapsed);
    }
    times.sort((a,b)=>a-b);
    return {userAgent:navigator.userAgent, horizon, step, branches:1,
      measuredRuns:times.length, discardedWarmups:3, medianMs:times[4], minMs:times[0],maxMs:times.at(-1),
      endpoint:model.query(nodes,horizon,model.planetMoon),
      scope:'Pure allocation-heavy RK4 propagation and node storage on main thread; excludes worker transfer, pointer-to-paint, solver, path rendering and browser startup.'};
  });
  writeFileSync('docs/evidence/browser-benchmark.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally {
  await browser?.close();
  await server.close();
}
