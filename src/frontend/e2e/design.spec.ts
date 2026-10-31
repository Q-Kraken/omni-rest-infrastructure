import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Locator, type Page } from "@playwright/test";

/** One server-side fixture per project; owner and public pages share that same tenant. */
const test = base.extend({
  baseURL: async ({ browserName }, provideBaseURL, testInfo) => {
    // macOS WebKit resolves localhost but not arbitrary *.localhost names. Its project alone
    // owns this host; all other projects get named, isolated loopback fixtures.
    const host = browserName === "webkit" ? "localhost" : `design-${testInfo.project.name}.localhost`;
    await provideBaseURL(`http://${host}:3000`);
  },
});

const designs = [
  {
    id: "quiet-elegance-v1",
    name: "Quiet Elegance",
    homeMarker: "quiet-title",
    menuMarker: "quiet-no-menu",
  },
  {
    id: "nightfall-v1",
    name: "Nightfall",
    homeMarker: "nightfall-title",
    menuMarker: "night-no-menu",
  },
  {
    id: "broadsheet-v1",
    name: "Broadsheet",
    homeMarker: "broadsheet-title",
    menuMarker: "sheet-no-menu",
  },
  {
    id: "sunroom-v1",
    name: "Sunroom",
    homeMarker: "sunroom-title",
    menuMarker: "sun-no-menu",
  },
] as const;

// Order this file within each project; other projects still run concurrently on their own hosts.
test.describe.configure({ mode: "default" });
test.beforeEach(async ({ page, baseURL }) => {
  const host = new URL(baseURL!).hostname;
  const response = await page.request.post(`http://127.0.0.1:5290/__e2e/admin-reset?host=${host}`);
  expect(response.ok(), "could not reset the design fixture").toBe(true);
});
test.setTimeout(60_000);

for (const design of designs) {
  test(`${design.name} renders selected-only Home/Menu assets accessibly at desktop and mobile widths`, async ({ page }) => {
    await signIn(page);
    await setContentMode(page, "standard");

    for (const viewport of [
      { width: 1440, height: 900, label: "desktop" },
      { width: 768, height: 1024, label: "tablet" },
      { width: 320, height: 568, label: "minimum" },
      { width: 375, height: 812, label: "mobile" },
    ]) {
      await page.setViewportSize(viewport);

      await page.goto(`/admin/design-preview/${design.id}/home`);
      await expect(page.locator(`[data-website-design="${design.id}"]`)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "Prairie Table" })).toBeVisible();
      await assertNoHorizontalOverflow(page, `${design.name} Home ${viewport.label}`);
      await assertNoSeriousAccessibilityViolations(page);
      await assertSelectedStylesheet(page, design.id);
      if (viewport.label === "desktop") {
        await assertSelectedRendererChunk(
          page,
          design.id,
          designs.map(({ homeMarker }) => homeMarker),
        );
      }

      await page.goto(`/admin/design-preview/${design.id}/menu`);
      await expect(page.locator(`[data-website-design="${design.id}"]`)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Prairie Poutine" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Desserts" })).toBeVisible();
      await assertNoHorizontalOverflow(page, `${design.name} Menu ${viewport.label}`);
      await assertNoSeriousAccessibilityViolations(page);
      await assertSelectedStylesheet(page, design.id);
      if (viewport.label === "desktop") {
        await assertSelectedRendererChunk(
          page,
          design.id,
          designs.map(({ menuMarker }) => menuMarker),
        );
      }
    }
  });
}

