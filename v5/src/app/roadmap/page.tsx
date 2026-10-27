import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page";
import { next, nextLabel, shipped } from "@/content/roadmap";

export const metadata: Metadata = { title: "Roadmap · Pitbull" };

export default function RoadmapPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <div>
        <Link
          href="/app"
          className="tap-target inline-flex items-center text-body text-muted-foreground hover:underline"
        >
          ← Back to Pitbull
        </Link>
        <div className="mt-2">
          <PageHeader
            title="Roadmap"
            purpose="What shipped and what comes next, in order."
          />
        </div>
        <p className="mt-2 text-body">
          <Link
            href="/changelog"
            className="tap-target inline-flex items-center underline hover:no-underline"
          >
            Changelog
          </Link>
          {" · "}
          <Link
            href="/status"
            className="tap-target inline-flex items-center underline hover:no-underline"
          >
            Status
          </Link>
        </p>
      </div>

      <section aria-labelledby="roadmap-shipped" className="flex flex-col gap-4">
        <h2 id="roadmap-shipped" className="text-section font-semibold">
          Shipped
        </h2>
        <ol className="flex flex-col gap-4">
          {shipped.map((r) => (
            <li key={r.version} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Link
                  href={`/changelog#${r.version}`}
                  className="tap-target inline-flex items-center font-mono text-body font-semibold underline hover:no-underline"
                >
                  {r.version}
                </Link>
                <time
                  data-text="label"
                  className="text-label text-muted-foreground"
                  dateTime={r.date}
                >
                  {r.date}
                </time>
              </div>
              <p className="text-body text-muted-foreground">{r.name}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="roadmap-next" className="flex flex-col gap-4">
        <h2 id="roadmap-next" className="text-section font-semibold">
          Next
        </h2>
        <ol className="flex flex-col gap-3">
          {next.map((r) => {
            const label = nextLabel(r);
            const showDetail = label === r.version;
            return (
              <li key={r.version} className="flex flex-col gap-0.5">
                <span className="font-mono text-body font-semibold">
                  {label}
                </span>
                {showDetail ? (
                  <p className="text-body text-muted-foreground">{r.name}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
