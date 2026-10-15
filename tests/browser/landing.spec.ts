import { test, expect } from "@playwright/test";
test("arrival is readable and animated without downloading the viewer, fixtures or workers", async ({
  page,
}) => {
  const requests: string[] = [],
    errors: string[] = [];
  let workers = 0;
  page.on("request", (r) => requests.push(r.url()));
  page.on("worker", () => workers++);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Orbital Logistics",
  );
  await expect
    .poll(() => page.locator("#hero-canvas").getAttribute("data-frames"))
    .not.toBeNull();
  expect(workers).toBe(0);
  expect(
    requests.some((url) =>
      /viewer-|prepare\.worker|traffic\.worker|potential-worker|recurring-cycler|solar-cycler/.test(
        url,
      ),
    ),
  ).toBe(false);
  const js = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e: any) => /\.js(?:\?|$)/.test(e.name))
      .reduce((n, e: any) => n + e.decodedBodySize, 0),
  );
  expect(js).toBeLessThan(30000);
  await page.getByRole("button", { name: "Pause orbital preview" }).click();
  const frames = await page.locator("#hero-canvas").getAttribute("data-frames");
  await page.waitForTimeout(250);
  expect(await page.locator("#hero-canvas").getAttribute("data-frames")).toBe(
    frames,
  );
  await page.getByRole("button", { name: "Play orbital preview" }).click();
  await expect(page.locator("#hero-canvas")).toHaveAttribute(
    "data-running",
    "true",
  );
  await page.locator("#about").scrollIntoViewIfNeeded();
  await expect(page.locator("#hero-canvas")).toHaveAttribute(
    "data-running",
    "false",
  );
  expect(errors).toEqual([]);
});
test("reduced motion leaves the poster; page works without JavaScript at phone width", async ({
  browser,
}) => {
  const reduced = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 360, height: 800 },
    }),
    page = await reduced.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await expect(page.locator("#hero-poster")).toBeVisible();
  await expect(page.locator("#hero-canvas")).toBeHidden();
  expect(requests.some((url) => /\/preview-/.test(url))).toBe(false);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page.getByRole("button", { name: "Play orbital preview" }).click();
  await expect(page.locator("#hero-canvas")).toBeVisible();
  await reduced.close();
  const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 360, height: 800 },
    }),
    plain = await context.newPage();
  await plain.goto("/");
  await expect(plain.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(plain.locator("#hero-poster")).toBeVisible();
  await expect(plain.locator("details")).toHaveCount(0);
  await expect(
    plain.getByText("Ships follow three-dimensional Newtonian trajectories", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await plain
      .getByRole("link", { name: "Explore the exhibits" })
      .getAttribute("href"),
  ).toBe("./viewer/");
  for (const image of await plain.locator('figure img[loading="lazy"]').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (e: HTMLImageElement) => e.complete && e.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  expect(
    await plain.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await context.close();
});
test("exhibit links enter the separate viewer; back/forward and returning home release its session", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Continuous survey", exact: false })
    .click();
  await expect(page).toHaveURL(/\/viewer\/#set=helion-orison-survey/);
  await expect
    .poll(
      async () =>
        JSON.parse((await page.locator("#state-json").textContent()) || "{}")
          .ready,
      { timeout: 60000 },
    )
    .toBe(true);
  await page
    .getByRole("link", { name: "About Orbital Logistics", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Orbital Logistics",
  );
  expect(await page.locator("#state-json").count()).toBe(0);
  await page.goBack();
  await expect
    .poll(
      async () =>
        JSON.parse((await page.locator("#state-json").textContent()) || "{}")
          .ready,
      { timeout: 60000 },
    )
    .toBe(true);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Orbital Logistics",
  );
});
test("camera panels select in one click, use native radio keys and remain independent between panes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.goto("/viewer/#set=orison-steered");
  await expect
    .poll(
      async () =>
        JSON.parse((await page.locator("#state-json").textContent()) || "{}")
          .ready,
      { timeout: 60000 },
    )
    .toBe(true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Split", exact: true }).click();
  const scenes = page.locator(".scene");
  const menu = scenes.nth(0).locator(".camera-menu");
  await menu.locator("summary").click();
  const view = scenes
    .nth(0)
    .getByRole("radiogroup", { name: "Camera view", exact: true });
  await view.getByRole("radio", { name: "Top", exact: true }).check();
  await expect(
    view.getByRole("radio", { name: "Top", exact: true }),
  ).toBeChecked();
  await view.getByRole("radio", { name: "Top", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    view.getByRole("radio", { name: "3D", exact: true }),
  ).toBeChecked();
  const track = scenes
    .nth(0)
    .getByRole("radiogroup", { name: "Camera tracking", exact: true });
  await track.getByRole("radio", { name: "Chase", exact: true }).check();
  await expect(
    scenes.nth(1).locator('[data-control="tracking"] input[value="off"]'),
  ).toBeChecked();
  expect(
    await scenes
      .nth(0)
      .locator(
        'select[aria-label="Camera view"], select[aria-label="Camera tracking"]',
      )
      .count(),
  ).toBe(0);
});

test("public transcript is complete static prose with working anchors and a Markdown export", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 360, height: 800 },
  });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  try {
    await page.goto("/build-log/");
    await expect(
      page.getByRole("heading", { name: "Prompt source code", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".exchange")).toHaveCount(105);
    await page
      .getByRole("navigation", { name: "Transcript chapters" })
      .getByRole("link", {
        name: "Licensing and the prompt source code",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/#publication$/);
    await expect(page.locator("#prompt-105")).toContainText("simon willison");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
    expect(
      requests.some((url) => /\.js(?:\?|$)|\.json(?:\?|$)/.test(url)),
    ).toBe(false);
    const markdown = await request.get("/build-log.md");
    expect(markdown.ok()).toBe(true);
    const text = await markdown.text();
    expect(text).toContain("### #001 — Hiina");
    expect(text).toContain("### #105 — Hiina");
    expect(text).toContain("Codex · condensed");
    expect(text).not.toMatch(
      /AGENTS\.md instructions|ambient-ui-state|MEMORY_SUMMARY|Task Group:|\/home\//,
    );
    const notices = await request.get("/THIRD-PARTY-NOTICES.txt");
    expect(notices.ok()).toBe(true);
    expect(await notices.text()).toContain("SIL OPEN FONT LICENSE");
    expect(await notices.text()).toContain("MIT License");
  } finally {
    await context.close();
  }
});

test("built pages and lazy viewer assets work under a plain static subdirectory", async ({
  browser,
}) => {
  const { createServer } = await import("node:http");
  const { readFile, stat } = await import("node:fs/promises");
  const { resolve, extname } = await import("node:path");
  const root = resolve("dist");
  const server = createServer(async (req, res) => {
    try {
      const route = new URL(req.url!, "http://localhost").pathname;
      if (!route.startsWith("/collection/")) throw Error("route");
      let file = resolve(
        root,
        "." + decodeURIComponent(route.slice("/collection".length)),
      );
      if (file !== root && !file.startsWith(root + "/")) throw Error("path");
      if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
      const type: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".md": "text/markdown",
        ".txt": "text/plain",
        ".woff2": "font/woff2",
      };
      res.setHeader(
        "Content-Type",
        type[extname(file)] ?? "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${address.port}/collection/`);
    await expect(page.locator("#hero-canvas")).toBeVisible();
    await page
      .getByRole("link", { name: "Continuous survey", exact: false })
      .click();
    await expect(page).toHaveURL(
      /\/collection\/viewer\/#set=helion-orison-survey/,
    );
    await expect
      .poll(
        async () =>
          JSON.parse((await page.locator("#state-json").textContent()) || "{}")
            .ready,
        { timeout: 60000 },
      )
      .toBe(true);
    await page
      .getByRole("link", { name: "About Orbital Logistics", exact: true })
      .click();
    await expect(page).toHaveURL(/\/collection\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Orbital Logistics",
    );
    await page
      .getByRole("link", { name: "prompt source code", exact: true })
      .click();
    await expect(page).toHaveURL(/\/collection\/build-log\/$/);
    await expect(page.locator(".exchange")).toHaveCount(105);
    const markdown = await page.request.get(
      `http://127.0.0.1:${address.port}/collection/build-log.md`,
    );
    expect(markdown.ok()).toBe(true);
    expect(await markdown.text()).toContain("### #105 — Hiina");
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
