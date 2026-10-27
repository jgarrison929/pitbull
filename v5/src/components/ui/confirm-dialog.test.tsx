// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmForm } from "@/components/form/confirm-form";

afterEach(() => {
  cleanup();
});

function VoidHarness({ action }: { action: (formData: FormData) => void }) {
  return (
    <ConfirmForm
      action={action}
      triggerLabel="Void"
      triggerClassName="rounded-md border px-3 py-1.5 text-xs font-medium"
      triggerTestId="co-void"
      title="Void change order CO-014 on 24-077?"
      description="This removes $48,200.00 from pending changes and cannot be undone."
      confirmLabel="Void change order"
      destructive
    >
      <input type="hidden" name="action" value="changeOrder.void" />
      <input type="hidden" name="job" value="24-077" />
    </ConfirmForm>
  );
}

describe("ConfirmDialog", () => {
  it("opens on the trigger, and cancel and Esc do not run the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(<VoidHarness action={action} />);
    const trigger = screen.getByTestId("co-void");

    await user.click(trigger);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "Void change order CO-014 on 24-077?",
      }),
    ).toBeTruthy();
    expect(dialog.textContent).toContain(
      "This removes $48,200.00 from pending changes and cannot be undone.",
    );
    expect(action).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(action).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });

    await user.click(trigger);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(action).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("traps focus between Cancel and the verb button", async () => {
    const user = userEvent.setup();
    render(<VoidHarness action={vi.fn()} />);
    await user.click(screen.getByTestId("co-void"));

    const cancel = screen.getByTestId("confirm-dialog-cancel");
    const confirm = screen.getByTestId("confirm-dialog-confirm");
    expect(document.activeElement).toBe(cancel);
    expect(cancel.className).toContain("h-11!");
    expect(confirm.className).toContain("h-11!");
    expect(confirm.getAttribute("data-variant")).toBe("destructive");
    expect(screen.getByTestId("confirm-dialog").getAttribute("data-destructive")).toBe(
      "true",
    );

    await user.tab();
    expect(document.activeElement).toBe(confirm);
    await user.tab();
    expect(document.activeElement).toBe(cancel);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(confirm);
  });

  it("runs the action once on confirm and not before", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(<VoidHarness action={action} />);

    await user.click(screen.getByTestId("co-void"));
    expect(action).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("confirm-dialog-confirm"));

    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]?.[0] as FormData;
    expect(formData.get("action")).toBe("changeOrder.void");
    expect(formData.get("job")).toBe("24-077");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("uses the primary button when the action is not destructive", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmForm
        action={vi.fn()}
        triggerLabel="Approve"
        triggerClassName="rounded-md bg-primary px-3 py-1.5 text-xs"
        triggerTestId="co-approve"
        title="Approve change order CO-001 on 25-031?"
        description="Current Budget increases by $60,000.00 and EAC increases by $60,000.00. This cannot be undone."
        confirmLabel="Approve change order"
      />,
    );
    await user.click(screen.getByTestId("co-approve"));
    expect(screen.getByTestId("confirm-dialog-confirm").getAttribute("data-variant")).toBe(
      "default",
    );
    expect(screen.getByTestId("confirm-dialog").getAttribute("data-destructive")).toBe(
      "false",
    );
  });

  it("does not open or post when a required reason is empty", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(
      <ConfirmForm
        action={action}
        triggerLabel="Reject"
        triggerClassName="rounded-md border px-3 py-1.5 text-xs"
        triggerTestId="co-reject"
        title="Reject change order CO-002 on 24-077?"
        description="This removes $10,500.00 from pending changes."
        confirmLabel="Reject change order"
        destructive
      >
        <input name="reason" type="text" required data-testid="co-reject-reason" />
      </ConfirmForm>,
    );
    await user.click(screen.getByTestId("co-reject"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });
});
