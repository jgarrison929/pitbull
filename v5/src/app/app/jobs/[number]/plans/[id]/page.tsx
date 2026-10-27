import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Figure } from "@/components/app/format";
import { LocalTime } from "@/components/app/local-time";
import {
  PlanHistoryEmpty,
  PlanLinesEmpty,
  type AppRole,
} from "@/components/app/list-empty";
import { MetricCard, PageHeader, Section, Td, Th } from "@/components/app/page";
import { utcDay } from "@/lib/dates";
import { qty, usdCents } from "@/lib/ev";
import { cn } from "@/lib/utils";
import { getPlanPage } from "@/server/plan-page";
import { requireUser } from "@/server/session";

const statusLabel: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  reported: "Reported",
  approved: "Approved",
};

const historyLabel: Record<string, string> = {
  created: "Created",
  submitted: "Submitted",
  reported: "Reported",
  returned: "Returned",
  approved: "Approved",
};

const roleLabel: Record<string, string> = {
  executive: "Executive",
  pm: "Project manager",
  superintendent: "Superintendent",
  foreman: "Foreman",
};

/** Demo company zone — plan history always shows PT, not the visitor's zone. */
const COMPANY_ZONE = "America/Los_Angeles";

function formatMh(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export default function PlanPage({
  params,
}: {
  params: Promise<{ number: string; id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="h-96 animate-pulse rounded-lg bg-muted"
          aria-busy="true"
        />
      }
    >
      <Plan params={params} />
    </Suspense>
  );
}

async function Plan({
  params,
}: {
  params: Promise<{ number: string; id: string }>;
}) {
  const { number, id } = await params;
  const user = await requireUser();
  const data = await getPlanPage(user.companyId, number, id);
  if (!data) notFound();

  const plannedMh = data.lines.reduce((s, l) => s + l.manHours, 0);
  const reportedMh = data.lines.every((l) => l.reportedManHours == null)
    ? null
    : data.lines.reduce((s, l) => s + (l.reportedManHours ?? 0), 0);
  const showReported =
    data.plan.status === "reported" || data.plan.status === "approved";

  return (
    <>
      <PageHeader
        title={`${data.plan.crew} · ${utcDay(data.plan.planDate)}`}
        purpose="One daily plan: its lines, what was reported, and each step it went through."
        meta={
          <>
            {/*
              Plain <a>, not next/link: Link still fires ?_rsc= after paint
              (even with prefetch={false}), and each plan line cost-code link
              would hold verify networkidle on this page the same way shell
              Links held cost-item drills (#29).
            */}
            <a
              href={`/app/jobs/${data.job.number}`}
              className="tap-target inline-flex items-center underline hover:no-underline"
              data-testid="plan-detail-back"
            >
              {data.job.number} · {data.job.name}
            </a>
            {" · Foreman "}
            {data.plan.foreman}
            {" · "}
            {data.plan.rateCents != null
              ? `${usdCents(data.plan.rateCents)} / MH`
              : "Rate —"}
            {" · "}
            <span data-testid="plan-detail-status">
              {statusLabel[data.plan.status] ?? data.plan.status}
            </span>
          </>
        }
      />

      <div className="card-stack grid grid-cols-2">
        <MetricCard
          label={showReported ? "Reported man-hours" : "Planned man-hours"}
          value={
            showReported && reportedMh != null
              ? formatMh(reportedMh)
              : formatMh(plannedMh)
          }
          secondary={
            showReported
              ? [`Planned ${formatMh(plannedMh)} MH`, `${data.lines.length} lines`]
              : [`${data.lines.length} lines`]
          }
          testId="plan-detail-mh"
        />
        <MetricCard
          label="Status"
          value={statusLabel[data.plan.status] ?? data.plan.status}
          secondary={[`Foreman ${data.plan.foreman}`]}
          testId="plan-detail-status-card"
        />
      </div>

      <Section
        title="Plan lines"
        meta="Planned and reported quantity and man-hours. Approve, return, and report stay on the job page."
      >
        <div data-testid="plan-detail-lines">
        {data.lines.length === 0 ? (
          <PlanLinesEmpty
            role={user.role as AppRole}
            status={data.plan.status}
            jobNumber={data.job.number}
          />
        ) : (
        <>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[36rem] text-body">
            <thead>
              <tr className="border-b text-left">
                <Th>Cost code</Th>
                <Th>Activity</Th>
                <Th right>Planned qty</Th>
                <Th right>Reported qty</Th>
                <Th right>Planned MH</Th>
                <Th right>Reported MH</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.lines.map((l) => (
                <tr key={l.id} data-testid="plan-detail-line">
                  <Td>
                    <a
                      href={`/app/jobs/${data.job.number}/cost-items/${encodeURIComponent(l.code)}`}
                      className="font-mono text-label underline hover:no-underline"
                      data-text="label"
                    >
                      {l.code}
                    </a>
                  </Td>
                  <Td>{l.activity}</Td>
                  <Td right className="tabular-nums">
                    {qty(l.qtyMilli)} {l.unit}
                  </Td>
                  <Td right className="tabular-nums">
                    {l.reportedQtyMilli == null
                      ? "—"
                      : `${qty(l.reportedQtyMilli)} ${l.unit}`}
                  </Td>
                  <Td right className="tabular-nums">
                    {formatMh(l.manHours)}
                  </Td>
                  <Td right className="tabular-nums">
                    {l.reportedManHours == null
                      ? "—"
                      : formatMh(l.reportedManHours)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="divide-y md:hidden">
          {data.lines.map((l) => {
            const primaryMh =
              showReported && l.reportedManHours != null
                ? l.reportedManHours
                : l.manHours;
            const primaryLabel =
              showReported && l.reportedManHours != null
                ? "Reported MH"
                : "Planned MH";
            return (
              <li key={l.id} data-card data-testid="plan-detail-line" className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={`/app/jobs/${data.job.number}/cost-items/${encodeURIComponent(l.code)}`}
                      className="tap-target inline-flex items-center font-mono text-label underline hover:no-underline"
                      data-text="label"
                    >
                      {l.code}
                    </a>
                    <div className="text-body font-medium">{l.activity}</div>
                  </div>
                </div>
                <div className="mt-2">
                  <div
                    data-text="label"
                    className="text-label font-medium text-muted-foreground"
                  >
                    {primaryLabel}
                  </div>
                  <Figure variant="primary" className="mt-0.5 block">
                    {formatMh(primaryMh)}
                  </Figure>
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <Figure variant="secondary">
                    Planned {qty(l.qtyMilli)} {l.unit}
                  </Figure>
                  <Figure variant="secondary">
                    {l.reportedQtyMilli == null
                      ? "Reported —"
                      : `Reported ${qty(l.reportedQtyMilli)} ${l.unit}`}
                  </Figure>
                </div>
                <details className="mt-2">
                  <summary
                    data-text="label"
                    className="tap-target flex cursor-pointer list-none items-center text-label font-medium text-muted-foreground [&::-webkit-details-marker]:hidden"
                  >
                    Line detail
                  </summary>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-body text-muted-foreground">
                    <span>Planned MH {formatMh(l.manHours)}</span>
                    <span>
                      Reported MH{" "}
                      {l.reportedManHours == null
                        ? "—"
                        : formatMh(l.reportedManHours)}
                    </span>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
        </>
        )}
        </div>
      </Section>

      <Section title="History" meta="Every step this plan went through">
        {data.history.length === 0 ? (
          <PlanHistoryEmpty
            role={user.role as AppRole}
            status={data.plan.status}
            jobNumber={data.job.number}
          />
        ) : (
          <ol className="divide-y px-4" data-testid="plan-history">
            {data.history.map((h, i) => (
              <li
                key={`${h.kind}-${h.at}-${i}`}
                className="flex flex-wrap items-baseline gap-x-2 py-3 text-body"
                data-testid="plan-history-event"
                data-kind={h.kind}
                data-actor-role={h.actorRole}
              >
                <span
                  className={cn(
                    "font-medium",
                    h.kind === "returned" && "text-caution",
                  )}
                >
                  {historyLabel[h.kind]}
                  {h.kind === "returned" && h.detail
                    ? ` (“${h.detail}”)`
                    : null}
                </span>
                <span
                  data-text="label"
                  className="text-label text-muted-foreground"
                  data-testid="plan-history-role"
                >
                  · {roleLabel[h.actorRole] ?? h.actorRole}
                </span>
                <span
                  data-text="label"
                  className="text-label text-muted-foreground"
                >
                  <LocalTime iso={h.at} timeZone={COMPANY_ZONE} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}
