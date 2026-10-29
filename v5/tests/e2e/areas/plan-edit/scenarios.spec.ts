import {
  expect,
  JOB_PATH,
  openJob,
  pourLine,
  resetDemo,
  signIn,
  test,
} from "./support";

test.describe.configure({ timeout: 90_000 });

test(
  "foreman changes pour line 04-210 from 60 to 80 MH and it holds after reload @PB-97-S1",
  { tag: "@PB-97-S1" },
  async ({ page, evidence }) => {
    evidence.role = "foreman";
    await signIn(page, "foreman");
    await expect(page.getByTestId("signed-in-as")).toContainText("Luis Ortega");
    await resetDemo(page);
    await openJob(page);
    await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
    await evidence.shoot(page, "before", pourLine(page));

    await pourLine(page).getByTestId("edit-line").click();
    const form = pourLine(page).getByTestId("line-form");
    await form.getByLabel("Man-hours").fill("80");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form).toBeHidden();
    await expect(pourLine(page).getByTestId("line-mh")).toHaveText("80");
    await expect(pourLine(page)).toContainText("8 workers × 10 h");
    await page.reload();
    await expect(pourLine(page).getByTestId("line-mh")).toHaveText("80");
    await evidence.shoot(page, "after", pourLine(page));
  },
);

test(
  "superintendent entering 2.5 workers sees the whole-number error and nothing is saved @PB-97-S2",
  { tag: "@PB-97-S2" },
  async ({ page, evidence }) => {
    evidence.role = "superintendent";
    await signIn(page, "superintendent");
    await expect(page.getByTestId("signed-in-as")).toContainText("Ray Dominguez");
    await resetDemo(page);
    await openJob(page);
    await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
    await evidence.shoot(page, "before", pourLine(page));

    await pourLine(page).getByTestId("edit-line").click();
    const form = pourLine(page).getByTestId("line-form");
    // step=1 would block submit in the browser. novalidate lets the server's
    // inline error answer, matching tests/e2e/plan-edit.spec.ts.
    await form.evaluate((node) => node.setAttribute("novalidate", ""));
    await form.getByLabel("Workers").fill("2.5");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByTestId("error-workers")).toContainText("whole number");
    await expect(form.getByTestId("error-workers")).toHaveText(
      "Workers must be a whole number from 1 to 50.",
    );
    await evidence.shoot(page, "after", form.getByTestId("error-workers"));

    await page.reload();
    await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
    await expect(page).toHaveURL(new RegExp(`${JOB_PATH}$`));
  },
);

test(
  "pm and executive see no Edit control on plan lines @PB-97-S3",
  { tag: "@PB-97-S3" },
  async ({ page, evidence }) => {
    evidence.role = "pm";
    await signIn(page, "pm");
    await expect(page.getByTestId("signed-in-as")).toContainText("Marcus Lee");
    await resetDemo(page);
    await openJob(page);
    await expect(page.getByTestId("edit-line")).toHaveCount(0);
    await evidence.shoot(page, "before", pourLine(page));

    await page.reload();
    await expect(page.getByTestId("edit-line")).toHaveCount(0);
    await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
    await evidence.shoot(page, "after", pourLine(page));

    await signIn(page, "executive");
    await expect(page.getByTestId("signed-in-as")).toContainText("Elena Brooks");
    await openJob(page);
    await expect(page.getByTestId("edit-line")).toHaveCount(0);
  },
);

test(
  "foreman plan-line edit shows in the PM changes feed as Luis Ortega, man-hours 60 to 80 @PB-97-S4",
  { tag: "@PB-97-S4" },
  async ({ page, evidence }) => {
    evidence.role = "pm";
    await signIn(page, "pm");
    await expect(page.getByTestId("signed-in-as")).toContainText("Marcus Lee");
    await resetDemo(page);
    await openJob(page);
    const feed = page.getByTestId("job-changes");
    await expect(feed).toBeVisible();
    await expect(feed.getByText("man-hours 60 → 80")).toHaveCount(0);
    await evidence.shoot(page, "before", feed);

    await signIn(page, "foreman");
    await expect(page.getByTestId("signed-in-as")).toContainText("Luis Ortega");
    await openJob(page);
    await pourLine(page).getByTestId("edit-line").click();
    const form = pourLine(page).getByTestId("line-form");
    await form.getByLabel("Man-hours").fill("80");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form).toBeHidden();
    await expect(pourLine(page).getByTestId("line-mh")).toHaveText("80");

    await signIn(page, "pm");
    await openJob(page);
    const row = page
      .getByTestId("job-changes")
      .locator("li")
      .filter({ hasText: "man-hours 60 → 80" });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Luis Ortega");
    await evidence.shoot(page, "after", row);
  },
);

test(
  "Cancel or Escape discards an in-progress plan-line edit @PB-97-S5",
  { tag: "@PB-97-S5" },
  async ({ page, evidence }) => {
    evidence.role = "foreman";
    await signIn(page, "foreman");
    await expect(page.getByTestId("signed-in-as")).toContainText("Luis Ortega");
    await resetDemo(page);
    await openJob(page);
    await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");

    await pourLine(page).getByTestId("edit-line").click();
    const form = pourLine(page).getByTestId("line-form");
    await form.getByLabel("Man-hours").fill("99");
    await evidence.shoot(page, "before", form);

    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(form).toBeHidden();
    await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");

    await pourLine(page).getByTestId("edit-line").click();
    const again = pourLine(page).getByTestId("line-form");
    await again.getByLabel("Man-hours").fill("70");
    await again.getByLabel("Activity").press("Escape");
    await expect(again).toBeHidden();
    await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
    await page.reload();
    await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
    await expect(pourLine(page).getByTestId("line-form")).toHaveCount(0);
    await evidence.shoot(page, "after", pourLine(page));
  },
);
