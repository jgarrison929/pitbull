import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROLES = ["executive", "pm", "superintendent", "foreman"] as const;
type Role = (typeof ROLES)[number];

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const SHORT_MONEY = /\$\d+(\.\d)?[KMB]/;
const JOB_NUMBER = /\b\d{2}-\d{3}\b/;
const EXACT_MONEY = /\$\d{1,3}(,\d{3})*\.\d{2}/;
const TOGGLE_NAME = /^(Expand|Collapse) \S+ .+/;

test.describe.configure({ timeout: 180_000 });

async function signIn(page: Page, role: Role) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

async function theme(page: Page, value: "light" | "dark") {
  const base = new URL(page.url()).origin;
  await page.context().addCookies([
    { name: "pcs_theme", value, url: base },
  ]);
  await page.reload();
  if (value === "dark") {
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  }
}

async function visibleBox(page: Page, locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      top: r.top,
      right: r.right,
      width: r.width,
      height: r.height,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      fontSize: parseFloat(s.fontSize),
      ellipsis: s.textOverflow === "ellipsis",
      visible: s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0,
    };
  });
}

async function axeViolations(page: Page, rules?: string[]) {
  let builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  if (rules) builder = builder.withRules(rules);
  const result = await builder.analyze();
  return result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.length})`,
  );
}

test.describe("5.0.4-i phone fit and a11y", () => {
  test("i-1 chips wrap for every role at 320", async ({ page }) => {
    for (const role of ROLES) {
      await signIn(page, role);
      for (const size of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        for (const path of ["/app", "/app/assistant"]) {
          await page.goto(path);
          const row = page
            .getByTestId("assistant-page")
            .getByTestId("assistant-chips");
          if (path === "/app" && (await row.count()) === 0) continue;
          await expect(row, `${role} ${path}`).toBeVisible();
          const fit = await row.evaluate((el) => ({
            scroll: el.scrollWidth,
            client: el.clientWidth,
            overflowX: getComputedStyle(el).overflowX,
          }));
          expect(fit.overflowX, `${role} ${path}`).not.toBe("auto");
          expect(fit.scroll, `${role} ${path}`).toBeLessThanOrEqual(fit.client + 1);
          const chips = row.getByRole("button");
          const count = await chips.count();
          if (path === "/app/assistant") expect(count, role).toBeGreaterThan(0);
          const view = await page.evaluate(
            () => document.documentElement.clientWidth,
          );
          for (let i = 0; i < count; i++) {
            if (!(await chips.nth(i).isVisible())) continue;
            const box = await visibleBox(page, chips.nth(i));
            expect(box.right, `${role} ${size.width} chip ${i}`).toBeLessThanOrEqual(
              view + 1,
            );
            expect(box.height, `${role} chip ${i}`).toBeGreaterThanOrEqual(44);
            expect(box.width, `${role} chip ${i}`).toBeGreaterThanOrEqual(44);
          }
          expect(await page.locator("[data-scroll-x]:visible").count(), role).toBe(0);
        }
      }
    }
  });

  test("a-8 and assistant-message on the foreman home", async ({ page }) => {
    for (const mode of ["light", "dark"] as const) {
      await page.setViewportSize({ width: 390, height: 844 });
      await signIn(page, "foreman");
      await theme(page, mode);
      await page.goto("/app");
      const panel = page.getByTestId("assistant-page");
      await expect(panel).toBeVisible();
      const input = panel.getByTestId("assistant-input");
      const speak = panel.getByRole("button", { name: "Speak" });
      const send = panel.getByRole("button", { name: "Send" });
      for (const control of [input, speak, send]) {
        const box = await visibleBox(page, control);
        expect(box.width, mode).toBeGreaterThanOrEqual(44);
        expect(box.height, mode).toBeGreaterThanOrEqual(44);
      }
      const messages = panel.getByTestId("assistant-message");
      expect(await messages.count()).toBeLessThanOrEqual(3);
      const show = panel.getByTestId("assistant-show-conversation");
      if (await show.count()) {
        const box = await visibleBox(page, show);
        expect(box.height, mode).toBeGreaterThanOrEqual(44);
      }
      await expect(panel.getByTestId("action-run").first()).toBeVisible();
    }
  });

  test("a-7 and a-9 next-step labels", async ({ page }) => {
    for (const role of ROLES) {
      await signIn(page, role);
      for (const mode of ["light", "dark"] as const) {
        await theme(page, mode);
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
          await page.goto("/app");
          const steps = page.getByTestId("next-step");
          const n = await steps.count();
          for (let i = 0; i < n; i++) {
            const step = steps.nth(i);
            if (!(await step.isVisible())) continue;
            const text = (await step.innerText()).replace(/\s+/g, " ").trim();
            expect(text, `${role} ${mode}`).toMatch(JOB_NUMBER);
            if (/^(Approve CO|Decide CO)/.test(text)) {
              expect(text).toMatch(EXACT_MONEY);
            }
            if (role === "executive" && /over cost/.test(text)) {
              expect(text).toMatch(SHORT_MONEY);
            }
            if (width === 390) {
              const box = await visibleBox(page, step);
              expect(box.width).toBeGreaterThanOrEqual(44);
              expect(box.height).toBeGreaterThanOrEqual(44);
              expect(box.ellipsis).toBe(false);
              expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);
            }
          }
        }
      }
    }
  });

  test("a-3 foreman home order", async ({ page }) => {
    await signIn(page, "foreman");
    for (const mode of ["light", "dark"] as const) {
      await theme(page, mode);
      for (const size of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        await page.goto("/app");
        const first = page.locator("main section").first();
        await expect(first).toHaveAttribute("data-testid", "next-steps");
        const next = await page.getByTestId("next-step").first().boundingBox();
        const assistant = await page.getByTestId("assistant-page").boundingBox();
        expect(assistant!.y).toBeGreaterThan(next!.y);
      }
    }
  });

  test("i-5 b-7 b-8 shell targets and header text", async ({ page }) => {
    const paths = ["/app", "/app/jobs/25-031", "/app/assistant"];
    for (const role of ROLES) {
      await signIn(page, role);
      for (const mode of ["light", "dark"] as const) {
        await theme(page, mode);
        for (const width of [320, 390]) {
          await page.setViewportSize({
            width,
            height: width === 320 ? 568 : 844,
          });
          for (const path of paths) {
            await page.goto(path);
            await expectShellTargets(page, `${role} ${mode} ${width} ${path}`);
          }
        }
      }
    }
  });

  test("b-6 purpose lines on the nav pages", async ({ page }) => {
    await signIn(page, "pm");
    const pages = ["/app", "/changelog", "/roadmap", "/status", "/app/assistant"];
    for (const mode of ["light", "dark"] as const) {
      await theme(page, mode);
      await page.setViewportSize({ width: 320, height: 568 });
      for (const path of pages) {
        await page.goto(path);
        const purpose = page.getByTestId("page-purpose");
        await expect(purpose, path).toHaveCount(1);
        const text = (await purpose.innerText()).trim();
        expect(text.length, path).toBeGreaterThanOrEqual(10);
        expect(text.length, path).toBeLessThanOrEqual(90);
        const box = await visibleBox(page, purpose);
        expect(box.fontSize, path).toBeGreaterThanOrEqual(14);
        expect(box.ellipsis, path).toBe(false);
        expect(box.scrollWidth, path).toBeLessThanOrEqual(box.clientWidth + 1);
      }
    }
    await page.goto("/changelog");
    await expect(page.getByTestId("page-purpose")).toHaveText(
      "What each release changed.",
    );
    await page.goto("/roadmap");
    await expect(page.getByTestId("page-purpose")).toHaveText(
      "What shipped and what comes next, in order.",
    );
  });

  test("b-5 at-risk summary carries exact cents", async ({ page }) => {
    for (const mode of ["light", "dark"] as const) {
      await page.setViewportSize({ width: 390, height: 844 });
      await signIn(page, "executive");
      await theme(page, mode);
      await page.goto("/app");
      const summary = page.getByTestId("at-risk-summary");
      await expect(summary).toBeVisible();
      const line = summary.getByRole("link", { name: /24-077/ });
      await expect(line).toContainText("behind schedule");
      const amount = line.locator("[data-cents]");
      const cents = Number(await amount.getAttribute("data-cents"));
      const title = (await amount.getAttribute("title")) ?? "";
      expect(title).toMatch(/[−-]\$\d{1,3}(,\d{3})*\.\d{2}/);
      expect(cents).toBeLessThan(0);
      const cedar = summary.getByRole("link", { name: /25-031/ });
      await expect(cedar).toContainText("over cost");
      const cedarCents = Number(await cedar.locator("[data-cents]").getAttribute("data-cents"));
      await page.goto("/app/jobs/24-077");
      const schedule = Number(
        await page
          .locator("[data-testid='job-spi'] [data-variance-cents]")
          .getAttribute("data-variance-cents"),
      );
      expect(cents, mode).toBe(schedule);
      await page.goto("/app/jobs/25-031");
      const cost = Number(
        await page
          .locator("[data-testid='job-cpi'] [data-variance-cents]")
          .getAttribute("data-variance-cents"),
      );
      expect(cedarCents, mode).toBe(cost);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/app");
      await expect(page.getByTestId("at-risk-summary")).toContainText("24-077");
    }
    await signIn(page, "foreman");
    await page.goto("/app");
    await expect(page.getByTestId("at-risk-summary")).toHaveCount(0);
  });

  test("i-2 cost-item KPI money fits at 320", async ({ page }) => {
    for (const role of ROLES) {
      await signIn(page, role);
      for (const mode of ["light", "dark"] as const) {
        await theme(page, mode);
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto("/app/jobs/24-077");
        const row = await revealRow(page, "07-300");
        const rowEac = await row
          .locator("[data-figure='primary'] [data-cents]")
          .first()
          .getAttribute("data-cents");
        const rowCb = await row.getAttribute("data-cb-cents");
        await row.locator("summary", { hasText: "More" }).click();
        const rowEv = await moneyNear(row, "Earned");
        const rowAc = await moneyNear(row, "Actual");
        await page.goto("/app/jobs/24-077/cost-items/07-300");
        const cards = page.locator("[data-card]");
        const n = await cards.count();
        for (let i = 0; i < n; i++) {
          const card = cards.nth(i);
          if (!(await card.isVisible())) continue;
          const top = (await card.boundingBox())?.y ?? 9999;
          if (top >= 568) continue;
          const primary = card.locator("[data-figure='primary']");
          const secondary = card.locator("[data-figure='secondary']");
          expect(await primary.count(), `${role} card ${i}`).toBe(1);
          expect(await secondary.count()).toBeLessThanOrEqual(2);
          for (const figure of [primary, ...Array.from({ length: await secondary.count() }, (_, k) => secondary.nth(k))]) {
            const box = await visibleBox(page, figure);
            if (!box.visible) continue;
            expect(box.scrollWidth, `${role} ${mode}`).toBeLessThanOrEqual(
              box.clientWidth + 1,
            );
          }
        }
        await expectCents(page, "cost-item-eac", rowEac);
        await expectCents(page, "cost-item-cb", rowCb);
        await expectCents(page, "cost-item-ev", rowEv);
        await expectCents(page, "cost-item-ac", rowAc);
        for (const id of ["cost-item-eac", "cost-item-cb", "cost-item-ev", "cost-item-ac"]) {
          const node = page.getByTestId(id).locator("[data-cents]");
          const cents = Number(await node.getAttribute("data-cents"));
          if (Math.abs(cents) >= 1_000_000) {
            await expect(node).toHaveText(SHORT_MONEY);
            await expect(node).toHaveAttribute("title", EXACT_MONEY);
          }
        }
      }
    }
  });

  test("i-3 toggle names and button-name", async ({ page }) => {
    for (const role of ROLES) {
      await signIn(page, role);
      for (const mode of ["light", "dark"] as const) {
        await theme(page, mode);
        for (const size of [
          { width: 1440, height: 900 },
          { width: 390, height: 844 },
        ]) {
          await page.setViewportSize(size);
          await page.goto("/app/jobs/26-010");
          await expect(page.getByTestId("cost-table")).toBeVisible();
          const toggles = page.getByRole("button", { name: TOGGLE_NAME });
          await expect(
            toggles.first(),
            `${role} ${mode} ${size.width}`,
          ).toBeVisible();
          expect(await toggles.count(), `${role} ${mode} ${size.width}`).toBeGreaterThan(0);
          const sample = (await toggles.first().getAttribute("aria-label")) ?? "";
          expect(sample).toMatch(TOGGLE_NAME);
          await expect(toggles.first()).toHaveAttribute("aria-expanded", /true|false/);
          const controls = await toggles.first().getAttribute("aria-controls");
          expect(controls).toBeTruthy();
          await expect(page.locator(`[id="${controls}"]`)).toHaveCount(1);
          const violations = await axeViolations(page, ["button-name"]);
          expect(violations, `${role} ${mode} ${size.width}`).toEqual([]);
        }
      }
    }
  });

  test("i-4 list markup", async ({ page }) => {
    for (const role of ["pm", "executive", "superintendent"] as const) {
      await signIn(page, role);
      for (const mode of ["light", "dark"] as const) {
        await theme(page, mode);
        await page.setViewportSize({ width: 1440, height: 900 });
        for (const job of ["24-077", "24-118", "25-031"]) {
          await page.goto(`/app/jobs/${job}`);
          await expect(page.getByTestId("cost-table")).toBeVisible();
          const violations = await axeViolations(page, ["list", "listitem"]);
          expect(violations, `${role} ${mode} ${job}`).toEqual([]);
        }
      }
    }
  });

  test("c-6 color is never the only signal", async ({ page }) => {
    await signIn(page, "pm");
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of ["/app", "/app/jobs/24-077"]) {
      await page.goto(path);
      const misses = await page.evaluate(() => {
        const re = /On track|Watch|At risk|[+−]\$/;
        const out: string[] = [];
        for (const el of document.querySelectorAll(
          ".text-positive, .text-caution, .text-negative",
        )) {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (s.display === "none" || s.visibility === "hidden" || r.width === 0) continue;
          const host =
            el.closest("[data-card], tr, [data-testid='cost-tree-row']") ?? el;
          const text = (host.textContent ?? "").replace(/\s+/g, " ");
          if (!re.test(text)) out.push(text.slice(0, 80));
        }
        return out;
      });
      expect(misses, path).toEqual([]);
    }
  });

  test("e-5 phone KPI fold and minus sign", async ({ page }) => {
    await signIn(page, "pm");
    for (const mode of ["light", "dark"] as const) {
      await theme(page, mode);
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto("/app/jobs/25-031");
      for (const id of ["job-eac", "job-cpi"]) {
        const top = await page.getByTestId(id).evaluate((el) => {
          const card = el.closest("[data-card]");
          return card ? card.getBoundingClientRect().top : null;
        });
        expect(top, `${id} ${mode}`).not.toBeNull();
        expect(top!, `${id} ${mode}`).toBeLessThan(568);
      }
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/-\$/);
    }
  });

  test("d-6 primary buttons fill the plan card", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "superintendent");
    await page.goto("/app/jobs/25-031");
    await expectFullWidth(page, "submit-plan");
    await signIn(page, "foreman");
    await page.goto("/app/jobs/25-031");
    await expectFullWidth(page, "submit-plan");
    await page.goto("/app/jobs/24-077");
    await expectFullWidth(page, "report-work");
  });

  test("e-4 phone cost rows fit", async ({ page }) => {
    for (const role of ["pm", "executive"] as const) {
      await signIn(page, role);
    for (const mode of ["light", "dark"] as const) {
      await theme(page, mode);
      for (const size of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        for (const job of ["24-077", "24-118", "25-031"]) {
          await page.goto(`/app/jobs/${job}`);
          const scroller = page.getByTestId("cost-tree-scroll-mobile");
          await expect(scroller).toBeVisible();
          const spilled = await scroller.evaluate((root) => {
            const fails: string[] = [];
            const nodes = [...root.querySelectorAll("[data-cents]")].filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            });
            for (const el of nodes) {
              const r = el.getBoundingClientRect();
              const parent = el.parentElement;
              if (!parent) continue;
              const box = parent.getBoundingClientRect();
              const cs = getComputedStyle(parent);
              const contentRight =
                box.right - parseFloat(cs.paddingRight || "0");
              if (el.scrollWidth > el.clientWidth + 1) {
                fails.push(`clip ${el.textContent}`);
              }
              if (r.right > contentRight + 1) fails.push(`edge ${el.textContent}`);
            }
            for (let i = 0; i < nodes.length; i++) {
              const a = nodes[i]!.getBoundingClientRect();
              for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j]!.getBoundingClientRect();
                const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                if (overlap < 4) continue;
                const gap = Math.max(a.left, b.left) - Math.min(a.right, b.right);
                if (gap >= 0 && gap < 8) {
                  fails.push(
                    `gap ${gap.toFixed(1)} ${nodes[i]!.textContent} | ${nodes[j]!.textContent}`,
                  );
                }
              }
            }
            return fails.slice(0, 8);
          });
          expect(spilled, `${role} ${mode} ${job}`).toEqual([]);
        }
      }
    }
    }
  });

  test("e-1 roll-up short money and e-2 entry cards", async ({ page }) => {
    await signIn(page, "pm");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app/jobs/26-010");
    const scroller = page.getByTestId("cost-tree-scroll-mobile");
    await scroller.scrollIntoViewIfNeeded();
    const toggle = page.getByRole("button", { name: TOGGLE_NAME }).first();
    await expect(toggle).toBeVisible();
    const roll = await toggle.evaluate((btn) => {
      const row = btn.closest("[data-testid='cost-tree-row']");
      const money = row?.querySelector("[data-cents]");
      return {
        title: money?.getAttribute("title") ?? "",
        cents: money?.getAttribute("data-cents") ?? "",
        text: (money?.textContent ?? "").trim(),
      };
    });
    expect(roll.title).toMatch(/[−-]?\$\d{1,3}(,\d{3})*\.\d{2}/);
    expect(roll.cents).toMatch(/^-?\d+$/);
    expect(roll.text).toMatch(SHORT_MONEY);
    await page.goto("/app/jobs/24-077/cost-items/07-300");
    await expect(page.locator("main table:visible")).toHaveCount(0);
    await expect(page.getByTestId("cost-item-entries-cards")).toBeVisible();
    const card = page.locator("[data-testid='cost-entry-card']").first();
    await expect(card.getByTestId("cost-entry-card-amount")).toBeVisible();
  });

  test("c-7 tabular figures and end-aligned numeric cells", async ({ page }) => {
    await signIn(page, "pm");
    await page.goto("/app/jobs/24-077");
    const planHref = await page
      .getByTestId("plan-detail-link")
      .first()
      .getAttribute("href");
    for (const mode of ["light", "dark"] as const) {
      await theme(page, mode);
      await page.setViewportSize({ width: 1440, height: 900 });
      for (const path of [
        "/app/jobs/24-077",
        "/app/jobs/24-077/cost-items/07-300",
        planHref!,
      ]) {
        await page.goto(path);
        await expect(page.locator("h1")).toBeVisible();
        const misses = await page.evaluate(() => {
          const shown = (el: Element) => {
            let n: Element | null = el;
            while (n) {
              const s = getComputedStyle(n);
              if (s.display === "none" || s.visibility === "hidden") return false;
              n = n.parentElement;
            }
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };
          const digitsTabular = (el: Element) => {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
              if (/\d/.test(node.textContent ?? "")) {
                const parent = node.parentElement;
                if (
                  !parent ||
                  !getComputedStyle(parent).fontVariantNumeric.includes(
                    "tabular-nums",
                  )
                ) {
                  return false;
                }
              }
              node = walker.nextNode();
            }
            return true;
          };
          const exceptions = [
            /\b(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, )?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}(?:, \d{4})?(?:, \d{1,2}:\d{2}\s?[AP]M)?\b/g,
            /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\b/g,
            /\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?: UTC)?)?\b/g,
            /\b\d{2}-\d{3}\b/g,
            /\b\d{2}(?= [A-Z][a-z])/g,
            /\bCO-\d+\b/g,
          ];
          const exemptAtStart = (text: string) => {
            for (const re of exceptions) {
              re.lastIndex = 0;
              const m = re.exec(text);
              if (m && m.index === 0) return true;
            }
            return false;
          };
          const endAligned = (cell: Element) => {
            const s = getComputedStyle(cell);
            if (s.textAlign === "right" || s.textAlign === "end") return true;
            const range = document.createRange();
            range.selectNodeContents(cell);
            const text = range.getBoundingClientRect();
            const box = cell.getBoundingClientRect();
            const pad = parseFloat(s.paddingRight) || 0;
            const border = parseFloat(s.borderRightWidth) || 0;
            return Math.abs(text.right - (box.right - pad - border)) <= 2;
          };
          const out: string[] = [];
          for (const figure of document.querySelectorAll("[data-figure]")) {
            if (!shown(figure)) continue;
            if (!digitsTabular(figure)) {
              out.push(`figure ${(figure.textContent ?? "").slice(0, 40)}`);
            }
          }
          const cells = [
            ...document.querySelectorAll("main td"),
            ...document.querySelectorAll(
              "[data-testid='cost-tree-row'] > div:nth-child(n+2)",
            ),
          ];
          for (const cell of cells) {
            if (!shown(cell)) continue;
            const text = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
            const isTd = cell.tagName === "TD";
            if (isTd) {
              if (!/^[+−-]?\$?\d/.test(text) || exemptAtStart(text)) continue;
            }
            if (!digitsTabular(cell) || !endAligned(cell)) {
              out.push(
                `cell ${text.slice(0, 40)} align=${getComputedStyle(cell).textAlign}`,
              );
            }
          }
          return out.slice(0, 12);
        });
        expect(misses, `${mode} ${path}`).toEqual([]);
      }
    }
  });

  test("c-1 card figures above the fold", async ({ page }) => {
    await signIn(page, "pm");
    const paths = ["/app/jobs/24-077", "/app/jobs/24-077/cost-items/07-300", "/app/jobs/25-031"];
    for (const mode of ["light", "dark"] as const) {
      await theme(page, mode);
      for (const size of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        for (const path of paths) {
          await page.goto(path);
          await expect(page.locator("h1")).toBeVisible();
          const misses = await page.evaluate((fold) => {
            const exceptions = [
              /\b(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, )?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}(?:, \d{4})?(?:, \d{1,2}:\d{2}\s?[AP]M)?\b/g,
              /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\b/g,
              /\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?: UTC)?)?\b/g,
              /\b\d{2}-\d{3}\b/g,
              /\b\d{2}(?= [A-Z][a-z])/g,
              /\bCO-\d+\b/g,
            ];
            const strip = (text: string) => {
              let next = text;
              for (const re of exceptions) next = next.replace(re, "");
              return next;
            };
            const numberRe = /[$−-]?\d[\d,]*(\.\d+)?\s?(%|[KMB])?/;
            const shown = (el: Element) => {
              const s = getComputedStyle(el);
              if (s.display === "none" || s.visibility === "hidden") return false;
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            };
            const out: string[] = [];
            for (const card of document.querySelectorAll("[data-card]")) {
              if (!shown(card)) continue;
              if (card.getBoundingClientRect().top >= fold) continue;
              const primary = [...card.querySelectorAll("[data-figure='primary']")].filter(shown);
              const secondary = [...card.querySelectorAll("[data-figure='secondary']")].filter(shown);
              if (primary.length !== 1 || secondary.length > 2) {
                out.push(`count p=${primary.length} s=${secondary.length}`);
              }
              const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
              let node = walker.nextNode();
              while (node) {
                const el = node.parentElement;
                if (el && shown(el) && !el.closest("[data-figure]")) {
                  const raw = (node.textContent ?? "").replace(/\s+/g, " ").trim();
                  if (raw && numberRe.test(strip(raw))) out.push(raw.slice(0, 60));
                }
                node = walker.nextNode();
              }
            }
            return out.slice(0, 8);
          }, size.height);
          expect(misses, `${mode} ${size.width} ${path}`).toEqual([]);
        }
      }
    }
  });

  test("anchors, job-status, and d-1 submit text", async ({ page }) => {
    await signIn(page, "superintendent");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app/jobs/25-031");
    const plan = page.locator("[data-testid='plan-card'][data-status='draft']").first();
    await expect(plan).toBeVisible();
    const planId = await plan.getAttribute("data-plan-id");
    await expect(plan).toHaveAttribute("id", `plan-${planId}`);
    await expect(plan.getByTestId("submit-plan")).toHaveText("Submit plan");
    await page.goto("/app/jobs/24-118");
    await expect(page.getByTestId("approve-report").first()).toHaveText("Approve report");
    await expect(page.getByTestId("return-report").first()).toHaveText("Return to foreman");
    await expect(page.getByTestId("job-status")).toBeVisible();

    await signIn(page, "foreman");
    await page.goto("/app/jobs/24-077");
    await expect(page.getByTestId("report-work").first()).toHaveText("Report day's work");

    await signIn(page, "pm");
    await page.goto("/app/jobs/25-031");
    const co = page.locator("[data-testid='co-card'][data-co-number='1']");
    await expect(co).toBeVisible();
    await expect(co).toHaveAttribute("id", "co-CO-001");
    await expect(page.getByTestId("job-status")).toBeVisible();
  });

  test("c-8 and #67 axe on the touched pages", async ({ page }) => {
    const paths = [
      "/app/jobs/24-077",
      "/app/jobs/26-010",
      "/app/jobs/24-077/cost-items/07-300",
    ];
    for (const role of ROLES) {
      await signIn(page, role);
      for (const mode of ["light", "dark"] as const) {
        await theme(page, mode);
        for (const size of [
          { width: 1440, height: 900 },
          { width: 390, height: 844 },
        ]) {
          await page.setViewportSize(size);
          for (const path of paths) {
            await page.goto(path);
            await expect(page.locator("h1")).toBeVisible();
            const violations = await axeViolations(page);
            expect(
              violations,
              `${role} ${mode} ${size.width} ${path}`,
            ).toEqual([]);
          }
        }
      }
    }
  });

  test("#65 change order confirm on a phone", async ({ page }) => {
    await signIn(page, "pm");
    for (const mode of ["light", "dark"] as const) {
      await theme(page, mode);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/app/jobs/25-031#co-CO-001");
      const approve = page.getByTestId("co-approve").first();
      await approve.click();
      const dialog = page.getByTestId("confirm-dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("Approve change order CO-001 on 25-031?");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(approve).toBeFocused();
      await expect(page.getByText("priced", { exact: false }).first()).toBeVisible();
      const confirm = page.getByTestId("confirm-dialog-confirm");
      const cancel = page.getByTestId("confirm-dialog-cancel");
      await approve.click();
      const content = await dialog.evaluate((el) => {
        const cs = getComputedStyle(el);
        return (
          el.clientWidth -
          parseFloat(cs.paddingLeft) -
          parseFloat(cs.paddingRight)
        );
      });
      for (const button of [confirm, cancel]) {
        const box = await visibleBox(page, button);
        expect(box.height, mode).toBeGreaterThanOrEqual(44);
        expect(Math.abs(box.width - content), mode).toBeLessThanOrEqual(1);
      }
      await cancel.click();
    }
  });

  test("f-1 plan lines are cards on a phone", async ({ page }) => {
    for (const role of ["foreman", "superintendent"] as const) {
      await signIn(page, role);
      for (const size of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        await page.goto("/app/jobs/24-077");
        const firstLink = page
          .getByTestId("plan-detail-link")
          .filter({ visible: true })
          .first();
        await expect(firstLink).toBeVisible();
        const first = await firstLink.getAttribute("href");
        await page.goto("/app/jobs/25-031");
        const cedarLink = page
          .locator("[data-testid='plan-card'][data-status='draft']")
          .filter({ visible: true })
          .getByTestId("plan-detail-link");
        await expect(cedarLink).toBeVisible();
        const cedar = await cedarLink.getAttribute("href");
        for (const href of [first, cedar]) {
          await page.goto(href!);
          await expect(page.locator("main table:visible")).toHaveCount(0);
          const lines = page.getByTestId("plan-detail-line").filter({ visible: true });
          await expect(lines.first(), `${role} ${size.width} ${href}`).toBeVisible();
          const n = await lines.count();
          for (let i = 0; i < n; i++) {
            const text = (await lines.nth(i).innerText()).replace(/\s+/g, " ");
            expect(text, `${role} line ${i}`).toMatch(/Planned /);
            expect(text).toMatch(/Reported /);
            expect(text).toMatch(/MH/);
          }
          const wide = await page.evaluate(() => {
            const w = document.documentElement.clientWidth;
            return [...document.querySelectorAll("main *")].filter((el) => {
              const r = el.getBoundingClientRect();
              const s = getComputedStyle(el);
              return (
                s.display !== "none" &&
                r.width > 0 &&
                r.height > 0 &&
                r.right > w + 1
              );
            }).length;
          });
          expect(wide, `${role} ${href}`).toBe(0);
        }
      }
    }
  });

  test("c-3 named targets stay at least 44px and c-2 inputs stay 16px", async ({
    page,
  }) => {
    async function atLeast44(
      locator: ReturnType<Page["locator"]>,
      label: string,
    ) {
      const visible = locator.filter({ visible: true });
      await expect(visible.first(), label).toBeVisible();
      const n = await visible.count();
      for (let i = 0; i < n; i++) {
        const box = await visible.nth(i).boundingBox();
        expect(box?.width ?? 0, `${label}[${i}]`).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0, `${label}[${i}]`).toBeGreaterThanOrEqual(44);
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "foreman");
    await page.goto("/app");
    await atLeast44(page.getByRole("link", { name: "Pitbull home" }), "brand");
    await atLeast44(page.getByTestId("user-menu"), "menu");
    await atLeast44(page.getByTestId("next-step"), "next-step");
    await atLeast44(
      page.getByTestId("assistant-page").getByTestId("assistant-chips").locator("button,a"),
      "chips",
    );
    await page.goto("/app/jobs/24-077");
    const hours = page.locator('input[name^="actualMh"]');
    const qty = page.locator('input[name^="actualQty"]');
    await atLeast44(hours, "actualMh");
    await atLeast44(qty, "actualQty");
    await expect(hours.first()).toHaveCSS("font-size", "16px");

    await signIn(page, "superintendent");
    await page.goto("/app/jobs/25-031");
    await atLeast44(page.getByTestId("submit-plan"), "submit-plan");
    await atLeast44(page.getByTestId("edit-line"), "edit-line");
    await atLeast44(page.getByTestId("remove-plan-line"), "remove-plan-line");

    await signIn(page, "pm");
    for (const job of ["24-077", "24-118", "25-031"]) {
      await page.goto(`/app/jobs/${job}`);
      await atLeast44(page.getByTestId("lock-claim"), `${job} lock`);
      const percent = page.locator('input[name="percent"]');
      const reason = page.locator('input[name="reason"]');
      await atLeast44(percent, `${job} percent`);
      await atLeast44(reason, `${job} reason`);
      await expect(percent.first()).toHaveCSS("font-size", "16px");
    }
    await page.goto("/app/jobs/26-010");
    await atLeast44(page.getByTestId("approve-estimate"), "approve");
    await atLeast44(page.getByTestId("import-estimate-file"), "import file");
    await atLeast44(page.getByTestId("import-estimate-submit"), "import");
    await atLeast44(page.getByTestId("cost-tree-filter"), "filter");
    await atLeast44(page.locator('[data-testid^="value-set-"]'), "value-set");

    await page.goto("/app/jobs/24-077/cost-items/07-300");
    await atLeast44(page.getByTestId("cost-entry-plan-link"), "plan link");
    await atLeast44(page.getByTestId("cost-item-back"), "back");
    await atLeast44(page.getByTestId("forecast-method-select"), "forecast");
    await atLeast44(page.getByTestId("forecast-method-save"), "apply");
    await expect(page.getByTestId("forecast-method-select")).toHaveCSS(
      "font-size",
      "16px",
    );

    const href = await page.locator('a[href*="/plans/"]').first().getAttribute("href");
    await page.goto(href!);
    await atLeast44(
      page.locator('a[href*="/cost-items/"]'),
      "plan cost code",
    );

    await page.goto("/roadmap");
    await atLeast44(page.locator('a[href*="/changelog#"]'), "roadmap version");
  });

  test("b-2 foreman sees no cost indexes on app pages", async ({ page }) => {
    await signIn(page, "foreman");
    await page.setViewportSize({ width: 320, height: 568 });
    for (const path of ["/app", "/app/jobs/25-031", "/app/assistant", "/changelog"]) {
      await page.goto(path);
      await expect(page.locator("[data-testid$='-cpi']")).toHaveCount(0);
      await expect(page.locator("[data-testid$='-spi']")).toHaveCount(0);
      if (path !== "/changelog") {
        const text = await page.locator("body").innerText();
        expect(text).not.toMatch(/\bCPI\b/);
        expect(text).not.toMatch(/\bSPI\b/);
      }
    }
  });

  test("b-4 first use spells the index out", async ({ page }) => {
    await signIn(page, "pm");
    for (const mode of ["light", "dark"] as const) {
      await theme(page, mode);
    for (const size of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/app/jobs/25-031");
      await expect(page.getByTestId("job-eac")).toBeVisible();
      const first = await page.evaluate(() => {
        const want = ["CPI", "SPI", "EV", "AC", "PV", "EAC"];
        const found: Record<string, string> = {};
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const el = node.parentElement;
          if (!el) continue;
          let hidden = false;
          for (let n: HTMLElement | null = el; n; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.display === "none" || cs.visibility === "hidden") {
              hidden = true;
              break;
            }
          }
          if (hidden) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const text = node.textContent ?? "";
          for (const term of want) {
            if (found[term]) continue;
            if (new RegExp(`\\b${term}\\b`).test(text)) found[term] = text.trim();
          }
        }
        return found;
      });
      expect(first.CPI, `${mode} ${size.width}`).toContain("Cost performance (CPI)");
      expect(first.SPI, `${mode} ${size.width}`).toContain("Schedule performance (SPI)");
      expect(first.EV, `${mode} ${size.width}`).toContain("Earned value (EV)");
      expect(first.AC, `${mode} ${size.width}`).toContain("Actual cost (AC)");
      expect(first.PV, `${mode} ${size.width}`).toContain("Planned value (PV)");
      expect(first.EAC, `${mode} ${size.width}`).toContain("Estimate at completion (EAC)");
    }
    }
  });
});

async function expectShellTargets(page: Page, where: string) {
  const brands = page.getByRole("link", { name: "Pitbull home" });
  await expect(brands.first(), where).toBeVisible();
  const brandCount = await brands.count();
  expect(brandCount, where).toBeGreaterThan(0);
  for (let i = 0; i < brandCount; i++) {
    const box = await visibleBox(page, brands.nth(i));
    expect(box.width, `${where} brand`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${where} brand`).toBeGreaterThanOrEqual(44);
  }
  const menu = page.getByTestId("user-menu");
  await expect(menu, where).toBeVisible();
  const menuBox = await visibleBox(page, menu);
  expect(menuBox.width, `${where} menu`).toBeGreaterThanOrEqual(44);
  expect(menuBox.height, `${where} menu`).toBeGreaterThanOrEqual(44);
  const company = page.locator("header").getByTestId("company-name");
  await expect(company, where).toBeVisible();
  const companyText = ((await company.innerText()) ?? "").replace(/\s+/g, " ").trim();
  expect(companyText, where).toBe("Summit Highway & Bridge");
  const companyBox = await visibleBox(page, company);
  expect(companyBox.ellipsis, where).toBe(false);
  expect(companyBox.scrollWidth, where).toBeLessThanOrEqual(companyBox.clientWidth + 1);
  const ariaHidden = await company.evaluate((el) => {
    let n: Element | null = el;
    while (n) {
      if (n.getAttribute("aria-hidden") === "true") return true;
      n = n.parentElement;
    }
    return false;
  });
  expect(ariaHidden, where).toBe(false);
  await expect(
    page.locator("header").getByText("Summit Highway & Bridge", { exact: true }),
  ).toBeVisible();
  const labels = page.getByTestId("job-strip-label");
  const n = await labels.count();
  for (let i = 0; i < n; i++) {
    const label = labels.nth(i);
    if (!(await label.isVisible())) continue;
    await expect(label).toContainText(JOB_NUMBER);
    const box = await visibleBox(page, label);
    expect(box.scrollWidth, `${where} pill ${i}`).toBeLessThanOrEqual(box.clientWidth + 1);
  }
}

