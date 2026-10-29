import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChangeLogList } from "@/components/app/change-log-list";
import type { AppRole } from "@/components/app/list-empty";
import { MetricCard, PageHeader, Section } from "@/components/app/page";
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
  const requestedRaw = Number(sp.page ?? "1");
  const requested =
    Number.isFinite(requestedRaw) && requestedRaw >= 1
      ? Math.floor(requestedRaw)
      : 1;
  // Foreman must not see cost-index language in the feed (5.0.4-b check 2).
  // The filter is in the SQL so the page reads one bounded slice, not the
  // whole feed, and the count matches what is shown.
  const feedOptions = {
    excludeCostLanguage: user.role === "foreman",
  };
  // Page 1 (the crawl) overlaps the count and the slice. A page past the
  // end is clamped after the count comes back.
  const [job, total, requestedRows] = await Promise.all([
    getJobHeader(user.companyId, number),
    jobChangesCount(user.companyId, number, feedOptions),
    jobChanges(
      user.companyId,
      number,
      PAGE_SIZE,
      (requested - 1) * PAGE_SIZE,
      feedOptions,
    ),
  ]);
  if (!job) notFound();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  const visible =
    page === requested
      ? requestedRows
      : await jobChanges(
          user.companyId,
          number,
          PAGE_SIZE,
          (page - 1) * PAGE_SIZE,
          feedOptions,
        );

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
