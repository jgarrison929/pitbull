import { expect, test, type Locator, type Page } from "@playwright/test";
import { approveEstimateCopy, lockPeriodCopy } from "@/lib/confirm-copy";
import { usdCents } from "@/lib/ev";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** Overlay, Escape, and Cancel close or ignore the dialog and do not post. */
async function leaveUnconfirmed(page: Page, trigger: Locator) {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-labelledby", /.+/);
  await expect(dialog).toHaveAttribute("aria-describedby", /.+/);
  await expect(dialog.getByTestId("confirm-dialog-cancel")).toBeFocused();

  await page.locator('[data-slot="confirm-dialog-overlay"]').click({
    position: { x: 8, y: 8 },
  });
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("confirm-dialog-cancel")).toBeFocused();
  await dialog.getByTestId("confirm-dialog-cancel").click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

/** CSS pixels of the trigger's border box. Phone checks want at least 44×44. */
async function tapBox(locator: Locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
}

for (const width of [390, 320]) {
  test(`Lock Period and Approve estimate are at least 44px at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width,
      height: width === 320 ? 568 : 844,
    });
    await signIn(page, "pm");

    await page.goto("/app/jobs/25-031");
    const lock = page.getByTestId("lock-claim");
    await expect(lock).toBeVisible();
    const lockBox = await tapBox(lock);
    expect(lockBox.width).toBeGreaterThanOrEqual(44);
    expect(lockBox.height).toBeGreaterThanOrEqual(44);

    await page.goto("/app/jobs/26-010");
    const approve = page.getByTestId("approve-estimate");
    await expect(approve).toBeVisible();
    const approveBox = await tapBox(approve);
    expect(approveBox.width).toBeGreaterThanOrEqual(44);
    expect(approveBox.height).toBeGreaterThanOrEqual(44);
  });
}

test("Cancel leaves Period 2 unlocked", async ({ page }) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  const trigger = page.getByTestId("lock-claim");
  await expect(trigger).toContainText("Period 2");
  const copy = lockPeriodCopy({ jobNumber: "25-031", periodLabel: "Period 2" });

  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(copy.title);
  await expect(dialog).toContainText(copy.description);
  await expect(dialog.getByTestId("confirm-dialog-confirm")).toHaveText(
    "Lock period",
  );
  await leaveUnconfirmed(page, trigger);

  await page.reload();
  await expect(page.getByTestId("lock-claim")).toContainText("Period 2");
  await expect(page.getByTestId("lock-claim")).not.toContainText("Period 3");
  await expect(page.getByTestId("job-changes")).not.toContainText(
    "Locked Period 2",
  );
});

test("Cancel leaves the Harbor estimate unapproved", async ({ page }) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/26-010");
  await expect(page.getByTestId("estimate-status")).toHaveAttribute(
    "data-status",
    "draft",
  );
  const cents = Number(
    await page
      .getByTestId("job-estimate")
      .locator("[data-cents]")
      .getAttribute("data-cents"),
  );
  expect(cents).toBe(8_675_000);
  expect(usdCents(cents)).toBe("$86,750.00");
  const copy = approveEstimateCopy({
    jobNumber: "26-010",
    currentEstimateCents: cents,
  });

  const trigger = page.getByTestId("approve-estimate");
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(copy.title);
  await expect(dialog).toContainText(copy.description);
  await expect(dialog).toContainText("$86,750.00");
  await expect(dialog.getByTestId("confirm-dialog-confirm")).toHaveText(
    "Approve estimate",
  );
  await leaveUnconfirmed(page, trigger);

  await page.reload();
  await expect(page.getByTestId("estimate-status")).toHaveAttribute(
    "data-status",
    "draft",
  );
  await expect(page.getByTestId("approve-estimate")).toBeVisible();
  await expect(page.getByTestId("draft-label")).toHaveText("Draft");
  await expect(
    page.getByTestId("job-budget").locator("[data-cents]"),
  ).toHaveAttribute("data-cents", "0");
  await expect(page.getByTestId("job-changes")).not.toContainText(
    "Approved the estimate",
  );
});
