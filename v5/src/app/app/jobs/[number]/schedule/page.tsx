import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobGantt } from "@/components/app/gantt";
import { PageHeader, Section } from "@/components/app/page";
import { isEstimateDraft } from "@/lib/portfolio";
import { getJob } from "@/server/data";
import { getJobSchedule } from "@/server/schedule-view";
import { requireUser } from "@/server/session";

export default function JobSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  // Mirror /changes so cacheComponents can return a real HTTP 404.
  searchParams: Promise<{ page?: string }>;
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
      <Schedule params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Schedule({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { number } = await params;
  await searchParams;
  const user = await requireUser();
  // Same early gate as /changes: unknown job → notFound before schedule reads.
  const job = await getJob(user.companyId, number);
  if (!job) notFound();
  // Harbor (draft) has no Schedule nav entry — do not serve an empty shell.
  if (isEstimateDraft(job.job)) notFound();

  const schedule = await getJobSchedule(user.companyId, number);
  if (!schedule || !schedule.showScheduleNav) notFound();

  const count = schedule.activities.length;

  return (
    <>
      <PageHeader
        title="Schedule"
        meta={
          <>
            <Link
              href={`/app/jobs/${schedule.job.number}`}
              className="underline hover:no-underline"
              data-testid="schedule-back"
            >
              {schedule.job.number} · {schedule.job.name}
            </Link>
            {" · "}
            {count === 0
              ? "Ready for the first activity"
              : `${count} ${count === 1 ? "activity" : "activities"}`}
          </>
        }
      />
      <Section
        title="Gantt"
        meta="Rows ordered by early start. Expand a row for linked cost items. Holiday columns are shaded. This view is read-only."
        className="overflow-hidden"
      >
        <JobGantt schedule={schedule} />
      </Section>
    </>
  );
}
