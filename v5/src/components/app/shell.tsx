import Link from "next/link";
import { Suspense } from "react";
import {
  Activity,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { StatusPill } from "@/components/app/format";
import { LocalTime } from "@/components/app/local-time";
import { NavLink } from "@/components/app/nav-link";
import { ThemeSwitch } from "@/components/app/theme-switch";
import { idx } from "@/lib/ev";
import { cn } from "@/lib/utils";
import { getPortfolio } from "@/server/data";
import { requireUser } from "@/server/session";
import { getTheme } from "@/server/theme";
import { resetDemo, signOut } from "@/app/login/actions";

export const navItems = [
  { href: "/app", label: "Portfolio", icon: LayoutDashboard, exact: true },
  { href: "/app/assistant", label: "Assistant", icon: Sparkles },
  { href: "/status", label: "Status", icon: Activity },
  { href: "/changelog", label: "Changelog", icon: FileText },
];

const roleLabel = {
  executive: "Executive",
  pm: "Project manager",
  superintendent: "Superintendent",
  foreman: "Foreman",
} as const;

function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/app"
      aria-label="Pitbull home"
      className={cn(
        "grid size-8 place-items-center rounded-md bg-brand text-sm font-bold text-brand-foreground",
        className,
      )}
    >
      P
    </Link>
  );
}

/** The hybrid shell: icon rail, header, job strip, main content, and an optional assistant rail. */
export function AppShell({
  children,
  rail,
  nav = navItems,
}: {
  children: React.ReactNode;
  rail?: React.ReactNode;
  nav?: typeof navItems;
}) {
  return (
    <div className="flex min-h-svh w-full max-w-full overflow-x-hidden bg-background">
      <aside className="sticky top-0 hidden min-h-svh w-14 shrink-0 flex-col items-center gap-1 self-stretch bg-chrome py-3 md:flex">
        <Brand className="mb-3" />
        <nav aria-label="Main" className="flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon, exact }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              exact={exact}
              className="grid size-9 place-items-center rounded-md text-chrome-foreground hover:bg-chrome-hover hover:text-chrome-emphasis"
              activeClassName="bg-chrome-active text-chrome-emphasis"
            >
              <Icon className="size-4" />
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 max-w-full flex-1 flex-col">
        <header className="flex min-w-0 items-center gap-3 border-b px-4 py-2.5">
          <Brand className="md:hidden" />
          <Suspense
            fallback={
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            }
          >
            <CompanyBadge />
          </Suspense>
          <div className="ml-auto min-w-0 shrink-0">
            <Suspense
              fallback={
                <div className="h-8 w-28 animate-pulse rounded bg-muted" />
              }
            >
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <Suspense fallback={<div className="h-[53px] border-b" />}>
          <JobStrip />
        </Suspense>
        <div className="flex min-h-0 min-w-0 max-w-full flex-1">
          <main className="flex min-w-0 max-w-full flex-1 flex-col gap-5 px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:p-6">
            {children}
          </main>
        </div>
      </div>
      {rail}

      <nav
        aria-label="Main"
        data-testid="phone-tab-bar"
        className="fixed inset-x-0 bottom-0 z-40 flex max-w-full border-t bg-background md:hidden"
      >
        {nav.map(({ href, label, icon: Icon, exact }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            exact={exact}
            className="tap-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-label text-muted-foreground"
            activeClassName="text-brand"
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

async function CompanyBadge() {
  const user = await requireUser();
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="truncate font-medium">{user.companyName}</span>
      <span
        data-text="label"
        className="hidden rounded bg-brand/25 px-1.5 py-0.5 text-label font-medium sm:inline"
      >
        Demo sandbox
      </span>
    </div>
  );
}

async function UserMenu() {
  const user = await requireUser();
  const theme = await getTheme();
  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted [&::-webkit-details-marker]:hidden"
        data-testid="user-menu"
      >
        <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-medium">
          {user.name
            .split(" ")
            .map((p) => p[0])
            .join("")}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block font-medium" data-testid="signed-in-as">
            {user.name}
          </span>
          <span className="block text-xs text-muted-foreground">
            {roleLabel[user.role]}
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </summary>
      <div className="absolute right-0 z-50 mt-1 w-72 rounded-lg border bg-popover p-3 text-sm shadow-lg">
        <div className="font-medium sm:hidden">{user.name}</div>
        <div className="text-xs text-muted-foreground">{user.title}</div>
        <div className="mt-2 rounded-md bg-muted px-2 py-1.5 text-xs">
          Sandbox{" "}
          <span className="font-mono" data-testid="sandbox-id">
            {user.companyId.slice(0, 8)}
          </span>{" "}
          · seeded{" "}
          <LocalTime iso={user.seededAt.toISOString()} testId="seeded-at" />
        </div>
        <ThemeSwitch current={theme} />
        <div className="mt-3 flex flex-col gap-1">
          <Link href="/login" className="rounded-md px-2 py-1.5 hover:bg-muted">
            Switch role
          </Link>
          <form action={resetDemo}>
            <button
              type="submit"
              className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              Reset demo
            </button>
          </form>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}

async function JobStrip() {
  const user = await requireUser();
  const { jobs } = await getPortfolio(user.companyId);
  // Wrap + max-w-full (not overflow-x scroll): shrink-0 pills in a row were the
  // 422 px sideways spill at 390 — document grew and clipped SR-99 off the edge.
  // Spec 5.0.4-0: every visible job-strip child.right ≤ clientWidth.
  return (
    <nav
      aria-label="Jobs"
      data-testid="job-strip"
      className="flex min-w-0 max-w-full flex-wrap gap-2 border-b px-4 py-2"
    >
      {jobs.map((p) => (
        <NavLink
          key={p.job.id}
          href={`/app/jobs/${p.job.number}`}
          label={p.job.name}
          className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:border-foreground/30 sm:gap-3"
          activeClassName="border-foreground bg-muted/50 text-foreground"
        >
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="block truncate font-medium text-foreground">
              {p.job.shortName}{" "}
              <span className="font-normal text-muted-foreground">
                {p.job.number}
              </span>
            </span>
            <span
              className="block truncate tabular-nums"
              data-testid={
                p.estimateDraft ? "strip-estimate-draft" : undefined
              }
            >
              {p.estimateDraft
                ? "Estimate draft"
                : `CPI ${idx(p.cpi)} · SPI ${idx(p.spi)}`}
            </span>
          </span>
          {p.estimateDraft ? (
            <span
              className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              data-status="draft"
            >
              Draft
            </span>
          ) : (
            <StatusPill
              value={p.status!}
              varianceCents={p.costVarianceCents}
            />
          )}
        </NavLink>
      ))}
    </nav>
  );
}