test("all designs wrap long content and preserve minimal-content states", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 375, height: 812 });

  await setContentMode(page, "long");
  for (const design of designs) {
    await page.goto(`/admin/design-preview/${design.id}/home`);
    await expect(page.getByRole("heading", {
      level: 1,
      name: "The Prairie Table and Northern Harvest Dining Room",
    })).toBeVisible();
    await assertNoHorizontalOverflow(page, `${design.name} long Home`);

    await page.goto(`/admin/design-preview/${design.id}/menu`);
    await expect(page.getByRole("heading", {
      name: "Crispy Prairie Potato Poutine with Bothwell Cheese Curds and House Gravy",
    })).toBeVisible();
    await assertNoHorizontalOverflow(page, `${design.name} long Menu`);
  }

  await setContentMode(page, "minimal");
  for (const design of designs) {
    await page.goto(`/admin/design-preview/${design.id}/home`);
    await expect(page.getByRole("heading", { level: 1, name: "M" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `${design.name} minimal Home`);

    await page.goto(`/admin/design-preview/${design.id}/menu`);
    await expect(page.getByRole("heading", { level: 2, name: "Menu coming soon" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Call|Directions/ })).toHaveCount(0);
    await assertNoHorizontalOverflow(page, `${design.name} minimal Menu`);
  }
});

test("design selection is keyboard-safe and publication changes the public Home and Menu", async ({ page }) => {
  await signIn(page);
  await setContentMode(page, "standard");
  let designMutations = 0;
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      new URL(request.url()).pathname === "/api/v1/admin/restaurant/design"
    ) {
      designMutations += 1;
    }
  });

  await page.goto("/admin/design");
  await expect(page.getByRole("heading", { name: "Choose a design" })).toBeVisible();
  for (const { name } of designs) {
    await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
  }

  const selectNightfall = page.getByRole("button", { name: "Select Nightfall" });
  await selectNightfall.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('iframe[title="Nightfall home draft preview"]')).toBeVisible();
  expect(designMutations).toBe(0);

  const useDesign = page.getByRole("button", { name: "Use this design" });
  await useDesign.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog", { name: "Publish Nightfall?" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Confirm and publish" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(useDesign).toBeFocused();
  expect(designMutations).toBe(0);

  await useDesign.click();
  await page.getByRole("button", { name: "Confirm and publish" }).click();
  await expect.poll(() => designMutations).toBe(1);
  await expect(page.getByText(/Nightfall saved as the draft design/)).toBeVisible();

  const adminAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    adminAccessibility.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);

  const previewResponse = await page.request.get(
    "http://127.0.0.1:3000/admin/design-preview/nightfall-v1/home",
    { headers: { host: new URL(page.url()).hostname, cookie: "omni-e2e=1" } },
  );
  expect(previewResponse.headers()["cache-control"]).toContain("no-store");
  expect(previewResponse.headers()["x-robots-tag"]).toContain("noindex");
  expect(previewResponse.headers()["x-frame-options"]).toBe("SAMEORIGIN");

  await page.goto("/");
  await expect(page.locator('[data-website-design="nightfall-v1"]')).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Prairie Table" })).toBeVisible();
  await assertSelectedStylesheet(page, "nightfall-v1");

  await page.goto("/menu");
  await expect(page.locator('[data-website-design="nightfall-v1"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prairie Poutine" })).toBeVisible();
  await assertSelectedStylesheet(page, "nightfall-v1");
});

