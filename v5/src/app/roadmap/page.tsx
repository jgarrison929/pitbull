import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page";
import { next, nextLabel, shipped } from "@/content/roadmap";

export const metadata: Metadata = { title: "Roadmap · Pitbull" };

export default function RoadmapPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <div>
        <a
          href="/app"
          className="inline-flex items-center text-body text-muted-foreground underline-offset-2 hover:underline max-[640px]:min-h-11 max-[640px]:min-w-11"
        >
          ← Back to Pitbull
        </a>
        <div className="mt-2">
          <PageHeader
            title="Roadmap"
            purpose="What shipped and what comes next, in order."
          />
        </div>
        <p className="mt-2 text-body text-muted-foreground">
          Dates appear only after a release passes the gate.
        </p>
        <p className="mt-2 text-body">
          <a href="/changelog" className="underline hover:no-underline">
            Changelog
          </a>
          {" · "}
          <a href="/status" className="underline hover:no-underline">
            Status
          </a>
        </p>
      </div>

      <section aria-labelledby="roadmap-shipped" className="flex flex-col gap-4">
        <h2 id="roadmap-shipped" className="text-section font-semibold">
          Shipped
        </h2>
        <ol className="flex flex-col gap-4">
          {shipped.map((r) => (
            <li key={r.version} className="flex flex-col gap-1 text-body">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <a
                  href={`/changelog#${r.version}`}
                  className="inline-flex items-center font-mono text-body font-semibold underline hover:no-underline max-[640px]:min-h-11 max-[640px]:min-w-11"
                >
                  {r.version}
                </a>
                <time
                  className="text-label text-muted-foreground"
                  data-text="label"
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
              <li key={r.version} className="flex flex-col gap-0.5 text-body">
                <span className="font-mono text-body font-semibold">{label}</span>
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
