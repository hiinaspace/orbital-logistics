import { test, expect, type Page } from "@playwright/test";
const state = async (p: Page) =>
  JSON.parse((await p.locator("#state-json").textContent()) || "{}");
async function ready(p: Page, id: string) {
  await expect
    .poll(
      async () => {
        const s = await state(p);
        return s.ready && s.set === id;
      },
      { timeout: 60000 },
    )
    .toBe(true);
  const pause = p.getByRole("button", { name: "Pause", exact: true });
  if (await pause.count()) await pause.click();
}
const control = (p: Page, id: string) =>
  p.locator(".scene").first().locator(`[data-control="${id}"]`);
test("library descriptions are expanded at selection, links are separate and presentation names remain fictional", async ({
  page,
}) => {
  await page.goto("/#set=solar-cycler");
  await ready(page, "solar-cycler");
  const card = page.locator(".set-card.selected");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Inspired by proposed Mars cyclers");
  await expect(card.getByRole("link", { name: "Mars cycler" })).toHaveAttribute(
    "href",
    "https://en.wikipedia.org/wiki/Mars_cycler",
  );
  expect(await page.locator("[data-set] a, #model-details").count()).toBe(0);
  await expect(page.locator("#set-title")).toContainText(
    "Interplanetary cycler",
  );
  await expect(page.locator("#fleet")).not.toContainText("powered cycler");
  await expect(control(page, "frame")).toContainText("Brontes centered");
  await expect(control(page, "frame")).not.toContainText("Earth");
  expect((await state(page)).ships.some((v: any) => v.id === "Wayfarer")).toBe(
    true,
  );
  await page.locator('[data-set="selene-ground-service"]').click();
  await ready(page, "selene-ground-service");
  await expect(control(page, "frame")).toContainText("Aster centered");
  await expect(control(page, "frame")).not.toContainText("Planet");
});
test("speed control stays centered across live/history and highlights either side of zero", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/#set=aster-selene-cycler-fleet-service");
  await ready(page, "aster-selene-cycler-fleet-service");
  const speed = page.locator(".speed-control"),
    before = (await speed.boundingBox())!;
  expect(before.x + before.width / 2).toBeCloseTo(800, 0);
  await page.locator("#live").click();
  const after = (await speed.boundingBox())!;
  expect(after).toEqual(before);
  for (const position of [-0.6, 0, 0.6]) {
    await page.locator("#speed").fill(String(position));
    await page.locator("#speed").dispatchEvent("input");
    const endpoints = await page
      .locator(".speed-groove")
      .evaluate((e) =>
        [
          e.style.getPropertyValue("--speed-low"),
          e.style.getPropertyValue("--speed-high"),
        ].map(parseFloat),
      );
    expect(endpoints[0]).toBeCloseTo(Math.min(50, 50 + position * 50), 1);
    expect(endpoints[1]).toBeCloseTo(Math.max(50, 50 + position * 50), 1);
  }
});
test("sidebar resize, disclosure buttons and wide/compact camera controls retain camera state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1700, height: 1050 });
  await page.goto("/#set=aster-northern-launch");
  await ready(page, "aster-northern-launch");
  await expect(page.locator(".scene")).toHaveClass(/camera-inline/);
  await expect(control(page, "camera-view")).toBeVisible();
  await expect(page.locator(".camera-menu")).toBeHidden();
  const camera = (await state(page)).views[0].camera;
  const library = page.getByRole("separator", { name: "Set library width" });
  await library.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".library")).toHaveCSS("width", "252px");
  const inspector = page.getByRole("separator", { name: "Inspector width" }),
    box = (await inspector.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 90, box.y + box.height / 2);
  await page.mouse.up();
  await expect
    .poll(async () =>
      Math.round((await page.locator("aside").boundingBox())!.width),
    )
    .toBeGreaterThan(350);
  expect((await state(page)).views[0].camera).toEqual(camera);
  await page.locator("#library-toggle").click();
  await expect(page.locator(".library")).toBeHidden();
  await expect(page.locator("#library-toggle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.locator("#library-toggle").click();
  await expect(page.locator(".library")).toHaveCSS("width", "252px");
  await page.locator("#collapse-timeline").click();
  await expect(page.locator("#timelines")).toBeHidden();
  await expect(page.locator("#ruler")).toBeVisible();
  await control(page, "camera-view").selectOption("surface");
  await expect
    .poll(async () => (await state(page)).views[0].camera.scale)
    .toBeGreaterThan(camera.scale);
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await expect(page.locator(".scene.camera-inline")).toHaveCount(0);
  const menu = page.locator(".scene").first().locator(".camera-menu");
  await expect(menu.locator("summary")).toHaveText("Camera");
  await menu.locator("summary").click();
  await expect(control(page, "camera-view")).toBeVisible();
});
test("paused frame options do not mutate and planar fields use each set’s real sources", async ({
  page,
}) => {
  await page.goto("/#set=solar-cycler");
  await ready(page, "solar-cycler");
  const changes = await control(page, "frame").evaluate(
    (e) =>
      new Promise<number>((resolve) => {
        let count = 0;
        const observer = new MutationObserver((ms) => (count += ms.length));
        observer.observe(e, {
          attributes: true,
          childList: true,
          subtree: true,
        });
        setTimeout(() => {
          observer.disconnect();
          resolve(count);
        }, 500);
      }),
  );
  expect(changes).toBe(0);
  for (const id of [
    "orison-steered",
    "selene-ground-service",
    "lunar-loop",
    "helion-orison-survey",
  ]) {
    await page.evaluate((id) => (location.hash = "set=" + id), id);
    await ready(page, id);
    await control(page, "layers").locator("summary").click();
    await expect(control(page, "layer-field")).toBeVisible();
    const before = (await state(page)).ships;
    await control(page, "layer-field").check();
    await expect
      .poll(async () => (await state(page)).views[0].field.ready)
      .toBe(true);
    expect((await state(page)).views[0].field.error).toBe("");
    await control(page, "layer-relief").check();
    await expect
      .poll(async () => (await state(page)).views[0].field.mode)
      .toBe("relief");
    expect((await state(page)).views[0].field.reliefError).toBe("");
    expect((await state(page)).views[0].field.bytes).toBeLessThan(
      16 * 1024 * 1024,
    );
    const physical = (ships: any[]) =>
      ships.map(({ screen, occludedBy, ...v }) => v);
    expect(physical((await state(page)).ships)).toEqual(physical(before));
  }
});
