import { test, expect, type Page } from "@playwright/test";
const state = async (p: Page) =>
  JSON.parse((await p.locator("#state-json").textContent()) || "{}");
async function ready(p: Page, id?: string) {
  await expect
    .poll(
      async () => {
        const s = await state(p);
        return s.ready && (!id || s.set === id);
      },
      { timeout: 60000 },
    )
    .toBe(true);
}
async function pause(p: Page) {
  const button = p.getByRole("button", { name: "Pause", exact: true });
  if (await button.count()) await button.click();
}
async function seek(p: Page, t: number) {
  const s = await state(p);
  await p.locator("#ruler").focus();
  await p.keyboard.press("Home");
  const a = Number(await p.locator("#ruler").getAttribute("aria-valuemin"));
  const b = Number(await p.locator("#ruler").getAttribute("aria-valuemax"));
  const box = (await p.locator("#ruler").boundingBox())!; // ruler spans forecast; keyboard End clamps to flown head
  const labels = await p.locator("#ticks span").allTextContents();
  const end =
    Number(labels.at(-1)) * (s.set === "solar-cycler" ? 1 / 365.25 : 1);
  await p.mouse.click(
    box.x + (box.width * (t - a)) / (end - a),
    box.y + box.height / 2,
  );
  await expect
    .poll(async () => (await state(p)).t)
    .toBeCloseTo(Math.min(b, t), 1);
  await expect
    .poll(async () => {
      const s = await state(p);
      return s.views
        .filter((v: any) => v.visible)
        .every((v: any) => v.renderedEpoch === s.t);
    })
    .toBe(true);
}
const pane = (p: Page, n: number) => p.locator(".scene").nth(n);
const control = (p: Page, n: number, id: string) =>
  pane(p, n).locator(`[data-control="${id}"]`);
async function camera(p: Page, n: number) {
  if (await pane(p, n).evaluate((e) => e.classList.contains("camera-inline")))
    return;
  const details = pane(p, n).locator(".camera-menu");
  if (!(await details.evaluate((e) => (e as HTMLDetailsElement).open)))
    await details.locator("summary").click();
}
async function display(p: Page, n: number) {
  const details = pane(p, n).locator(".display-menu");
  if (!(await details.evaluate((e) => (e as HTMLDetailsElement).open)))
    await details.locator("summary").click();
}
const physical = (s: any) => ({
  t: s.t,
  ships: s.ships.map(({ screen, occludedBy, ...v }: any) => v),
  stocks: s.stocks,
  events: s.events,
});
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  (page as any).errors = errors;
});
test.afterEach(async ({ page }) => expect((page as any).errors).toEqual([]));

test("curated catalog loads every retained scene and supports paired frames", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/viewer/#set=orison-steered");
  await ready(page);
  expect(await page.locator("[data-set]").count()).toBe(11);
  const ids = await page
    .locator("[data-set]")
    .evaluateAll((es) => es.map((e) => (e as HTMLElement).dataset.set!));
  for (const id of ids) {
    await page.locator(`[data-set="${id}"]`).click();
    await ready(page, id);
    await pause(page);
    await page.getByLabel("View layout").selectOption("frames");
    await expect.poll(async () => (await state(page)).views.length).toBe(2);
    const s = await state(page);
    expect(s.views[0].frame).toBe("inertial");
    expect(["rotating", "libration"]).toContain(s.views[1].frame);
    expect(s.ships.length).toBeGreaterThan(0);
    expect(s.traffic?.error || "").toBe("");
  }
});

test("retired links show an intentional empty state; catalog metadata does not start an unrelated set", async ({
  page,
}) => {
  let workers = 0;
  page.on("worker", () => workers++);
  await page.goto("/viewer/#set=orison-freight");
  await expect(page.locator("#load-status")).toContainText("retired");
  expect(workers).toBe(0);
  expect((await state(page)).ready).not.toBe(true);
  await page.getByLabel("Find a set").fill("smooth transfer");
  await expect(page.locator("[data-set]")).toHaveCount(1);
  await page.locator('[data-set="orison-steered"]').click();
  await ready(page, "orison-steered");
  await page.evaluate(() => (location.hash = "set=lunar-loop"));
  await ready(page, "lunar-loop");
});

