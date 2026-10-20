"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { saveLine, type SaveLineState } from "@/app/app/assistant/actions";
import { ChoiceField } from "@/components/form/combobox";
import {
  described,
  Field,
  FormActions,
  FormError,
  NumberInput,
  TextArea,
  TextInput,
  type Option,
} from "@/components/form/form";
import { LIMITS, rebalance } from "@/lib/plan-line";

export type EditableLine = {
  id: string;
  costItemId: string;
  code: string;
  activity: string;
  location: string;
  qtyMilli: number;
  workers: number;
  hoursTenths: number;
  notes: string;
  /** Unit of the line's current cost code (survives codes outside the initial slice). */
  unit: string;
};

/** Edit button plus the inline form for one plan line. Saving runs dailyPlan.updateLine. */
export function PlanLineEditor({
  line,
  costItems,
  searchUrl,
  children,
}: {
  line: EditableLine;
  costItems: (Option & { unit: string })[];
  /** When set, the cost-code field searches the server instead of the full list. */
  searchUrl?: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (!editing)
    return (
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
          aria-label={`Edit ${line.code} ${line.activity}`}
          data-testid="edit-line"
        >
          <Pencil className="size-3" /> Edit
        </button>
      </div>
    );
  return (
    <LineForm
      line={line}
      costItems={costItems}
      searchUrl={searchUrl}
      onDone={() => setEditing(false)}
    />
  );
}

function LineForm({
  line,
  costItems,
  searchUrl,
  onDone,
}: {
  line: EditableLine;
  costItems: (Option & { unit: string })[];
  searchUrl?: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<SaveLineState, FormData>(
    saveLine,
    {},
  );
  // Prefer the picked option's unit — never look up only in costItems.slice(0, 40).
  const [unit, setUnit] = useState(
    () =>
      costItems.find((c) => c.value === line.costItemId)?.unit ??
      line.unit ??
      "",
  );
  const [workers, setWorkers] = useState(String(line.workers));
  const [hours, setHours] = useState(String(line.hoursTenths / 10));
  const [manHours, setManHours] = useState(
    String((line.workers * line.hoursTenths) / 10),
  );
  const first = useRef<HTMLInputElement>(null);
  const e = state.errors ?? {};
  const id = (f: string) => `line-${line.id}-${f}`;

  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    if (state.savedAt) onDone();
  }, [state.savedAt, onDone]);

  // Workers × hours and man-hours stay in step while typing; the server applies the same rule.
  const syncFromParts = (w: string, h: string) => {
    const mh = Number(w) * Number(h);
    if (Number.isFinite(mh) && mh > 0)
      setManHours(String(Math.round(mh * 10) / 10));
  };
  const syncFromTotal = (mh: string) => {
    const n = Number(mh);
    if (!Number.isFinite(n) || n <= 0) return;
    const r = rebalance(Number(workers), Math.round(Number(hours) * 10), n);
    setWorkers(String(r.workers));
    setHours(String(r.hoursTenths / 10));
  };

  return (
    <form
      action={action}
      onKeyDown={(ev) => ev.key === "Escape" && !pending && onDone()}
      className="flex flex-col gap-3 rounded-lg border bg-background p-3"
      data-testid="line-form"
      aria-label={`Edit ${line.code} ${line.activity}`}
    >
      <input type="hidden" name="lineId" value={line.id} />
      <input
        type="hidden"
        name="label"
        value={`${line.code} ${line.activity}`}
      />
      <FormError error={e.form} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id={id("costItemId")}
          label="Cost code"
          error={e.costItemId}
          className="sm:col-span-2"
        >
          <ChoiceField
            id={id("costItemId")}
            name="costItemId"
            options={costItems}
            defaultValue={line.costItemId}
            onChange={(_value, option) => {
              const next = option?.unit ?? option?.hint;
              if (next) setUnit(next);
            }}
            disabled={pending}
            invalid={!!e.costItemId}
            describedBy={e.costItemId ? `${id("costItemId")}-error` : undefined}
            searchUrl={searchUrl}
          />
        </Field>
        <Field id={id("activity")} label="Activity" error={e.activity}>
          <TextInput
            ref={first}
            name="activity"
            defaultValue={line.activity}
            required
            maxLength={LIMITS.text.max}
            disabled={pending}
            {...described(id("activity"), e.activity)}
          />
        </Field>
        <Field id={id("location")} label="Location" error={e.location}>
          <TextInput
            name="location"
            defaultValue={line.location}
            maxLength={LIMITS.text.max}
            disabled={pending}
            {...described(id("location"), e.location)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field
          id={id("qty")}
          label={`Quantity${unit ? ` (${unit})` : ""}`}
          error={e.qty}
        >
          <NumberInput
            name="qty"
            defaultValue={line.qtyMilli / 1000}
            min={LIMITS.qty.min}
            step="any"
            required
            disabled={pending}
            {...described(id("qty"), e.qty)}
          />
        </Field>
        <Field id={id("workers")} label="Workers" error={e.workers}>
          <NumberInput
            name="workers"
            value={workers}
            onChange={(ev) => {
              setWorkers(ev.target.value);
              syncFromParts(ev.target.value, hours);
            }}
            min={LIMITS.workers.min}
            max={LIMITS.workers.max}
            step={LIMITS.workers.step}
            inputMode="numeric"
            required
            disabled={pending}
            {...described(id("workers"), e.workers)}
          />
        </Field>
        <Field id={id("hours")} label="Hours each" error={e.hours}>
          <NumberInput
            name="hours"
            value={hours}
            onChange={(ev) => {
              setHours(ev.target.value);
              syncFromParts(workers, ev.target.value);
            }}
            min={LIMITS.hours.min}
            max={LIMITS.hours.max}
            step={LIMITS.hours.step}
            required
            disabled={pending}
            {...described(id("hours"), e.hours)}
          />
        </Field>
        <Field
          id={id("manHours")}
          label="Man-hours"
          error={e.manHours}
          hint="Changes workers, or hours if they don't divide"
        >
          <NumberInput
            name="manHours"
            value={manHours}
            onChange={(ev) => setManHours(ev.target.value)}
            onBlur={(ev) => syncFromTotal(ev.target.value)}
            min={LIMITS.manHours.min}
            max={LIMITS.manHours.max}
            step={LIMITS.manHours.step}
            required
            disabled={pending}
            {...described(id("manHours"), e.manHours)}
          />
        </Field>
      </div>
      <Field id={id("notes")} label="Notes" error={e.notes}>
        <TextArea
          name="notes"
          defaultValue={line.notes}
          maxLength={LIMITS.notes.max}
          disabled={pending}
          {...described(id("notes"), e.notes)}
        />
      </Field>
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
}
