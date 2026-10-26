import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/app/local-time";
import { PageHeader, Section } from "@/components/app/page";
import { jobChanges, jobChangesCount } from "@/server/assistant/actions";
import { getJob } from "@/server/data";
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
  const job = await getJob(user.companyId, number);
  if (!job) notFound();

  const requested = Number(sp.page ?? "1") || 1;
  const total = await jobChangesCount(user.companyId, number);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, requested), totalPages);
  const changes = await jobChanges(
    user.companyId,
    number,
    PAGE_SIZE,
    (page - 1) * PAGE_SIZE,
  );
  // Foreman must not see cost-index language in the feed (5.0.4-b check 2).
  const costBan = /\bCPI\b|\bSPI\b|At risk|[−-]\$\d/;
  const visible =
    user.role === "foreman"
      ? changes.filter((c) => !costBan.test(c.summary))
      : changes;

  return (
    <>
      <PageHeader
        title="Changes on this job"
        purpose="Every recorded change on this job, newest first."
        meta={
          <>
            <Link
              href={`/app/jobs/${job.job.number}`}
              className="underline hover:no-underline"
              data-testid="changes-back"
            >
              {job.job.number} · {job.job.name}
            </Link>
            {" · "}
            {total === 0
              ? "No changes yet"
              : `${total} ${total === 1 ? "change" : "changes"}`}
          </>
        }
      />
      <Section
        title="All changes"
        meta="Newest first · 50 per page"
        actions={
          totalPages > 1 ? (
            <nav
              className="flex items-center gap-2 text-xs"
              data-testid="changes-pagination"
              aria-label="Change list pages"
            >
              {page > 1 ? (
                <Link
                  href={`/app/jobs/${number}/changes?page=${page - 1}`}
                  className="underline hover:no-underline"
                >
                  Previous
                </Link>
              ) : null}
              <span className="tabular-nums text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={`/app/jobs/${number}/changes?page=${page + 1}`}
                  className="underline hover:no-underline"
                >
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null
        }
      >
        {visible.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No changes yet.
          </p>
        ) : (
          <ul className="divide-y px-4 text-sm" data-testid="job-changes-full">
            {visible.map((c) => (
              <li key={c.id} className="py-2">
                <span className="font-medium">{c.userName}</span> · {c.summary}{" "}
                <span className="text-xs text-muted-foreground">
                  <LocalTime iso={c.createdAt} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
