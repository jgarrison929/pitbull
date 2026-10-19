import type { Metadata } from "next";
import Link from "next/link";
import { changelog } from "@/content/changelog";

export const metadata: Metadata = { title: "Changelog · Pitbull" };

export default function ChangelogPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <Link
          href="/app"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to Pitbull
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Changelog</h1>
        <p className="text-sm text-muted-foreground">
          What shipped, newest first. Each release passed CI and the staging
          verify run.
        </p>
      </div>
      <ol className="flex flex-col gap-6">
        {changelog.map((r) => (
          <li key={r.version} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <h2 className="font-mono text-sm font-semibold">{r.version}</h2>
              <time className="text-xs text-muted-foreground" dateTime={r.date}>
                {r.date}
              </time>
            </div>
            <ul className="list-disc pl-5 text-sm">
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
