import { expect, test, type Page } from "@playwright/test";

const jobs = ["24-118", "25-031", "24-077", "26-010"] as const;
const widths = [
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByTestId("role-foreman").click();
  await expect(page).toHaveURL(/\/app/);
}

/**
 * Foreman desktop tree has no CPI column. Its row list is overflow-x hidden,
 * so a min-width shorter than the column floors clips the last dollars and
 * scrolling the card cannot reveal them.
 */
test("foreman cost-tree money is fully inside the scroll box at 768 and 1280", async ({
  page,
}) => {
  await signIn(page);
  for (const size of widths) {
    await page.setViewportSize(size);
    for (const job of jobs) {
      await page.goto(`/app/jobs/${job}`);
      const scroll = page.getByTestId("cost-tree-scroll");
      await expect(scroll, job).toBeVisible();
      const fails = await scroll.evaluate((node) => {
        const out: string[] = [];
        if (node.scrollWidth > node.clientWidth + 1) {
          out.push(
            `tree clips ${node.scrollWidth}px into ${node.clientWidth}px`,
          );
        }
        const box = node.getBoundingClientRect();
        const money = [...node.querySelectorAll("[data-cents]")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        for (const el of money) {
          const r = el.getBoundingClientRect();
          const text = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
            out.push(`cell clips ${text}`);
          }
          if (r.right > box.right + 1 || r.left < box.left - 1) {
            out.push(`past the tree ${text}`);
          }
        }
        const outer = node.parentElement?.parentElement;
        if (outer) {
          const style = getComputedStyle(outer);
          const scrolls =
            style.overflowX === "auto" || style.overflowX === "scroll";
          outer.scrollLeft = outer.scrollWidth;
          const view = outer.getBoundingClientRect();
          const tree = node.getBoundingClientRect();
          for (const el of money) {
            const r = el.getBoundingClientRect();
            const text = (el.textContent || "").replace(/\s+/g, " ").trim();
            if (r.right > tree.right + 1 || r.left < tree.left - 1) {
              out.push(`still clipped ${text}`);
            }
            if (r.right > view.right + 1 && !scrolls) {
              out.push(`unscrollable ${text}`);
            }
          }
        }
        return out.slice(0, 8);
      });
      expect(fails, `foreman ${job} @ ${size.width}`).toEqual([]);
    }
  }
});
