import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page";
import { changelog } from "@/content/changelog";

export const metadata: Metadata = { title: "Changelog · Pitbull" };

export default function ChangelogPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <Link
          href="/app"
          className="tap-target inline-flex items-center text-body text-muted-foreground hover:underline"
        >
          ← Back to Pitbull
        </Link>
        <div className="mt-2">
          <PageHeader
            title="Changelog"
            purpose="What each release changed."
          />
        </div>
        <p className="mt-2 text-body">
          <Link
            href="/roadmap"
            className="tap-target inline-flex items-center underline hover:no-underline"
          >
            Roadmap
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
      <ol className="flex flex-col gap-6">
        {changelog.map((r) => (
          <li
            key={r.version}
            id={r.version}
            className="flex scroll-mt-6 flex-col gap-2"
          >
            <div className="flex items-baseline gap-2">
              <h2 className="font-mono text-section font-semibold">
                {r.version}
              </h2>
              <time
                data-text="label"
                className="text-label text-muted-foreground"
                dateTime={r.date}
              >
                {r.date}
              </time>
            </div>
            <ul className="list-disc pl-5 text-body">
              {r.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </main>
  );
}