test("retained design styles stay isolated across real public links and browser history", async ({ page }) => {
  await page.goto("/");
  await setContentMode(page, "standard");
  await setPublishedDesign(page, "legacy-current-v1");
  await page.goto("/?style-history=legacy");
  await expect(page.locator('[data-website-design="legacy-current-v1"]')).toBeVisible();
  const cleanLegacyHome = await designStyleSnapshot(page, "legacy-current-v1");

  await setPublishedDesign(page, "nightfall-v1");
  await page.getByRole("link", { name: "Browse the menu" }).click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.locator('[data-website-design="nightfall-v1"]')).toBeVisible();
  await expectRetainedStylesheets(page, ["legacy-current-v1", "nightfall-v1"]);
  const retainedNightfallMenu = await designStyleSnapshot(page, "nightfall-v1");

  const cleanNightfallPage = await page.context().newPage();
  await cleanNightfallPage.goto("/menu");
  await expect(cleanNightfallPage.locator('[data-website-design="nightfall-v1"]')).toBeVisible();
  await assertSelectedStylesheet(cleanNightfallPage, "nightfall-v1");
  const cleanNightfallMenu = await designStyleSnapshot(cleanNightfallPage, "nightfall-v1");
  await cleanNightfallPage.close();
  expect(retainedNightfallMenu).toEqual(cleanNightfallMenu);

  await page.goBack();
  await expect(page.locator('[data-website-design="legacy-current-v1"]')).toBeVisible();
  await expectRetainedStylesheets(page, ["legacy-current-v1", "nightfall-v1"]);
  expect(await designStyleSnapshot(page, "legacy-current-v1")).toEqual(cleanLegacyHome);

  await page.goForward();
  await expect(page.locator('[data-website-design="nightfall-v1"]')).toBeVisible();
  expect(await designStyleSnapshot(page, "nightfall-v1")).toEqual(cleanNightfallMenu);

  await setPublishedDesign(page, "sunroom-v1");
  await page.getByRole("link", { name: "Prairie Table home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-website-design="sunroom-v1"]')).toBeVisible();
  await expectRetainedStylesheets(
    page,
    ["legacy-current-v1", "nightfall-v1", "sunroom-v1"],
  );
  const retainedSunroomHome = await designStyleSnapshot(page, "sunroom-v1");

  const cleanSunroomPage = await page.context().newPage();
  await cleanSunroomPage.goto("/");
  await expect(cleanSunroomPage.locator('[data-website-design="sunroom-v1"]')).toBeVisible();
  await assertSelectedStylesheet(cleanSunroomPage, "sunroom-v1");
  const cleanSunroomHome = await designStyleSnapshot(cleanSunroomPage, "sunroom-v1");
  await cleanSunroomPage.close();
  expect(retainedSunroomHome).toEqual(cleanSunroomHome);

  await page.goBack();
  await expect(page.locator('[data-website-design="nightfall-v1"]')).toBeVisible();
  expect(await designStyleSnapshot(page, "nightfall-v1")).toEqual(cleanNightfallMenu);
  await page.goForward();
  await expect(page.locator('[data-website-design="sunroom-v1"]')).toBeVisible();
  expect(await designStyleSnapshot(page, "sunroom-v1")).toEqual(cleanSunroomHome);
});

// The design picker sells Nightfall on its darkened photo behind the title. The public menu once had
// only a plain gradient there, so a visitor who landed on the menu never saw the photo.
test("Nightfall shows the restaurant photo behind the title on the public Home and Menu", async ({ page }) => {
  await page.goto("/");
  await setContentMode(page, "standard");
  await setPublishedDesign(page, "nightfall-v1");

  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    for (const { path, hero } of [
      { path: "/", hero: ".nightfall-v1__hero" },
      { path: "/menu", hero: ".nightfall-v1__menuHero" },
    ]) {
      const label = `${path} at ${viewport.width}px`;
      await page.goto(path);
      const heroBox = page.locator(hero);
      const photo = heroBox.getByRole("img", { name: "Dining room at night" });
      await expect(photo, label).toBeVisible();
      // `decode()` rejects a broken image. `naturalWidth` cannot tell: the 1x1 fixture behind a
      // `1920w` srcset entry reports a natural width that rounds down to 0 even when it drew.
      await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.decode().then(() => true, () => false)), {
        message: `${label}: the photo never loaded`,
      }).toBe(true);

      // The photo fills the hero, inside its border, rather than sitting in a corner of it.
      const gaps = await photo.evaluate((image) => {
        const frame = image.parentElement!;
        const outer = frame.getBoundingClientRect();
        const picture = image.getBoundingClientRect();
        const left = outer.left + frame.clientLeft;
        const top = outer.top + frame.clientTop;
        return [
          picture.left - left,
          picture.top - top,
          left + frame.clientWidth - picture.right,
          top + frame.clientHeight - picture.bottom,
        ].map(Math.abs);
      });
      for (const gap of gaps) expect(gap, `${label}: photo leaves a gap ${gaps}`).toBeLessThanOrEqual(1);

      // The title is drawn over the photo and its shade, not under them.
      const heading = heroBox.getByRole("heading", { level: 1 });
      await heading.scrollIntoViewIfNeeded();
      expect(await heading.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(box.left + 4, box.top + box.height / 2));
      }), `${label}: title covered`).toBe(true);
    }
  }

  // Nightfall is left-aligned, so the tax note lines up with the title panel instead of floating
  // in from both sides on a wide screen.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/menu");
  const [panel, note] = await Promise.all([
    page.locator(".nightfall-v1__menuHero").boundingBox(),
    page.getByRole("note").filter({ hasText: /tax/i }).boundingBox(),
  ]);
  expect(Math.abs(note!.x - panel!.x)).toBeLessThanOrEqual(1);
});

