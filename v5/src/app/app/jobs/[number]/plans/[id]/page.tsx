import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/app/local-time";
import {
  PlanHistoryEmpty,
  PlanLinesEmpty,
  type AppRole,
} from "@/components/app/list-empty";
import { PageHeader, Section } from "@/components/app/page";
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

  return (
    <>
      <PageHeader
        title={`${data.plan.crew} · ${utcDay(data.plan.planDate)}`}
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
              className="underline hover:no-underline"
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Cost code</th>
                <th className="px-4 py-2 font-medium">Activity</th>
                <th className="px-4 py-2 text-right font-medium">Planned qty</th>
                <th className="px-4 py-2 text-right font-medium">Reported qty</th>
                <th className="px-4 py-2 text-right font-medium">Planned MH</th>
                <th className="px-4 py-2 text-right font-medium">Reported MH</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.lines.map((l) => (
                <tr key={l.id} data-testid="plan-detail-line">
                  <td className="px-4 py-2 font-mono text-xs">
                    <a
                      href={`/app/jobs/${data.job.number}/cost-items/${encodeURIComponent(l.code)}`}
                      className="underline hover:no-underline"
                    >
                      {l.code}
                    </a>
                  </td>
                  <td className="px-4 py-2">{l.activity}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {qty(l.qtyMilli)} {l.unit}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.reportedQtyMilli == null
                      ? "—"
                      : `${qty(l.reportedQtyMilli)} ${l.unit}`}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.manHours.toLocaleString("en-US", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.reportedManHours == null
                      ? "—"
                      : l.reportedManHours.toLocaleString("en-US", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                className="flex flex-wrap items-baseline gap-x-2 py-2 text-sm"
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
                  className="text-muted-foreground"
                  data-testid="plan-history-role"
                >
                  · {roleLabel[h.actorRole] ?? h.actorRole}
                </span>
                <span className="text-xs text-muted-foreground">
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
