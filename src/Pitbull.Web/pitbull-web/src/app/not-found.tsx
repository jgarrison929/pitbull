import Link from "next/link";

/**
 * Custom 404 page for unmatched routes.
 * Provides helpful navigation back to the app.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        {/* 404 Display */}
        <div className="space-y-2">
          <p className="text-8xl font-bold text-muted-foreground/30">404</p>
          <h1 className="text-2xl font-semibold text-foreground">
            Page not found
          </h1>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            Go to dashboard
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            View projects
          </Link>
        </div>

        {/* Helpful links */}
        <div className="pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Here are some helpful links:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link
              href="/projects"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Projects
            </Link>
            <Link
              href="/bids"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Bids
            </Link>
            <Link
              href="/time-tracking"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Time Tracking
            </Link>
            <Link
              href="/employees"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Employees
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