test("menu keyboard navigation honors reduced motion", async ({ page }) => {
  await page.addInitScript(() => {
    const record = window as unknown as { __designScrollBehaviors: string[] };
    record.__designScrollBehaviors = [];
    // Both the page (scrolling to the category) and the tab strip (bringing the tab into view) scroll.
    for (const target of [Element.prototype, window] as { scrollTo: (options?: ScrollToOptions) => void }[]) {
      const original = target.scrollTo;
      target.scrollTo = function scrollTo(this: unknown, options?: ScrollToOptions) {
        record.__designScrollBehaviors.push(typeof options === "object" ? options.behavior ?? "auto" : "auto");
        original.call(this, options);
      };
    }
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // A phone: the tab strip has to scroll to reach the last tab, and the page scrolls to its category.
  await page.setViewportSize({ width: 375, height: 740 });
  await signIn(page);
  await setContentMode(page, "many-categories");
  await page.goto("/admin/design-preview/quiet-elegance-v1/menu");

  const specials = page.getByRole("link", { name: "Late Night Specials" });
  await specials.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#late-night-specials$/);
  await expect(specials).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("heading", { name: "Late Night Specials 1" })).toBeVisible();
  const behaviors = await page.evaluate(
    () => (window as unknown as { __designScrollBehaviors: string[] }).__designScrollBehaviors,
  );
  expect(behaviors.length).toBeGreaterThan(0);
  expect(new Set(behaviors)).toEqual(new Set(["auto"]));
});

// Every design, including the grandfathered one, renders the same shared menu browser.
const menuDesignIds = ["legacy-current-v1", ...designs.map(({ id }) => id)];

test("tapping any menu tab on a phone never moves the page sideways", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  await setContentMode(page, "many-categories");

  for (const designId of menuDesignIds) {
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto(`/admin/design-preview/${designId}/menu`);
      await expect.poll(() => page.locator("[data-enhanced]").getAttribute("data-enhanced")).toBe("true");
      const tabs = page.getByRole("navigation", { name: "Menu categories" }).getByRole("link");
      const count = await tabs.count();
      expect(count, `${designId} tab count`).toBe(6);

      for (let index = 0; index < count; index += 1) {
        const label = `${designId} ${width}px tab ${index + 1}`;
        await tabs.nth(index).click();
        await expect(tabs.nth(index), label).toHaveAttribute("aria-current", "true");
        const offset = await page.evaluate(() => ({
          page: window.scrollX,
          visual: window.visualViewport?.offsetLeft ?? 0,
        }));
        expect(offset, `${label} sideways scroll`).toEqual({ page: 0, visual: 0 });
        await assertNoHorizontalOverflow(page, label);
      }
    }
  }
});

