/**
 * Regressions for the rc/5.0.4 verify at 174d35be (49/53).
 * One check per failure: fold, tap target, type size, page budget.
 */
import { expect, test, type Page } from "@playwright/test";

const ROLES = ["executive", "pm", "superintendent", "foreman"] as const;

async function signIn(page: Page, role: (typeof ROLES)[number]) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

async function setTheme(page: Page, theme: "light" | "dark") {
  const base = new URL(page.url()).origin;
  await page.context().addCookies([
    {
      name: "pcs_theme",
      value: theme,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

/**
 * Painted separator width, not textContent. A flex item trims the
 * spaces in " · " while textContent still contains them. innerText
 * plus the range width is what the screen shows.
 */
async function expectSpacedPlanLink(page: Page) {
  const link = page.getByTestId("plan-detail-link").first();
  await expect(link).toBeVisible();
  const measured = await link.evaluate((el) => {
    const root = el as HTMLElement;
    const seps = [...root.querySelectorAll("[data-plan-sep]")].map((sep) => {
      const range = document.createRange();
      range.selectNodeContents(sep);
      const width = [...range.getClientRects()].reduce((sum, r) => sum + r.width, 0);
      const probe = document.createElement("span");
      probe.textContent = "·";
      probe.style.font = getComputedStyle(sep).font;
      probe.style.position = "absolute";
      probe.style.left = "0";
      probe.style.top = "0";
      probe.style.visibility = "hidden";
      document.body.appendChild(probe);
      const dot = probe.getBoundingClientRect().width;
      probe.remove();
      return { width, dot, text: sep.textContent ?? "" };
    });
    const box = root.getBoundingClientRect();
    return {
      innerText: root.innerText.replace(/\u00a0/g, " "),
      seps,
      height: box.height,
      width: box.width,
    };
  });
  expect(measured.innerText.replace(/\s+/g, " ").trim()).toMatch(
    /^Daily plan · .+ · \S/,
  );
  expect(measured.seps).toHaveLength(2);
  for (const sep of measured.seps) {
    expect(sep.text).toBe(" · ");
    expect(
      sep.width,
      `separator painted ${sep.width}px; a bare middot is ${sep.dot}px`,
    ).toBeGreaterThan(sep.dot + 2);
  }
  expect(measured.width).toBeGreaterThanOrEqual(44);
  expect(measured.height).toBeGreaterThanOrEqual(44);
}

async function fullyInView(page: Page, testId: string) {
  return page.getByTestId(testId).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const visible =
      r.width > 0 &&
      r.height > 0 &&
      cs.visibility !== "hidden" &&
      cs.display !== "none";
    return {
      visible,
      inView:
        visible &&
        r.top >= 0 &&
        r.left >= 0 &&
        r.bottom <= window.innerHeight + 0.5 &&
        r.right <= window.innerWidth + 0.5,
      top: r.top,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
      fontPx: parseFloat(cs.fontSize),
    };
  });
}

test.describe("5.0.4 rc verify fixes", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    for (const role of ["executive", "pm"] as const) {
      test(`${role} ${theme}: first next step is fully in view at 320×568`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await signIn(page, role);
        if (theme === "dark") await setTheme(page, "dark");
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto("/app");
        const step = page.getByTestId("next-step").filter({ visible: true }).first();
        await expect(step).toBeVisible();
        const box = await step.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return {
            visible: r.width > 0 && r.height > 0,
            inView:
              r.top >= 0 &&
              r.left >= 0 &&
              r.bottom <= window.innerHeight + 0.5 &&
              r.right <= window.innerWidth + 0.5,
            top: r.top,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        });
        expect(box.visible, JSON.stringify(box)).toBe(true);
        expect(box.inView, JSON.stringify(box)).toBe(true);
        expect(box.height).toBeGreaterThanOrEqual(44);
      });
    }
  }

  test("executive: job status, EAC, and CPI are in the first 320×568 screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await signIn(page, "executive");
    await page.getByTestId("next-step").first().click();
    await expect(page).toHaveURL(/\/app\/jobs\/24-077/);
    await expect
      .poll(async () => (await fullyInView(page, "job-status")).inView, {
        timeout: 5_000,
      })
      .toBe(true);
    for (const id of ["job-status", "job-eac", "job-cpi"]) {
      const box = await fullyInView(page, id);
      expect(box.inView, `${id} ${JSON.stringify(box)}`).toBe(true);
    }
  });

  for (const role of ROLES) {
    test(`${role}: Daily plan link is a 44px tap target at 390`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await signIn(page, role);
      await page.goto("/app/jobs/25-031");
      await expectSpacedPlanLink(page);
    });
  }

  test("superintendent: one-line Fri, Oct 30 plan link is 44px tall at 390", async ({
    page,
  }) => {
    // Pinned seed tomorrow is "Wed, Oct 21", which wraps to ~47px and
    // already clears 44px. Fri, Oct 30 fits on one line, so rc is ~23px tall.
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "superintendent");
    await page.goto("/app/jobs/25-031");
    await page.getByTestId("new-plan").click();
    const form = page.getByTestId("new-plan-form");
    await form.getByTestId("new-plan-crew").selectOption({ label: "Bridge Crew 2" });
    await form.getByTestId("new-plan-date").fill("2026-10-30");
    await form.getByTestId("new-plan-submit").click();
    const link = page
      .getByTestId("plan-detail-link")
      .filter({ hasText: "Fri, Oct 30" });
    await expect(link).toBeVisible({ timeout: 15_000 });
    const box = await link.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const textRects = [...range.getClientRects()].filter(
        (box) => box.width > 2 && box.height > 0 && box.height < 36,
      );
      const tops = new Set(textRects.map((box) => Math.round(box.top)));
      return {
        width: Math.round(r.width),
        height: Math.round(r.height),
        lineTops: tops.size,
        text: (el as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
      };
    });
    expect(box.text).toContain("Daily plan · Bridge Crew 2 · Fri, Oct 30");
    expect(box.lineTops, JSON.stringify(box)).toBe(1);
    expect(box.width, JSON.stringify(box)).toBeGreaterThanOrEqual(44);
    expect(box.height, JSON.stringify(box)).toBeGreaterThanOrEqual(44);
  });

  for (const [width, height] of [
    [320, 568],
    [768, 1024],
    [1280, 800],
  ] as const) {
    test(`PM: Daily plan separators keep their spaces at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await signIn(page, "pm");
      await page.goto("/app/jobs/25-031");
      await expectSpacedPlanLink(page);
    });
  }

  for (const width of [320, 390]) {
    for (const theme of ["light", "dark"] as const) {
      test(`PM ${theme}: Import estimate label is at least 14px at ${width}`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width,
          height: width === 320 ? 568 : 844,
        });
        await signIn(page, "pm");
        if (theme === "dark") await setTheme(page, "dark");
        await page.goto("/app/jobs/26-010");
        const label = page
          .getByTestId("import-estimate-form")
          .getByText("Import estimate", { exact: true })
          .first();
        await expect(label).toBeVisible();
        const fontPx = await label.evaluate((el) =>
          parseFloat(getComputedStyle(el).fontSize),
        );
        expect(fontPx).toBeGreaterThanOrEqual(14);
      });
    }
  }

  test("changes and status stay inside the 1500 ms page budget", async ({
    page,
  }) => {
    async function idle(path: string) {
      const t0 = Date.now();
      const res = await page.goto(path, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      return { status: res?.status() ?? 0, idleMs: Date.now() - t0 };
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, "pm");
    const warm = await idle("/app/jobs/24-118/changes");
    expect(warm.status).toBe(200);
    const changes = await idle("/app/jobs/24-118/changes");
    expect(changes.status).toBe(200);
    expect(changes.idleMs).toBeLessThanOrEqual(1500);
    await expect(page.getByTestId("job-changes-full")).toBeVisible();
    const rows = await page.getByTestId("job-changes-full").locator("li").count();
    expect(rows).toBeLessThanOrEqual(50);

    await page.goto("/login");
    await page.getByTestId("role-superintendent").click();
    await expect(page).toHaveURL(/\/app/);
    const superChanges = await idle("/app/jobs/24-118/changes");
    expect(superChanges.status).toBe(200);
    expect(superChanges.idleMs).toBeLessThanOrEqual(1500);

    await page.goto("/login");
    await page.getByTestId("role-foreman").click();
    await expect(page).toHaveURL(/\/app/);
    await page.setViewportSize({ width: 390, height: 844 });
    const status390 = await idle("/status");
    expect(status390.status).toBe(200);
    expect(status390.idleMs).toBeLessThanOrEqual(1500);
    await page.setViewportSize({ width: 1280, height: 800 });
    const status1280 = await idle("/status");
    expect(status1280.status).toBe(200);
    expect(status1280.idleMs).toBeLessThanOrEqual(1500);
  });
});
