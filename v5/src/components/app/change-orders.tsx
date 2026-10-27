"use client";

import { useActionState, useState } from "react";
import { runAction, runActionState, type ActionState } from "@/app/app/assistant/actions";
import { ChoiceField } from "@/components/form/combobox";
import { LocalTime } from "@/components/app/local-time";
import {
  ChangeOrderLinesEmpty,
  ChangeOrdersEmpty,
} from "@/components/app/list-empty";
import type { Option } from "@/components/form/form";
import type { CoCommandName, CoStatus } from "@/lib/change-order";
import { qty, usdCents } from "@/lib/ev";
import type { ChangeOrderView, JobChangeOrders } from "@/server/change-orders";

const COMMAND_LABEL: Record<CoCommandName, string> = {
  create: "Raise",
  price: "Price",
  approve: "Approve",
  reject: "Reject",
  void: "Void",
};

const STATUS_LABEL: Record<CoStatus, string> = {
  draft: "Draft",
  priced: "Priced",
  approved: "Approved",
  rejected: "Rejected",
  voided: "Voided",
};

const signed = (cents: number) =>
  `${cents > 0 ? "+" : ""}${usdCents(cents)}`;

type Can = Record<CoCommandName, boolean>;

export function ChangeOrdersSection({
  jobNumber,
  data,
  can,
  costItems,
  searchUrl,
}: {
  jobNumber: string;
  data: JobChangeOrders;
  can: Can;
  costItems: (Option & { unit?: string })[];
  searchUrl: string;
}) {
  const { ledger } = data;
  const [raising, setRaising] = useState(false);
  const noOrders = data.changeOrders.length === 0;
  const showRaiseForm =
    data.job.estimateApproved && can.create && (!noOrders || raising);
  return (
    <section
      id="change-orders"
      className="rounded-lg border bg-card"
      data-testid="co-ledger"
      data-job-number={jobNumber}
      data-original-cents={ledger.originalCents}
      data-approved-cents={ledger.approvedChangesCents}
      data-current-cents={ledger.currentCents}
      data-pending-cents={ledger.pendingCents}
      data-reconciled={ledger.reconciled ? "true" : "false"}
    >
      <header className="border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Change orders</h2>
        <p className="text-xs leading-snug text-muted-foreground">
          Revises Current Budget after the estimate is approved. Original
          Budget does not move. Priced orders are pending until a PM or
          executive approves them, and they are not in Current Budget or EAC.
        </p>
      </header>
      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-sm tabular-nums">
          Original {usdCents(ledger.originalCents)} + approved changes{" "}
          {usdCents(ledger.approvedChangesCents)} = Current{" "}
          {usdCents(ledger.currentCents)}
          <span className="text-muted-foreground">
            {" "}
            · Pending {usdCents(ledger.pendingCents)} (not in budget)
          </span>
        </p>
        {ledger.reconciled ? null : (
          <p className="text-xs">
            Original plus approved changes does not equal Current Budget.
            These figures are read from the cost items and the approved lines.
          </p>
        )}
        {showRaiseForm ? (
          <RaiseForm jobNumber={jobNumber} autoFocus={noOrders && raising} />
        ) : null}
        {!data.job.estimateApproved && !noOrders ? (
          <p className="text-sm text-muted-foreground">
            Approve the estimate before raising a change order. Approving the
            estimate sets Current Budget from the Current Estimate, so a change
            order on a draft estimate would be wiped out.
          </p>
        ) : null}
        {noOrders ? (
          <ChangeOrdersEmpty
            jobNumber={jobNumber}
            canCreate={can.create}
            estimateApproved={data.job.estimateApproved}
            onCreate={() => setRaising(true)}
            onReviewEstimate={() => {
              const el = document.querySelector(
                '[data-testid="approve-estimate"]',
              );
              if (el instanceof HTMLElement) {
                el.scrollIntoView({ block: "center" });
                el.focus();
              }
            }}
          />
        ) : (
          data.changeOrders.map((co) => (
            <ChangeOrderCard
              key={co.id}
              jobNumber={jobNumber}
              co={co}
              can={can}
              costItems={costItems}
              searchUrl={searchUrl}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ChangeOrderCard({
  jobNumber,
  co,
  can,
  costItems,
  searchUrl,
}: {
  jobNumber: string;
  co: ChangeOrderView;
  can: Can;
  costItems: (Option & { unit?: string })[];
  searchUrl: string;
}) {
  const commands = co.commands.filter((c) => can[c]);
  const [pricing, setPricing] = useState(false);
  const noLines = co.lines.length === 0;
  const canPrice = commands.includes("price");
  return (
    <article
      className="rounded-md border"
      data-testid="co-card"
      data-job-number={jobNumber}
      data-co-number={co.number}
      data-status={co.status}
      data-total-cents={co.totalCents}
      data-revision={co.revision}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">
            {co.label} · {co.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {STATUS_LABEL[co.status]} · rev {co.revision}
            {co.reason ? ` · ${co.reason}` : ""}
          </p>
        </div>
        <p className="text-sm font-medium tabular-nums">
          {usdCents(co.totalCents)}
        </p>
      </header>
      {co.lines.length ? (
        <>
          {/* Phone: stack categories so the card stays inside the viewport. */}
          <ul className="divide-y text-xs md:hidden" data-testid="co-lines-stack">
            {co.lines.map((line) => (
              <li key={line.sort} className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0">
                    <span className="font-medium">{line.code}</span>{" "}
                    {line.description}
                    {line.created ? (
                      <span className="ml-1 text-muted-foreground">new</span>
                    ) : null}
                  </p>
                  <p className="shrink-0 tabular-nums font-medium">
                    {usdCents(line.totalCents)}
                  </p>
                </div>
                {line.qtyDeltaMilli !== 0 ? (
                  <p className="mt-0.5 text-muted-foreground">
                    Qty {signedQty(line.qtyDeltaMilli)} {line.unit}
                  </p>
                ) : null}
                {line.note ? (
                  <p className="mt-0.5 text-muted-foreground">{line.note}</p>
                ) : null}
                {/*
                  Single column on phone: a 2-col grid at ~320px lets a value
                  run into the next label (e.g. "$8,000.00Material").
                */}
                <dl className="mt-1.5 grid grid-cols-1 gap-y-1 text-muted-foreground">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0">Labor</dt>
                    <dd className="min-w-0 text-right tabular-nums text-foreground">
                      {usdCents(line.delta.laborCents)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0">Material</dt>
                    <dd className="min-w-0 text-right tabular-nums text-foreground">
                      {usdCents(line.delta.materialCents)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0">Equipment</dt>
                    <dd className="min-w-0 text-right tabular-nums text-foreground">
                      {usdCents(line.delta.equipmentCents)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0">Sub</dt>
                    <dd className="min-w-0 text-right tabular-nums text-foreground">
                      {usdCents(line.delta.subCents)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          {/* Desktop: full L/M/E/S table. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs" data-testid="co-lines-table">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-1 font-medium">Cost item</th>
                  <th className="px-2 py-1 text-right font-medium">Labor</th>
                  <th className="px-2 py-1 text-right font-medium">Material</th>
                  <th className="px-2 py-1 text-right font-medium">Equipment</th>
                  <th className="px-2 py-1 text-right font-medium">Sub</th>
                  <th className="px-3 py-1 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {co.lines.map((line) => (
                  <tr key={line.sort} className="border-t">
                    <td className="px-3 py-1.5">
                      <span className="font-medium">{line.code}</span>{" "}
                      {line.description}
                      {line.created ? (
                        <span className="ml-1 text-muted-foreground">new</span>
                      ) : null}
                      {line.qtyDeltaMilli !== 0 ? (
                        <span className="mt-0.5 block text-muted-foreground">
                          Qty {signedQty(line.qtyDeltaMilli)} {line.unit}
                        </span>
                      ) : null}
                      {line.note ? (
                        <span className="mt-0.5 block text-muted-foreground">
                          {line.note}
                        </span>
                      ) : null}
                    </td>
                    <MoneyCell cents={line.delta.laborCents} />
                    <MoneyCell cents={line.delta.materialCents} />
                    <MoneyCell cents={line.delta.equipmentCents} />
                    <MoneyCell cents={line.delta.subCents} />
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {usdCents(line.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <ChangeOrderLinesEmpty
          status={co.status}
          canPrice={canPrice && !pricing}
          onPrice={() => setPricing(true)}
        />
      )}
      {noLines && pricing ? (
        <div className="border-t px-3 py-2">
          <PriceForm
            jobNumber={jobNumber}
            changeOrderId={co.id}
            costItems={costItems}
            searchUrl={searchUrl}
            startOpen
          />
        </div>
      ) : null}
      {co.preview ? (
        <p className="border-t px-3 py-2 text-xs" data-testid="co-preview">
          {co.preview.ok
            ? `If approved now: Current Budget ${signed(co.preview.move.cbDeltaCents)} · EAC ${signed(co.preview.move.eacDeltaCents)}.`
            : co.preview.why}
        </p>
      ) : null}
      {co.history.length ? (
        <ul className="border-t px-3 py-1 text-xs">
          {co.history.map((h) => (
            <li key={`${h.command}-${h.at}`} className="py-1">
              <span className="font-medium">{h.actorName}</span>
              <span className="text-muted-foreground"> · {h.actorRole}</span>
              {" · "}
              {h.from ? `${h.from} → ${h.to}` : h.to}
              {h.reason ? ` · ${h.reason}` : ""}
              {h.cbDeltaCents !== null && h.eacDeltaCents !== null
                ? ` · Current Budget ${signed(h.cbDeltaCents)}, EAC ${signed(h.eacDeltaCents)}`
                : ""}{" "}
              <span className="text-muted-foreground">
                <LocalTime iso={h.at} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {commands.some((c) => !(c === "price" && noLines)) ? (
        <div className="flex flex-wrap items-start gap-3 border-t px-3 py-2">
          {commands.map((c) =>
            c === "price" && noLines ? null : c === "price" ? (
              <PriceForm
                key={c}
                jobNumber={jobNumber}
                changeOrderId={co.id}
                costItems={costItems}
                searchUrl={searchUrl}
              />
            ) : c === "reject" || c === "void" ? (
              <ReasonCommand
                key={c}
                jobNumber={jobNumber}
                changeOrderId={co.id}
                command={c}
              />
            ) : (
              <CommandForm
                key={c}
                jobNumber={jobNumber}
                changeOrderId={co.id}
                command={c}
                revision={co.revision}
              />
            ),
          )}
        </div>
      ) : null}
    </article>
  );
}

function MoneyCell({ cents }: { cents: number }) {
  return (
    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
      {cents === 0 ? "—" : usdCents(cents)}
    </td>
  );
}

const signedQty = (milli: number) =>
  `${milli > 0 ? "+" : ""}${qty(milli)}`;

function CommandForm({
  jobNumber,
  changeOrderId,
  command,
  revision,
}: {
  jobNumber: string;
  changeOrderId: string;
  command: CoCommandName;
  revision: number;
}) {
  return (
    <form action={runAction}>
      <input type="hidden" name="action" value={`changeOrder.${command}`} />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="changeOrder" value={changeOrderId} />
      <input type="hidden" name="label" value={COMMAND_LABEL[command]} />
      {command === "approve" ? (
        <input type="hidden" name="revision" value={String(revision)} />
      ) : null}
      <button
        type="submit"
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        data-testid={`co-${command}`}
      >
        {COMMAND_LABEL[command]}
      </button>
    </form>
  );
}

function ReasonCommand({
  jobNumber,
  changeOrderId,
  command,
}: {
  jobNumber: string;
  changeOrderId: string;
  command: "reject" | "void";
}) {
  return (
    <form action={runAction} className="flex flex-col gap-1">
      <input type="hidden" name="action" value={`changeOrder.${command}`} />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="changeOrder" value={changeOrderId} />
      <input type="hidden" name="label" value={COMMAND_LABEL[command]} />
      <input
        name="reason"
        type="text"
        required
        maxLength={200}
        placeholder={command === "reject" ? "Why reject it?" : "Why void it?"}
        className="rounded-md border bg-background px-2 py-1 text-sm"
        data-testid={`co-${command}-reason`}
      />
      <button
        type="submit"
        className="rounded-md border px-3 py-1.5 text-xs font-medium"
        data-testid={`co-${command}`}
      >
        {COMMAND_LABEL[command]}
      </button>
    </form>
  );
}

function RaiseForm({
  jobNumber,
  autoFocus,
}: {
  jobNumber: string;
  autoFocus?: boolean;
}) {
  return (
    <form
      action={runAction}
      className="flex flex-wrap items-end gap-2"
      data-testid="co-raise-form"
    >
      <input type="hidden" name="action" value="changeOrder.create" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="label" value="Raise change order" />
      <label className="flex min-w-48 flex-1 flex-col gap-0.5 text-xs">
        Title
        <input
          name="title"
          type="text"
          required
          maxLength={120}
          placeholder="What changed?"
          autoFocus={autoFocus}
          className="rounded-md border bg-background px-2 py-1 text-sm"
          data-testid="co-raise-title"
        />
      </label>
      <label className="flex min-w-40 flex-1 flex-col gap-0.5 text-xs">
        Reason
        <input
          name="reason"
          type="text"
          maxLength={200}
          placeholder="Owner directive, design, field condition"
          className="rounded-md border bg-background px-2 py-1 text-sm"
          data-testid="co-raise-reason"
        />
      </label>
      <button
        type="submit"
        className="rounded-md border px-3 py-1.5 text-xs font-medium"
        data-testid="co-create"
      >
        Raise
      </button>
    </form>
  );
}

type LineMode = { key: number; add: boolean };

function PriceForm({
  jobNumber,
  changeOrderId,
  costItems,
  searchUrl,
  startOpen = false,
}: {
  jobNumber: string;
  changeOrderId: string;
  costItems: (Option & { unit?: string })[];
  searchUrl: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [rows, setRows] = useState<LineMode[]>([{ key: 1, add: true }]);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );
  if (!open)
    return (
      <button
        type="button"
        className="rounded-md border px-3 py-1.5 text-xs font-medium"
        data-testid="co-price"
        onClick={() => setOpen(true)}
      >
        Price
      </button>
    );
  return (
    <form
      action={action}
      className="flex w-full flex-col gap-2"
      data-testid="co-price-form"
    >
      <input type="hidden" name="action" value="changeOrder.price" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="changeOrder" value={changeOrderId} />
      <input type="hidden" name="label" value="Price change order" />
      {rows.map((row, i) => (
        <PriceRow
          key={row.key}
          index={i}
          add={row.add}
          costItems={costItems}
          searchUrl={searchUrl}
          errors={state.errors}
          onAddChange={(add) =>
            setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, add } : r)))
          }
        />
      ))}
      {state.errors?.lines ? (
        <p className="text-xs text-negative">{state.errors.lines}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-xs"
          onClick={() =>
            setRows((prev) => [...prev, { key: Date.now(), add: false }])
          }
        >
          Add line
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          data-testid="co-price-submit"
        >
          {pending ? "Pricing…" : "Save price"}
        </button>
      </div>
      {state.summary ? (
        <p className="text-xs text-muted-foreground" data-testid="co-price-summary">
          {state.summary}
        </p>
      ) : null}
    </form>
  );
}

function PriceRow({
  index,
  add,
  costItems,
  searchUrl,
  errors,
  onAddChange,
}: {
  index: number;
  add: boolean;
  costItems: (Option & { unit?: string })[];
  searchUrl: string;
  errors?: Record<string, string>;
  onAddChange: (add: boolean) => void;
}) {
  const err = (field: string) => errors?.[`lines.${index}.${field}`];
  const name = (field: string) => `coLine[${index}][${field}]`;
  const input = "rounded-md border bg-background px-2 py-1 text-sm";
  return (
    <div className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-xs sm:col-span-2">
        <input
          type="checkbox"
          checked={add}
          onChange={(e) => onAddChange(e.target.checked)}
        />
        Add a new cost item
      </label>
      {add ? (
        <>
          <label className="flex flex-col gap-0.5 text-xs">
            New code
            <input name={name("code")} required className={input} placeholder="91-100" />
            <FieldError message={err("code")} />
          </label>
          <label className="flex flex-col gap-0.5 text-xs">
            Description
            <input
              name={name("description")}
              required
              className={input}
              placeholder="Retaining wall, north approach"
            />
            <FieldError message={err("description")} />
          </label>
          <label className="flex flex-col gap-0.5 text-xs">
            Unit
            <input name={name("unit")} required className={input} placeholder="LS" />
            <FieldError message={err("unit")} />
          </label>
          <label className="flex flex-col gap-0.5 text-xs">
            Parent code
            <input
              name={name("parentCode")}
              className={input}
              placeholder="Blank for a root item"
            />
            <FieldError message={err("parentCode")} />
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-0.5 text-xs sm:col-span-2">
          Cost item
          <ChoiceField
            id={`co-line-${index}-item`}
            name={name("costItemId")}
            options={costItems}
            defaultValue=""
            searchUrl={searchUrl}
          />
          <FieldError message={err("code")} />
        </label>
      )}
      {(
        [
          ["labor", "Labor $"],
          ["material", "Material $"],
          ["equipment", "Equipment $"],
          ["sub", "Sub $"],
          ["qty", "Qty change"],
        ] as const
      ).map(([field, label]) => (
        <label key={field} className="flex flex-col gap-0.5 text-xs">
          {label}
          <input name={name(field)} className={`${input} tabular-nums`} placeholder="0" />
          <FieldError message={err(field)} />
        </label>
      ))}
      <label className="flex flex-col gap-0.5 text-xs sm:col-span-2">
        Note
        <input name={name("note")} className={input} />
        <FieldError message={err("note")} />
      </label>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-[11px] font-medium text-negative">{message}</span>;
}
