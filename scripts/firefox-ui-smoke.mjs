/** Test the installed Firefox, with an isolated profile owned by this process.
 * FIREFOX_TEST_URL=http://127.0.0.1:4178 npm run test:firefox
 * Requires firefox + geckodriver on PATH. Never attaches to a personal session. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
const baseURL = process.env.FIREFOX_TEST_URL ?? "http://127.0.0.1:4178";
const scratchRoot = path.resolve(".scratch");
await mkdir(scratchRoot, { recursive: true });
const scratch = await mkdtemp(path.join(scratchRoot, "firefox-ui-"));
const evidence = path.resolve(
  process.env.FIREFOX_TEST_OUTPUT_DIR ?? "test-results/firefox-ui",
);
await mkdir(evidence, { recursive: true });
// Snap's wrapper confines geckodriver and can reject termination by its own
// parent. The packaged driver binary works without that wrapper confinement.
let driverBinary = process.env.GECKODRIVER_BIN ?? "geckodriver";
if (!process.env.GECKODRIVER_BIN) {
  try {
    await access("/snap/firefox/current/usr/lib/firefox/geckodriver");
    driverBinary = "/snap/firefox/current/usr/lib/firefox/geckodriver";
  } catch {}
}
const driver = spawn(
  driverBinary,
  ["--host", "127.0.0.1", "--port", "0", "--profile-root", scratch],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "",
  session,
  endpoint;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const receive = (data) => {
  logs = (logs + data.toString()).slice(-16000);
};
driver.on("error", (error) => {
  logs += "\n" + error.message;
});
driver.stdout.on("data", receive);
driver.stderr.on("data", receive);
async function until(fn, label, timeout = 60000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (e) {
      last = e;
    }
    await delay(100);
  }
  throw Error("Timed out: " + label + (last ? " (" + last.message + ")" : ""));
}
async function request(
  route,
  body,
  method = body === undefined ? "GET" : "POST",
) {
  const response = await fetch(endpoint + route, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(65000),
  }).then((r) => r.json());
  if (response.value?.error) throw Error(JSON.stringify(response.value));
  return response.value;
}
const wd = (route, body, method) =>
  request("/session/" + session + route, body, method);
const js = (script, ...args) => wd("/execute/sync", { script, args });
const state = () =>
  js(
    'return JSON.parse(document.querySelector("#state-json")?.textContent||"{}");',
  );
async function ready(id) {
  await until(async () => {
    const s = await state();
    return s.ready && s.set === id;
  }, id);
  await js(
    'if(document.querySelector("#play").textContent==="Pause")document.querySelector("#play").click();',
  );
}
async function load(id) {
  await js('location.hash="set="+arguments[0]', id);
  await ready(id);
}
async function screenshot(name) {
  await writeFile(
    path.join(evidence, name + ".png"),
    Buffer.from(await wd("/screenshot"), "base64"),
  );
}
async function element(selector) {
  const found = await wd("/element", {
    using: "css selector",
    value: selector,
  });
  return found["element-6066-11e4-a52e-4f735466cecf"];
}
async function key(selector, value) {
  await wd("/element/" + (await element(selector)) + "/value", { text: value });
}
async function drag(selector, delta) {
  const r = await js(
      "return document.querySelector(arguments[0]).getBoundingClientRect().toJSON()",
      selector,
    ),
    x = Math.round(r.x + r.width / 2),
    y = Math.round(r.y + r.height / 2);
  await wd("/actions", {
    actions: [
      {
        type: "pointer",
        id: "mouse",
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", x, y, duration: 0 },
          { type: "pointerDown", button: 0 },
          { type: "pointerMove", x: x + delta, y, duration: 150 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
}
try {
  await until(
    () => logs.match(/Listening on 127\.0\.0\.1:(\d+)/)?.[1],
    "geckodriver",
    15000,
  ).then((port) => (endpoint = "http://127.0.0.1:" + port));
  const created = await request("/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "firefox",
        "moz:firefoxOptions": { args: ["-headless"] },
      },
    },
  });
  session = created.sessionId;
  console.log(
    "Firefox " +
      created.capabilities.browserVersion +
      "; isolated profile " +
      created.capabilities["moz:profile"],
  );
  await wd("/window/rect", { width: 1700, height: 1050 });
  await wd("/url", { url: baseURL + "/" });
  await until(
    () =>
      js(
        'return Number(document.querySelector("#hero-canvas")?.dataset.frames)>0',
      ),
    "landing preview",
  );
  assert.equal(
    await js('return !!document.querySelector("#state-json")'),
    false,
    "landing has no workspace",
  );
  assert.equal(
    await js(
      'return performance.getEntriesByType("resource").some(e => /viewer-|prepare\.worker|traffic\.worker|recurring-cycler|solar-cycler/.test(e.name))',
    ),
    false,
    "landing has no viewer downloads",
  );
  await screenshot("landing");
  await wd("/url", { url: baseURL + "/viewer/#set=solar-cycler" });
  await ready("solar-cycler");
  for (const value of ["oblique", "top"]) {
    await wd(
      "/element/" +
        (await element(
          '[data-control="camera-view"] input[value="' + value + '"]',
        )) +
        "/click",
      {},
    );
    assert.equal(
      await js(
        `return [...document.querySelectorAll('[data-control="camera-view"] input')].find(e => e.value===arguments[0]).checked`,
        value,
      ),
      true,
    );
  }

  await js(
    'window.uiErrors=[];addEventListener("error",e=>uiErrors.push(e.message));addEventListener("unhandledrejection",e=>uiErrors.push(String(e.reason)));window.optionChanges=0;window.frameElementProbe=document.querySelector("[data-control=frame]");window.optionObserver=new MutationObserver(ms=>optionChanges+=ms.length);optionObserver.observe(frameElementProbe,{attributes:true,childList:true,subtree:true});',
  );
  await wd(
    "/element/" + (await element("[data-control=frame]")) + "/click",
    {},
  );
  // Native popups are outside the viewport screenshot; verify their open state
  // through :open rather than inferring it from a focused select.
  if (!(await js('return frameElementProbe.matches(":open")')))
    await key("[data-control=frame]", " ");
  assert.equal(
    await js('return frameElementProbe.matches(":open")'),
    true,
    "native frame menu is actually open",
  );
  await delay(900);
  assert.equal(
    await js("return optionChanges"),
    0,
    "paused open frame selector must not mutate",
  );
  assert.equal(
    await js(
      'return frameElementProbe===document.querySelector("[data-control=frame]")',
    ),
    true,
  );
  await screenshot("solar-frame-menu");
  await key("[data-control=frame]", "\uE00C");
  assert.ok(
    (
      await js(
        'return document.querySelector("[data-control=frame]").textContent',
      )
    ).includes("Brontes centered"),
  );
  assert.ok(
    !(await js('return document.querySelector("#fleet").textContent')).includes(
      "powered cycler",
    ),
  );
  assert.ok(
    (
      await js(
        'return getComputedStyle(document.querySelector(".speed-groove")).backgroundImage',
      )
    ).includes("linear-gradient"),
  );
  for (const n of [-0.6, 0, 0.6]) {
    await js(
      'const e=document.querySelector("#speed");e.value=arguments[0];e.dispatchEvent(new Event("input"));',
      n,
    );
    const [lo, hi] = await js(
      'const s=document.querySelector(".speed-groove").style;return [parseFloat(s.getPropertyValue("--speed-low")),parseFloat(s.getPropertyValue("--speed-high"))];',
    );
    assert.ok(
      Math.abs(lo - Math.min(50, 50 + 50 * n)) < 0.1 &&
        Math.abs(hi - Math.max(50, 50 + 50 * n)) < 0.1,
    );
  }
  await js(
    'document.querySelector("#speed").value=0;document.querySelector("#speed").dispatchEvent(new Event("input"));',
  );
  const before = await js(
    'return document.querySelector(".speed-control").getBoundingClientRect().toJSON()',
  );
  assert.equal(before.x + before.width / 2, 850, "speed group centered");
  const camera = (await state()).views[0].camera;
  await drag("#library-resize", 75);
  await drag("#inspector-resize", -60);
  const widths = await js(
    'return [document.querySelector(".library"),document.querySelector("aside")].map(e=>e.getBoundingClientRect().width)',
  );
  assert.ok(widths[0] >= 300 && widths[1] >= 325, JSON.stringify(widths));
  assert.deepEqual(
    (await state()).views[0].camera,
    camera,
    "sidebar resize preserves camera",
  );
  await key("#library-resize", "\uE011"); // Home resets the panel width.
  await load("aster-selene-cycler-fleet-service");
  const center = await js(
    'return document.querySelector(".speed-control").getBoundingClientRect().toJSON()',
  );
  await js('document.querySelector("#live").click()');
  await delay(300);
  assert.deepEqual(
    await js(
      'return document.querySelector(".speed-control").getBoundingClientRect().toJSON()',
    ),
    center,
    "Live label changes cannot shift speed",
  );
  await ready("aster-selene-cycler-fleet-service");
  for (const id of [
    "orison-steered",
    "selene-ground-service",
    "lunar-loop",
    "helion-orison-survey",
  ]) {
    await load(id);
    await js(
      'document.querySelector("[data-control=layers]").open=true;const e=document.querySelector("[data-control=layer-field]");e.checked=true;e.dispatchEvent(new Event("change"));',
    );
    await until(
      async () => (await state()).views[0].field.ready,
      id + " field",
    );
    let field = (await state()).views[0].field;
    assert.equal(field.supported, true);
    assert.equal(field.error, "");
    await screenshot(id + "-map");
    await js(
      'const e=document.querySelector("[data-control=layer-relief]");e.checked=true;e.dispatchEvent(new Event("change"));',
    );
    await until(async () => {
      const f = (await state()).views[0].field;
      assert.equal(f.reliefError, "");
      return f.mode === "relief";
    }, id + " relief");
    field = (await state()).views[0].field;
    assert.ok(field.bytes < 16 * 1024 * 1024);
    await screenshot(id + "-relief");
  }
  await js('document.querySelector("#collapse-timeline").click()');
  assert.equal(
    await js(
      'return getComputedStyle(document.querySelector("#timelines")).display',
    ),
    "none",
  );
  assert.ok(
    await js(
      'return document.querySelector("#ruler").getBoundingClientRect().width>0',
    ),
  );
  assert.deepEqual(await js("return uiErrors"), []);
  console.log(
    "PASS: native open dropdown is stable; bipolar track/fill; centered playback; pointer/keyboard sidebar sizing; fictional labels; four field/relief sets; activity disclosure.",
  );
} catch (error) {
  try {
    await screenshot("failure");
  } catch {}
  console.error(error);
  console.error(logs.slice(-4000));
  throw error;
} finally {
  if (session)
    try {
      await request("/session/" + session, undefined, "DELETE");
    } catch {}
  driver.kill("SIGTERM");
  await Promise.race([new Promise((r) => driver.once("exit", r)), delay(2000)]);
  await rm(scratch, { recursive: true, force: true });
}