test("on a phone the menu scrolls through every category and the tabs follow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 740 });
  await signIn(page);
  await setContentMode(page, "many-categories");

  for (const designId of menuDesignIds) {
    await page.goto(`/admin/design-preview/${designId}/menu`);
    await expect(page.locator("[data-layout]")).toHaveAttribute("data-layout", "continuous");
    await expect(page.locator("section[hidden]"), `${designId} hidden categories`).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "Menu categories" });
    const navBottom = async () => (await nav.boundingBox())!.y + (await nav.boundingBox())!.height;

    // Scrolling down alone brings each category under the nav and moves the highlight with it.
    for (const name of ["Ramen", "Sides", "Drinks", "Desserts", "Late Night Specials"]) {
      await page.getByRole("heading", { level: 2, name, exact: true }).evaluate((heading) => {
        // Where the nav will sit once it has stuck, not where it is now: near the top of the page
        // it has not reached its sticky position yet.
        const nav = document.querySelector<HTMLElement>("nav[aria-label='Menu categories']")!;
        const stuckBottom = nav.getBoundingClientRect().height + (Number.parseFloat(getComputedStyle(nav).top) || 0);
        window.scrollBy({ top: heading.getBoundingClientRect().top - stuckBottom + 2, behavior: "instant" });
      });
      await expect(nav.getByRole("link", { name, exact: true }), `${designId} ${name}`).toHaveAttribute("aria-current", "true");
    }

    // A tap jumps back up to its category and leaves the heading visible below the sticky nav.
    await nav.getByRole("link", { name: "Ramen", exact: true }).click();
    await expect(page).toHaveURL(/#ramen$/);
    const heading = page.getByRole("heading", { level: 2, name: "Ramen", exact: true });
    await expect.poll(async () => Math.round((await heading.boundingBox())!.y - (await navBottom())), {
      message: `${designId} Ramen heading sits just below the nav`,
    }).toBeGreaterThanOrEqual(-1);
    await expect(heading).toBeInViewport();
    await expect(nav.getByRole("link", { name: "Ramen", exact: true })).toHaveAttribute("aria-current", "true");
  }

  // Wider screens keep one category at a time.
  await page.setViewportSize({ width: 1_280, height: 900 });
  await page.goto("/admin/design-preview/quiet-elegance-v1/menu");
  await expect(page.locator("[data-layout]")).toHaveAttribute("data-layout", "tabs");
  await expect(page.locator("section[hidden]")).toHaveCount(5);
});

