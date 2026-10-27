import type { Metadata } from "next";
import { next, nextLabel, shipped } from "@/content/roadmap";

export const metadata: Metadata = { title: "Roadmap · Pitbull" };

export default function RoadmapPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <div>
        <a
          href="/app"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to Pitbull
        </a>
        <h1 className="mt-2 text-xl font-semibold">Roadmap</h1>
        <p className="text-sm text-muted-foreground">
          What shipped and what comes next, in order. Dates appear only after a
          release passes the gate.
        </p>
        <p className="mt-2 text-sm">
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
        <h2 id="roadmap-shipped" className="text-sm font-semibold">
          Shipped
        </h2>
        <ol className="flex flex-col gap-4">
          {shipped.map((r) => (
            <li key={r.version} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <a
                  href={`/changelog#${r.version}`}
                  className="font-mono text-sm font-semibold underline hover:no-underline"
                >
                  {r.version}
                </a>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={r.date}
                >
                  {r.date}
                </time>
              </div>
              <p className="text-sm text-muted-foreground">{r.name}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="roadmap-next" className="flex flex-col gap-4">
        <h2 id="roadmap-next" className="text-sm font-semibold">
          Next
        </h2>
        <ol className="flex flex-col gap-3">
          {next.map((r) => {
            const label = nextLabel(r);
            const showDetail = label === r.version;
            return (
              <li key={r.version} className="flex flex-col gap-0.5">
                <span className="font-mono text-sm font-semibold">{label}</span>
                {showDetail ? (
                  <p className="text-sm text-muted-foreground">{r.name}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