test("views preserve physical state, independent selection, locked tracking and camera pose on resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/viewer/#set=orison-steered");
  await ready(page);
  await pause(page);
  await seek(page, 2);
  const before = physical(await state(page));
  await page.getByLabel("View layout").selectOption("overview");
  await camera(page, 1);
  await control(page, 1, "tracking").locator('input[value="chase"]').check();
  await page.locator('[data-object="Incline"]').click();
  await expect.poll(async () => (await state(page)).selected).toBe("Incline");
  let s = await state(page);
  expect(s.views[1].camera.trackingTarget).toBe("Tern");
  expect(s.views[0].selected).toBe("Tern");
  expect(s.views[1].selected).toBe("Incline");
  expect(physical(s)).toEqual(before);
  const captured = structuredClone(s.views.map((v: any) => v.camera));
  await page.setViewportSize({ width: 1800, height: 1100 });
  await expect
    .poll(async () => (await state(page)).views[0].size.width)
    .toBeGreaterThan(400);
  s = await state(page);
  expect(s.views.map((v: any) => v.camera)).toEqual(captured);
  expect(physical(s)).toEqual(before);
  // Hover and wheel can affect pane0 without changing inspector ownership.
  const box = (await control(page, 0, "space").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -100);
  await expect
    .poll(async () => (await state(page)).views[0].camera.scale)
    .toBeGreaterThan(captured[0].scale);
  expect((await state(page)).activePane).toBe(s.activePane);
  await control(page, 0, "space").click({ position: { x: 10, y: 10 } });
  await expect
    .poll(async () => (await state(page)).activePane)
    .toBe((await state(page)).views[0].id);
  expect((await state(page)).selected).toBe("Tern");
});

test("split divider, maximize, close, duplicate and stacked axes retain local settings", async ({
  page,
}) => {
  await page.goto("/viewer/#set=orison-steered");
  await ready(page);
  await pause(page);
  await page.getByLabel("View layout").selectOption("axes");
  await expect
    .poll(async () => (await state(page)).views[1].camera.preset)
    .toBe("front");
  const fitted = (await state(page)).views;
  const density = (v: any) =>
    v.camera.scale / Math.min(v.size.width, v.size.height);
  expect(density(fitted[0])).toBeCloseTo(density(fitted[1]), 10);
  const before = physical(await state(page));
  await page.getByLabel("Resize views").focus();
  await page.keyboard.press("ArrowRight");
  await page.getByLabel("Stack views").click();
  await expect(page.locator("#viewports")).toHaveClass(/stacked/);
  await control(page, 1, "maximize").click();
  await expect
    .poll(
      async () =>
        (await state(page)).views.filter((v: any) => v.visible).length,
    )
    .toBe(1);
  await control(page, 1, "maximize").click();
  await control(page, 0, "close").click();
  await expect(page.locator(".scene")).toHaveCount(1);
  expect((await state(page)).camera.preset).toBe("front");
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await expect(page.locator(".scene")).toHaveCount(2);
  await expect
    .poll(async () => (await state(page)).views[1].camera.preset)
    .toBe("front");
  expect(physical(await state(page))).toEqual(before);
});

test("unified ruler and lanes scrub, collapse keeps ruler, reverse/center and keyboard preserve native controls", async ({
  page,
}) => {
  await page.goto("/viewer/#set=orison-steered");
  await ready(page);
  await pause(page);
  expect(
    await page.locator('input[aria-label="Simulation time"]').count(),
  ).toBe(0);
  await seek(page, 6);
  const s = await state(page);
  const lane = page.locator(".timeline-seek").first(),
    box = (await lane.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.25, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + 10, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).t).toBeCloseTo(12, 1);
  await page.getByRole("button", { name: "Activity", exact: false }).click();
  await expect(page.locator("#timelines")).not.toBeVisible();
  await expect(page.locator("#ruler")).toBeVisible();
  await page.getByLabel("Playback speed").fill("-0.5");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => (await state(page)).t).toBeLessThan(12);
  await page.getByLabel("Playback speed").fill("0");
  await expect.poll(async () => (await state(page)).playing).toBe(false);
  expect((await state(page)).playbackRate).toBe(0);
  await page.getByLabel("Find a set").focus();
  await page.keyboard.press("Space");
  expect((await state(page)).playing).toBe(false);
  await control(page, 0, "space").focus();
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(page)).playing).toBe(true);
});

