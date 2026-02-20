import Link from "next/link";
import { HardHat } from "lucide-react";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-white dark:bg-neutral-950 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <Link href="/" className="flex items-center gap-2">
            <HardHat className="size-8 text-amber-500" />
            <span className="text-xl font-bold tracking-tight">
              Pitbull Construction Solutions
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-neutral-50 dark:bg-neutral-950 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Pitbull Construction Solutions. All
          rights reserved.
        </div>
      </footer>
    </div>
  );
}
