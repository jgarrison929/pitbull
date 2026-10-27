"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * A form that opens ConfirmDialog instead of posting on the first submit.
 * Enter in a field and the trigger button both open the dialog. Cancel and
 * Esc leave the form unsent. Confirm posts the same action with the same fields.
 */
export function ConfirmForm({
  action,
  className,
  testId,
  children,
  footer,
  triggerLabel,
  pendingLabel,
  triggerClassName,
  triggerTestId,
  triggerAriaLabel,
  triggerDataText,
  title,
  description,
  confirmLabel,
  destructive = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  testId?: string;
  children?: ReactNode;
  /** Rendered after the trigger, still inside the form (summaries). */
  footer?: ReactNode;
  triggerLabel: string;
  pendingLabel?: string;
  triggerClassName: string;
  triggerTestId: string;
  triggerAriaLabel?: string;
  /** RC marks 12px labels so the phone crawl treats them as labels. */
  triggerDataText?: "label";
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const armed = useRef(false);
  const posting = useRef(false);
  const [open, setOpen] = useState(false);

  function closeAndRestore() {
    setOpen(false);
    const trigger = triggerRef.current;
    if (!trigger) return;
    // After the dialog unmounts, put focus back on the control that opened it.
    setTimeout(() => trigger.focus(), 0);
  }

  return (
    <>
      <form
        ref={formRef}
        action={action}
        className={className}
        data-testid={testId}
        onSubmit={(event) => {
          if (armed.current) {
            armed.current = false;
            return;
          }
          event.preventDefault();
          posting.current = false;
          setOpen(true);
        }}
      >
        {children}
        <ConfirmTrigger
          triggerRef={triggerRef}
          label={triggerLabel}
          pendingLabel={pendingLabel}
          className={triggerClassName}
          testId={triggerTestId}
          ariaLabel={triggerAriaLabel}
          dataText={triggerDataText}
        />
        {footer}
      </form>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true);
          else closeAndRestore();
        }}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        destructive={destructive}
        onConfirm={() => {
          const form = formRef.current;
          if (!form || posting.current) return;
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }
          posting.current = true;
          armed.current = true;
          // Pass the in-form submit button. A submitter outside the form
          // makes FormData throw, and the dialog button is portaled out.
          form.requestSubmit(triggerRef.current ?? undefined);
          closeAndRestore();
        }}
      />
    </>
  );
}

function ConfirmTrigger({
  triggerRef,
  label,
  pendingLabel,
  className,
  testId,
  ariaLabel,
  dataText,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  label: string;
  pendingLabel?: string;
  className: string;
  testId: string;
  ariaLabel?: string;
  dataText?: "label";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      ref={triggerRef}
      type="submit"
      disabled={pending}
      className={className}
      data-testid={testId}
      data-text={dataText}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
    >
      {pending && pendingLabel ? pendingLabel : label}
    </button>
  );
}