test("pending continuous replies preserve held cursor and Live shares one worker for two views", async ({
  page,
}) => {
  test.setTimeout(90000);
  let workers = 0;
  page.on("worker", () => workers++);
  await page.goto("/viewer/#set=orison-freight-district");
  await ready(page);
  await page.getByLabel("Playback speed").fill("1");
  await expect
    .poll(async () => (await state(page)).traffic.frontier, { timeout: 30000 })
    .toBeGreaterThan(3);
  await pause(page);
  await page.getByLabel("View layout").selectOption("frames");
  const before = await state(page);
  await page.locator("#ruler").focus();
  await page.keyboard.press("Home");
  await expect.poll(async () => (await state(page)).t).toBe(0);
  await page.waitForTimeout(600);
  const held = await state(page);
  expect(held.t).toBe(0);
  expect(held.traffic.live).toBe(false);
  expect(held.views.length).toBe(2);
  expect(workers).toBe(1);
  await page
    .getByRole("button", { name: "Return to live", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).traffic.live).toBe(true);
  expect((await state(page)).traffic.frontier).toBeGreaterThanOrEqual(
    before.traffic.frontier,
  );
});

test("local display and repeated field pane disposal do not leak workers or GL resources", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    const Native = window.Worker;
    const active = new Set<Worker>();
    let glBuffers = 0;
    class Counted extends Native {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        active.add(this);
      }
      terminate() {
        active.delete(this);
        super.terminate();
      }
    }
    window.Worker = Counted;
    const create = WebGL2RenderingContext.prototype.createBuffer,
      remove = WebGL2RenderingContext.prototype.deleteBuffer;
    WebGL2RenderingContext.prototype.createBuffer = function () {
      glBuffers++;
      return create.call(this);
    };
    WebGL2RenderingContext.prototype.deleteBuffer = function (buffer) {
      if (buffer) glBuffers--;
      return remove.call(this, buffer);
    };
    Object.defineProperty(window, "resourceProbe", {
      get: () => ({ workers: active.size, buffers: glBuffers }),
    });
  });
  await page.goto("/viewer/#set=aster-selene-cycler-fleet-service");
  await ready(page);
  await pause(page);
  const probe = () => page.evaluate(() => (window as any).resourceProbe);
  expect((await probe()).workers).toBe(1);
  for (let i = 0; i < 20; i++) {
    await page.getByRole("button", { name: "Split", exact: true }).click();
    await display(page, 1);
    await control(page, 1, "layer-relief").check();
    await expect
      .poll(async () => (await state(page)).views[1].field.mode)
      .toBe("relief");
    expect((await probe()).buffers).toBe(3);
    await control(page, 1, "close").click();
    await expect.poll(async () => (await probe()).buffers).toBe(0);
    expect((await probe()).workers).toBe(1);
  }
  await display(page, 0);
  await control(page, 0, "layer-field").check();
  await expect
    .poll(async () => (await state(page)).field.ready, { timeout: 10000 })
    .toBe(true);
  expect((await probe()).workers).toBe(2);
  await page.locator('[data-set="orison-steered"]').click();
  await ready(page, "orison-steered");
  // The display layer remains enabled; Orison now owns one field worker.
  expect((await probe()).workers).toBe(1);
  expect((await state(page)).field.sources).toHaveLength(1);
  await page.locator('[data-set="aster-selene-cycler-fleet-service"]').click();
  await ready(page, "aster-selene-cycler-fleet-service");
  await pause(page);
  await display(page, 0);
  await control(page, 0, "layer-relief").check();
  await expect.poll(async () => (await state(page)).field.mode).toBe("relief");
  expect((await probe()).buffers).toBe(3);
  await page.locator("#restart").click();
  await ready(page, "aster-selene-cycler-fleet-service");
  await pause(page);
  await expect.poll(async () => (await state(page)).field.mode).toBe("relief");
  expect((await probe()).buffers).toBe(3);
});

test("loading cancellation rejects obsolete replies and all visible surfaces fit viewport budget", async ({
  page,
}) => {
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto("/viewer/#set=aster-selene-system");
  await page.locator('[data-set="orison-steered"]').click();
  await ready(page, "orison-steered");
  await pause(page);
  await page.getByLabel("View layout").selectOption("axes");
  await expect.poll(async () => (await state(page)).views.length).toBe(2);
  await control(page, 1, "maximize").click();
  const s = await state(page);
  expect(
    s.views.reduce((a: number, v: any) => a + v.size.backing, 0),
  ).toBeLessThanOrEqual(8300000 + 20000);
  await page.waitForTimeout(1000);
  expect((await state(page)).set).toBe("orison-steered");
});

