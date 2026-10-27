import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportScheduleForm } from "@/components/app/import-schedule-form";
import { PageHeader, Section } from "@/components/app/page";
import { actions } from "@/server/assistant/actions";
import { listJobActivities } from "@/server/schedule-read";
import { getJob } from "@/server/data";
import { requireUser, type CurrentUser } from "@/server/session";

export default function SchedulePage({
  params,
}: PageProps<"/app/jobs/[number]/schedule">) {
  return (
    <Suspense
      fallback={
        <div
          className="h-96 animate-pulse rounded-lg bg-muted"
          aria-busy="true"
        />
      }
    >
      <Schedule params={params} />
    </Suspense>
  );
}

/**
 * Schedule page shell (5.1.3-c import UI). Gantt bars are 5.1.0-c.
 * Harbor (draft estimate) has no Schedule route — matches 5.1.0-c.
 */
export async function Schedule({
  params,
  user: userOverride,
}: {
  params: Promise<{ number: string }>;
  user?: CurrentUser;
}) {
  const { number } = await params;
  const user = userOverride ?? (await requireUser());
  const p = await getJob(user.companyId, number);
  if (!p) notFound();
  if (p.job.estimateStatus === "draft") notFound();

  const canImport =
    actions["schedule.importXer"].roles?.includes(user.role) ?? false;
  const activities = await listJobActivities(user.companyId, p.job.id);

  return (
    <div className="flex flex-col gap-4" data-testid="schedule-page">
      <PageHeader
        title={`Schedule · ${p.job.shortName}`}
        meta={
          <>
            <Link
              href={`/app/jobs/${p.job.number}`}
              className="underline hover:no-underline"
              data-testid="schedule-back-to-job"
            >
              {p.job.number}
            </Link>
            {" · "}
            {p.job.name}
          </>
        }
      />

      {canImport ? (
        <ImportScheduleForm jobNumber={p.job.number} />
      ) : (
        <p
          className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground"
          data-testid="schedule-readonly-note"
        >
          Schedule import is limited to the project manager. You can read the
          activity list below.
        </p>
      )}

      <Section
        title="Activities"
        meta="Early start order. Linked cost items stay as the seed or PM set them — import does not invent Schedule ID links."
      >
        {activities.length === 0 ? (
          <p
            className="px-4 py-3 text-sm text-muted-foreground"
            data-testid="schedule-empty"
          >
            This approved job has no activities. A project manager can import a
            Primavera XER or Microsoft Project XML file to load the graph.
          </p>
        ) : (
          <ul
            className="divide-y text-sm"
            data-testid="schedule-activity-list"
          >
            {activities.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2"
                data-testid="schedule-activity-row"
                data-code={a.code}
              >
                <span className="font-medium tabular-nums">{a.code}</span>
                <span className="min-w-0 flex-1">{a.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {a.durationDays}d · {a.earlyStartOn} → {a.earlyFinishOn}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
