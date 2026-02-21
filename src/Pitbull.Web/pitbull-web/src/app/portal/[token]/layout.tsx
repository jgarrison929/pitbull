"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { HardHat } from "lucide-react";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ token: string }>();
  const token = params.token;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-white dark:bg-neutral-950 sticky top-0 z-50">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-2">
            <HardHat className="size-7 text-amber-500" />
            <div>
              <span className="text-lg font-bold tracking-tight">
                Pitbull
              </span>
              <span className="text-xs text-muted-foreground block -mt-0.5">
                Vendor Portal
              </span>
            </div>
          </div>
          <nav className="flex items-center gap-1 sm:gap-4">
            <Link
              href={`/portal/${token}`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md min-h-[44px] flex items-center"
            >
              Home
            </Link>
            <Link
              href={`/portal/${token}/lien-waivers`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md min-h-[44px] flex items-center"
            >
              Lien Waivers
            </Link>
            <Link
              href={`/portal/${token}/payments`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md min-h-[44px] flex items-center"
            >
              Payments
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-6">
        {children}
      </main>

      <footer className="border-t bg-neutral-50 dark:bg-neutral-950 py-6">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center text-xs text-muted-foreground">
          Powered by Pitbull Construction Solutions
        </div>
      </footer>
    </div>
  );
}
