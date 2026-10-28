import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChangeLogList } from "@/components/app/change-log-list";
import type { AppRole } from "@/components/app/list-empty";
import { MetricCard, PageHeader, Section } from "@/components/app/page";
import { reportedDayInSummary } from "@/lib/reported-day";
import { getJobHeader } from "@/server/data";
import { jobChanges, jobChangesCount } from "@/server/job-changes";
import { requireUser } from "@/server/session";

const PAGE_SIZE = 50;

export default function JobChangesPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
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
      <Changes params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Changes({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { number } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const requested = Number(sp.page ?? "1") || 1;
  const page = Math.max(1, requested);
  // Header, count, and the page of rows are independent. The old path waited
  // on a full WBS rollup before either query, which blew the 1500 ms budget.
  const [job, total, changes] = await Promise.all([
    getJobHeader(user.companyId, number),
    jobChangesCount(user.companyId, number),
    jobChanges(user.companyId, number, PAGE_SIZE, (page - 1) * PAGE_SIZE),
  ]);
  if (!job) notFound();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Foreman must not see cost-index language in the feed (5.0.4-b check 2).
  const costBan = /\bCPI\b|\bSPI\b|At risk|[−-]\$\d/;
  // Newest first. A day reported, returned, and reported again is one report
  // row. The earlier "Reported …" run stays in the assistant log.
  const seenReportDay = new Set<string>();
  const visible = changes.filter((c) => {
    if (user.role === "foreman" && costBan.test(c.summary)) return false;
    if (c.action !== "dailyReport.post") return true;
    const day = reportedDayInSummary(c.summary);
    if (!day) return true;
    if (seenReportDay.has(day)) return false;
    seenReportDay.add(day);
    return true;
  });

  return (
    <>
      <PageHeader
        title="Changes on this job"
        purpose="Every recorded change on this job, newest first."
        meta={
          <>
            <a
              href={`/app/jobs/${job.number}`}
              className="tap-target inline-flex items-center underline hover:no-underline"
              data-testid="changes-back"
            >
              {job.number} · {job.name}
            </a>
            {" · "}
            {total === 0
              ? "No changes yet"
              : `${total} ${total === 1 ? "change" : "changes"}`}
          </>
        }
      />
      <MetricCard
        label="Changes logged"
        value={total.toLocaleString("en-US")}
        secondary={[
          total === 0 ? "None yet" : "Newest first",
          totalPages > 1 ? `Page ${page} of ${totalPages}` : "One page",
        ]}
        testId="changes-count-card"
        className="mb-0"
      />
      <Section
        title="All changes"
        meta="Newest first · 50 per page"
        actions={
          totalPages > 1 ? (
            <nav
              data-text="label"
              className="flex items-center gap-2 text-label"
              data-testid="changes-pagination"
              aria-label="Change list pages"
            >
              {page > 1 ? (
                <a
                  href={`/app/jobs/${number}/changes?page=${page - 1}`}
                  className="tap-target inline-flex items-center underline hover:no-underline"
                >
                  Previous
                </a>
              ) : null}
              <span className="tabular-nums text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <a
                  href={`/app/jobs/${number}/changes?page=${page + 1}`}
                  className="tap-target inline-flex items-center underline hover:no-underline"
                >
                  Next
                </a>
              ) : null}
            </nav>
          ) : null
        }
      >
        <ChangeLogList
          changes={visible}
          jobNumber={job.number}
          role={user.role as AppRole}
          estimateApproved={!job.estimateDraft}
        />
      </Section>
    </>
  );
}
