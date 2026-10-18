import Link from "next/link";
import { cn } from "@/lib/utils";
import { DEMO_LABEL } from "./scenario";

export const shells = [
  {
    slug: "screen",
    letter: "A",
    name: "Screen-first",
    blurb: "Dense enterprise tables and dashboards",
  },
  {
    slug: "agent",
    letter: "B",
    name: "Agent-first",
    blurb: "Typed or spoken requests, screens confirm",
  },
  {
    slug: "hybrid",
    letter: "C",
    name: "Hybrid",
    blurb: "Screens lead, the assistant drafts alongside",
  },
] as const;
export type ShellSlug = (typeof shells)[number]["slug"];

/** Prototype chrome. Not part of any shell; it lets Joshua flip between them. */
export function Switcher({ active }: { active: ShellSlug }) {
  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300">
      <span className="hidden font-medium text-slate-100 sm:inline">
        M1 prototype
      </span>
      <nav
        aria-label="Prototype shells"
        className="flex gap-1"
        data-testid="shell-switcher"
      >
        {shells.map((s) => (
          <Link
            key={s.slug}
            href={`/prototypes/${s.slug}`}
            aria-current={s.slug === active ? "page" : undefined}
            className={cn(
              "rounded px-2 py-1 transition-colors",
              s.slug === active
                ? "bg-slate-100 font-medium text-slate-950"
                : "hover:bg-slate-800 hover:text-white",
            )}
          >
            {s.letter}
            <span className="hidden sm:inline"> · {s.name}</span>
          </Link>
        ))}
      </nav>
      <span
        className="ml-auto rounded bg-amber-400 px-1.5 py-0.5 font-medium text-amber-950"
        data-testid="demo-label"
      >
        Demo data
        <span className="hidden sm:inline">
          {DEMO_LABEL.replace("Demo data", "")}
        </span>
      </span>
    </div>
  );
}
