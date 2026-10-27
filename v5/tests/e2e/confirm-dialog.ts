import { expect, type Locator, type Page } from "@playwright/test";

/** Click a confirmed action's trigger, then the verb button in ConfirmDialog. */
export async function confirmDialog(page: Page, trigger: Locator) {
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("confirm-dialog-confirm").click();
  await expect(dialog).toBeHidden();
}