test("focused camera shortcuts and per-pane display keep canonical samples unchanged", async ({
  page,
}) => {
  await page.goto("/viewer/#set=orison-steered");
  await ready(page);
  await pause(page);
  await seek(page, 13.7);
  const before = physical(await state(page));
  await page.getByLabel("View layout").selectOption("axes");
  await control(page, 1, "space").focus();
  await page.keyboard.press("t");
  await expect
    .poll(async () => (await state(page)).views[1].camera.preset)
    .toBe("top");
  await display(page, 1);
  await control(page, 1, "layer-labels").uncheck();
  await control(page, 1, "see-through").check();
  await expect
    .poll(async () => (await state(page)).views[1].layers.labels)
    .toBe(false);
  let s = await state(page);
  expect(s.views[0].layers.labels).toBe(true);
  expect(s.views[0].seeThroughBodies).toBe(false);
  expect(s.views[1].seeThroughBodies).toBe(true);
  expect(physical(s)).toEqual(before);
  await page.getByLabel("Resize views").focus();
  await page.keyboard.press("ArrowLeft");
  await page.getByLabel("Toggle inspector").click();
  expect(physical(await state(page))).toEqual(before);
});

test("a playing scrub pins its axis while held and resumes history on release", async ({
  page,
}) => {
  await page.goto("/viewer/#set=orison-freight-district");
  await ready(page);
  await page.getByLabel("Playback speed").fill("1");
  await expect
    .poll(async () => (await state(page)).traffic.frontier, { timeout: 20000 })
    .toBeGreaterThan(3);
  const ruler = page.locator("#ruler"),
    box = (await ruler.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.02, box.y + 12);
  await page.mouse.down();
  await expect.poll(async () => (await state(page)).playing).toBe(false);
  const ticks = await page.locator("#ticks").textContent();
  await page.waitForTimeout(300);
  expect(await page.locator("#ticks").textContent()).toBe(ticks);
  const chart = await page.locator(".budget-chart").evaluate((el) => {
    const svg = el as SVGSVGElement;
    return {
      start: Number(svg.dataset.start),
      end: Number(svg.dataset.end),
      cursor: svg
        .querySelector<SVGPathElement>(".budget-cursor")!
        .transform.baseVal.consolidate()!.matrix.e,
    };
  });
  const held = await state(page);
  expect(chart.cursor).toBeCloseTo(
    4 + ((held.t - chart.start) / (chart.end - chart.start)) * 232,
    4,
  );
  await page.mouse.move(box.x + box.width * 0.025, box.y + 12);
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).playing).toBe(true);
});

test("observatory staging, entry and halo phases remain inspectable in paired spatial frames", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/viewer/#set=helion-orison-observatory-mission");
  await ready(page);
  await pause(page);
  await page.getByLabel("View layout").selectOption("axes");
  for (const t of [
    0, 0.5, 1, 1.5, 2.5, 6, 15, 23.5, 24.5, 28.5, 37.5, 64, 79,
  ]) {
    await seek(page, t);
    const s = await state(page);
    expect(s.ships.every((v: any) => !v.y || v.y.every(Number.isFinite))).toBe(
      true,
    );
    expect(s.views.every((v: any) => Number.isFinite(v.camera.scale))).toBe(
      true,
    );
  }
  await seek(page, 15);
  const before = physical(await state(page));
  await seek(page, 0);
  await seek(page, 15);
  expect(physical(await state(page))).toEqual(before);
  await control(page, 1, "frame").selectOption("libration");
  await camera(page, 1);
  await control(page, 1, "camera-view")
    .locator('input[value="oblique"]')
    .check();
  await seek(page, 74);
  expect((await state(page)).equilibria).toHaveLength(5);
  await display(page, 1);
  await expect(control(page, 1, "layer-relief")).toBeVisible();
});

test("cycler Chase stays upright across the lunar flyby in both physical frames", async ({
  page,
}) => {
  await page.goto("/viewer/#set=aster-selene-cycler-fleet-service");
  await ready(page);
  await pause(page);
  await page.getByLabel("View layout").selectOption("frames");
  await page.locator('[data-select="Nomad"]').click();
  await camera(page, 0);
  await control(page, 0, "tracking").locator('input[value="chase"]').check();
  for (const frame of ["inertial", "rotating"]) {
    await control(page, 0, "frame").selectOption(frame);
    let previous: any;
    for (const t of [8.1, 8.12, 8.13, 8.14, 8.15, 8.16, 8.18]) {
      await seek(page, t);
      const rig = (await state(page)).camera.rig;
      expect(rig.up[2]).toBeCloseTo(1, 8);
      if (previous)
        expect(
          rig.forward.reduce(
            (v: number, x: number, i: number) => v + x * previous.forward[i],
            0,
          ),
        ).toBeGreaterThan(0.995);
      previous = rig;
    }
  }
});
