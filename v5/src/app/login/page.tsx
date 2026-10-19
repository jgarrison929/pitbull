import type { Metadata } from "next";
import {
  ArrowRight,
  ClipboardList,
  HardHat,
  LineChart,
  Briefcase,
} from "lucide-react";
import { seedUsers, SEED_COMPANY_NAME } from "@/seed";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Sign in · Pitbull demo" };

const roleCopy = {
  executive: {
    icon: LineChart,
    sees: "Portfolio health, cost and schedule indices across every job.",
  },
  pm: {
    icon: Briefcase,
    sees: "Budget vs earned value by cost code, and where the money is going.",
  },
  superintendent: {
    icon: ClipboardList,
    sees: "Tomorrow's crew plans, checked against budgeted unit rates.",
  },
  foreman: {
    icon: HardHat,
    sees: "Plan the day by talking to the assistant. Built for a phone.",
  },
} as const;

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            P
          </div>
          <span className="font-semibold">Pitbull</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Explore the demo as one of four roles
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          You get a private sandbox of {SEED_COMPANY_NAME}, a fictional
          heavy-civil contractor with three live jobs. Change anything. Reset
          puts it back in seconds, and it expires after 24 hours.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Demo roles">
        {seedUsers.map((u) => {
          const { icon: Icon, sees } = roleCopy[u.role];
          return (
            <li key={u.role}>
              <form action={signIn}>
                <input type="hidden" name="role" value={u.role} />
                <button
                  type="submit"
                  data-testid={`role-${u.role}`}
                  className="group flex h-full w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:outline-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-muted">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{u.title.split(",")[0]}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.name}
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="text-sm text-muted-foreground">{sees}</p>
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Demo data. Fictional company, people and jobs. No password needed.
      </p>
    </main>
  );
}