test("every dish photo in a menu grid has the same size, whatever the shape of the upload", async ({ page }) => {
  await signIn(page);
  await setContentMode(page, "photos");

  for (const designId of menuDesignIds) {
    for (const width of [320, 375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/admin/design-preview/${designId}/menu`);
      const label = `${designId} ${width}px`;
      await expect(page.getByRole("heading", { name: "Plate 6" }), label).toBeVisible();
      const boxes = await page.locator(`.${designId}__mediaFrame`).evaluateAll((frames) => frames.map((frame) => {
        const box = frame.getBoundingClientRect();
        const image = frame.querySelector("img")!.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          fills: Math.abs(image.width - box.width) < 1 && Math.abs(image.height - box.height) < 1,
        };
      }));
      expect(boxes, `${label} photo count`).toHaveLength(6);
      expect(boxes[0].height, `${label} photo height`).toBeGreaterThan(0);
      // Within a pixel: grid tracks land on fractional pixels, so equal frames can round apart.
      for (const box of boxes) {
        expect(Math.abs(box.width - boxes[0].width), `${label} photo width`).toBeLessThan(1);
        expect(Math.abs(box.height - boxes[0].height), `${label} photo height`).toBeLessThan(1);
        expect(box.fills, `${label} photo fills its frame`).toBe(true);
      }
      await assertNoHorizontalOverflow(page, label);
    }
  }
});

test("every opening-hours control stays visible and clear of the others at every width", async ({ page }) => {
  await signIn(page);
  const section = (name: string) => page.locator("section").filter({ has: page.getByRole("heading", { name }) });
  const special = section("Special hours");
  await special.getByRole("button", { name: "Add special period" }).click();
  // An overnight period adds the "Closes next day" box, the widest a period row gets.
  await special.getByLabel("Opens", { exact: true }).first().fill("22:00");
  await special.getByLabel("Closes", { exact: true }).first().fill("02:00");
  await expect(special.getByLabel("Closes next day")).toBeVisible();
  const regular = section("Regular hours");
  await regular.getByLabel("Closes", { exact: true }).nth(1).fill("01:00");
  await expect(regular.getByLabel("Closes next day")).toBeVisible();

  for (const width of [1_440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await assertNoHorizontalOverflow(page, `hours ${width}px`);
    await assertControlsApart(special, `special hours ${width}px`);
    await assertControlsApart(regular, `regular hours ${width}px`);
  }
});

/** Each input and button sits inside its card or section, on top, and touches no other control. */
async function assertControlsApart(section: Locator, label: string) {
  const controls = await section.evaluate((root) => [...root.querySelectorAll<HTMLElement>("input, button")].map((control) => {
    control.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
    const area = control.closest("fieldset, section")!.getBoundingClientRect();
    const box = control.getBoundingClientRect();
    // What a tap on the control's middle lands on: anything drawn over the control shows up here.
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return {
      name: control.getAttribute("aria-label") || control.closest("label")?.textContent?.trim() || control.textContent?.trim() || control.tagName,
      left: box.left + window.scrollX,
      right: box.right + window.scrollX,
      top: box.top + window.scrollY,
      bottom: box.bottom + window.scrollY,
      contained: box.left >= area.left - 1 && box.right <= area.right + 1,
      coveredBy: hit === control || (hit && control.contains(hit)) ? null : hit?.outerHTML.slice(0, 120) ?? "nothing",
    };
  }));

  for (const control of controls) {
    expect(control.contained, `${label}: ${control.name} stays inside its card`).toBe(true);
    expect(control.coveredBy, `${label}: ${control.name} is not covered by another element`).toBeNull();
  }
  for (const [index, first] of controls.entries()) {
    for (const second of controls.slice(index + 1)) {
      const overlapX = Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      expect(overlapX > 1 && overlapY > 1, `${label}: ${first.name} overlaps ${second.name}`).toBe(false);
    }
  }
}

async function signIn(page: Page) {
  await page.goto("/admin/restaurant");
  await page.getByLabel("Email").fill("owner@prairietable.test");
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");

  // The login response is captured so a failure says WHY. Without it a rejected sign-in only shows
  // "expected /admin/restaurant, received /admin/login", which is the same symptom for a rate limit, a
  // wrong credential, and an unavailable auth service — three very different problems.
  const [loginResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/v1/auth/login"), { timeout: 15_000 })
      .catch(() => null),
    page.getByRole("button", { name: "Sign In" }).click(),
  ]);

  if (!/\/admin\/restaurant$/.test(page.url())) {
    const status = loginResponse?.status() ?? "no response";
    const body = loginResponse ? await loginResponse.text().catch(() => "") : "";
    const shown = await page.getByRole("alert").allTextContents().catch(() => []);
    await expect(page, `sign-in did not reach the editor. Login responded ${status}: ${body.slice(0, 300)}. On-screen: ${shown.join(" | ")}`)
      .toHaveURL(/\/admin\/restaurant$/);
  }
  await expect(page).toHaveURL(/\/admin\/restaurant$/);
}

async function setContentMode(page: Page, mode: "standard" | "long" | "minimal" | "many-categories" | "photos") {
  const response = await page.request.post(
    `http://127.0.0.1:5290/__e2e/design-content?mode=${mode}`,
    { headers: { host: new URL(page.url()).hostname } },
  );
  expect(response.ok()).toBe(true);
}

async function setPublishedDesign(page: Page, designId: string) {
  const response = await page.request.post(
    "http://127.0.0.1:5290/__e2e/published-design?designId=" + encodeURIComponent(designId),
    { headers: { host: new URL(page.url()).hostname } },
  );
  expect(response.ok()).toBe(true);
}

async function expectRetainedStylesheets(page: Page, designIds: readonly string[]) {
  const stylesheets = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"][href*="/design-previews/styles/"]',
    )].map((link) => new URL(link.href).pathname),
  );
  for (const designId of designIds) {
    expect(stylesheets).toContain("/design-previews/styles/" + designId + ".css");
  }
}