async function revealRow(page: Page, code: string) {
  const scroller = page.getByTestId("cost-tree-scroll-mobile");
  await expect(scroller).toBeVisible();
  for (let i = 0; i < 40; i++) {
    const row = page
      .locator(`[data-testid="cost-tree-row"][data-code="${code}"]`)
      .locator("visible=true");
    if (await row.count()) return row.first();
    await scroller.evaluate((el) => {
      el.scrollTop += 500;
    });
  }
  throw new Error(`row ${code} not in the phone tree`);
}

async function moneyNear(row: ReturnType<Page["locator"]>, label: string) {
  const block = row.locator("div", { hasText: new RegExp(`^${label}$`) }).locator("xpath=..");
  return block.locator("[data-cents]").first().getAttribute("data-cents");
}

async function expectCents(page: Page, testId: string, cents: string | null) {
  const node = page.getByTestId(testId).locator("[data-cents]");
  await expect(node).toHaveAttribute("data-cents", cents ?? "");
}

async function expectFullWidth(page: Page, testId: string) {
  const button = page.getByTestId(testId).locator("visible=true").first();
  await expect(button).toBeVisible();
  const widths = await button.evaluate((el) => {
    const cardEl = el.closest("[data-testid='plan-card']")!;
    const cs = getComputedStyle(cardEl);
    const content =
      cardEl.clientWidth -
      parseFloat(cs.paddingLeft) -
      parseFloat(cs.paddingRight);
    return {
      button: el.getBoundingClientRect().width,
      content,
      height: el.getBoundingClientRect().height,
    };
  });
  expect(Math.abs(widths.button - widths.content)).toBeLessThanOrEqual(1);
  expect(widths.height).toBeGreaterThanOrEqual(44);
}
