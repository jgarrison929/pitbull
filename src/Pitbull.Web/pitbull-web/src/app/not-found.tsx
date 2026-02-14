import Link from "next/link";

/**
 * Custom 404 page for unmatched routes.
 * Construction-themed with helpful navigation.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        {/* Construction-themed illustration */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              {/* Hard hat icon */}
              <svg
                className="w-24 h-24 text-amber-500"
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {/* Hard hat body */}
                <path
                  d="M25 70 C25 70 25 45 60 30 C95 45 95 70 95 70"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="currentColor"
                  fillOpacity="0.15"
                  strokeLinecap="round"
                />
                {/* Hard hat brim */}
                <path
                  d="M15 70 L105 70"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                {/* Hard hat ridge */}
                <path
                  d="M60 30 L60 70"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.5"
                />
                {/* Caution stripes */}
                <rect x="30" y="80" width="60" height="8" rx="2" fill="currentColor" fillOpacity="0.2" />
                <line x1="35" y1="88" x2="45" y2="80" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <line x1="50" y1="88" x2="60" y2="80" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <line x1="65" y1="88" x2="75" y2="80" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <line x1="80" y1="88" x2="90" y2="80" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              </svg>
              {/* Exclamation mark overlay */}
              <div className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white text-sm font-bold shadow-lg">
                !
              </div>
            </div>
          </div>

          <p className="text-6xl font-bold text-amber-500/80">404</p>
          <h1 className="text-2xl font-semibold text-foreground">
            Page Under Construction
          </h1>
          <p className="text-muted-foreground">
            Looks like this area hasn&apos;t been built yet, or the page you&apos;re looking for has been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-amber-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-background"
          >
            🏠 Go to Dashboard
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            🔍 Search
          </Link>
        </div>

        {/* Helpful links */}
        <div className="pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Quick links to get back on track:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link
              href="/projects"
              className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              📋 Projects
            </Link>
            <Link
              href="/bids"
              className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              📊 Bids
            </Link>
            <Link
              href="/time-tracking"
              className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              ⏱️ Time Tracking
            </Link>
            <Link
              href="/employees"
              className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              👷 Employees
            </Link>
            <Link
              href="/equipment"
              className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              🚜 Equipment
            </Link>
          </div>
        </div>

        {/* Branding */}
        <p className="text-xs text-muted-foreground/60 pt-4">
          Pitbull Construction Solutions
        </p>
      </div>
    </div>
  );
}
