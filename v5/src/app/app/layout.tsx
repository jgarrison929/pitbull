import type { Metadata } from "next";
import { Suspense } from "react";
import { Assistant } from "@/components/app/assistant";
import { AppShell } from "@/components/app/shell";

export const metadata: Metadata = { title: "Pitbull" };

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <AppShell
      rail={
        <aside className="sticky top-0 hidden h-svh w-[22rem] shrink-0 flex-col border-l bg-card lg:flex">
          <Suspense
            fallback={
              <div className="m-4 h-40 animate-pulse rounded-lg bg-muted" />
            }
          >
            <Assistant variant="rail" />
          </Suspense>
        </aside>
      }
    >
      {children}
    </AppShell>
  );
}
