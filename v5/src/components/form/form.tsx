// The shared form kit. Every form gets labels, described errors, sensible inputs and Save/Cancel
// from here, so no screen hand-rolls its own fields.
import { cn } from "@/lib/utils";

export type FieldErrors = Record<string, string | undefined>;

const control =
  "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-negative disabled:opacity-60";

/** Label, control, hint and error, wired together for screen readers. */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="text-[11px] font-medium text-negative"
          data-testid={`error-${id.split("-").pop()}`}
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Props every control takes so Field can describe it. */
export const described = (id: string, error?: string) => ({
  id,
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-error` : undefined,
});

export function TextInput({ className, ...p }: React.ComponentProps<"input">) {
  return <input type="text" {...p} className={cn(control, className)} />;
}

export function NumberInput({
  className,
  ...p
}: React.ComponentProps<"input">) {
  return (
    <input
      type="number"
      inputMode="decimal"
      {...p}
      className={cn(control, "tabular-nums", className)}
    />
  );
}

export function TextArea({
  className,
  ...p
}: React.ComponentProps<"textarea">) {
  return <textarea rows={2} {...p} className={cn(control, className)} />;
}

export type Option = {
  value: string;
  label: string;
  hint?: string;
  /** Cost-code unit when the option carries one (async search / plan editor). */
  unit?: string;
};

/** A native select, for short coded lists. */
export function Select({
  options,
  className,
  ...p
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: Option[] }) {
  return (
    <select {...p} className={cn(control, className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** A form-level error, such as "this plan is locked". */
export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-md bg-negative-soft px-2.5 py-1.5 text-xs font-medium text-negative"
      data-testid="form-error"
    >
      {error}
    </p>
  );
}

/** Save and Cancel. Both are disabled while the save is in flight. */
export function FormActions({
  pending,
  onCancel,
  saveLabel = "Save",
}: {
  pending: boolean;
  onCancel: () => void;
  saveLabel?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