async function designStyleSnapshot(page: Page, designId: string) {
  return page.evaluate((resolvedDesignId) => {
    const root = document.querySelector<HTMLElement>(
      '[data-website-design="' + resolvedDesignId + '"]',
    );
    if (!root) throw new Error("Missing design root " + resolvedDesignId);
    const main = root.querySelector<HTMLElement>("main");
    const heading = root.querySelector<HTMLElement>("h1");
    const navigation = root.querySelector<HTMLElement>('header a[href="/"], header a[href="/menu"]');
    const category = root.querySelector<HTMLElement>('[data-selected="true"]');
    const snapshot = (element: HTMLElement | null, properties: readonly string[]) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]));
    };
    return {
      root: snapshot(root, ["background-color", "color", "font-family", "min-height"]),
      main: snapshot(main, ["display", "width", "padding-top", "padding-bottom"]),
      heading: snapshot(heading, ["font-family", "font-size", "font-weight", "line-height"]),
      navigation: snapshot(navigation, [
        "display",
        "background-color",
        "border-radius",
        "color",
        "font-family",
      ]),
      category: snapshot(category, [
        "display",
        "background-color",
        "border-radius",
        "color",
        "min-height",
      ]),
    };
  }, designId);
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const layout = await page.evaluate(() => {
    const main = document.querySelector("main")?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      mainLeft: main?.left ?? -1,
      mainRight: main?.right ?? -1,
      mainHeight: main?.height ?? 0,
    };
  });
  expect(layout.documentWidth, `${label} document width`).toBeLessThanOrEqual(
    layout.viewportWidth + 1,
  );
  expect(layout.mainLeft, `${label} main left edge`).toBeGreaterThanOrEqual(-1);
  expect(layout.mainRight, `${label} main right edge`).toBeLessThanOrEqual(
    layout.viewportWidth + 1,
  );
  expect(layout.mainHeight, `${label} main visibility`).toBeGreaterThan(1);
}

async function assertNoSeriousAccessibilityViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
}

/**
 * Asserted from the DOM rather than from resource timing.
 *
 * Phase 8 gave `/design-previews/*` an immutable one-year cache. This test navigates four times inside
 * one page context and checks after each, so from the second navigation on the stylesheet is served
 * from cache and contributes no resource-timing entry at all — which silently turned the old
 * network-only assertion into "expected one entry, received none" on every browser.
 *
 * What the test actually cares about is that exactly one design stylesheet is referenced and that it
 * belongs to the selected design. The DOM answers that truthfully whether or not the bytes crossed the
 * network. Resource timing is kept, but only as a leak check, and as a subset rather than an equality:
 * a cache hit legitimately produces no entry, while another design's stylesheet appearing there would
 * be a real failure however it was served.
 */
async function assertSelectedStylesheet(page: Page, designId: string) {
  const selected = `/design-previews/styles/${designId}.css`;

  const linked = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map((link) => new URL((link as HTMLLinkElement).href).pathname)
      .filter((path) => path.startsWith("/design-previews/styles/")),
  );
  expect(linked).toEqual([selected]);

  const fetched = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .map((entry) => new URL(entry.name).pathname)
      .filter((path) => path.startsWith("/design-previews/styles/")),
  );
  expect(fetched.filter((path) => path !== selected)).toEqual([]);
}

/**
 * Phase 8 moved the design renderers back across the server boundary, which inverts what this proves.
 * It used to assert the selected design's markup was in the downloaded JavaScript and the other four
 * were not. Now NO design markup may reach the browser at all, while the selected design must still be
 * the one in the DOM. That is the stronger claim: the old assertion would still pass if a design were
 * re-clientified into its own chunk, and this one will not.
 */
async function assertSelectedRendererChunk(
  page: Page,
  selectedDesignId: string,
  rendererMarkers: readonly string[],
) {
  const loadedJavascript = await page.evaluate(async () => {
    const scriptUrls = performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => /\/_next\/static\/chunks\/.*\.js(?:\?|$)/.test(url));
    return (await Promise.all(
      scriptUrls.map(async (url) => {
        const response = await fetch(url);
        return response.text();
      }),
    )).join("\n");
  });
  for (const marker of rendererMarkers) {
    expect(loadedJavascript).not.toContain(marker);
  }
  await expect(page.locator(`[data-website-design="${selectedDesignId}"]`)).toHaveCount(1);
}
