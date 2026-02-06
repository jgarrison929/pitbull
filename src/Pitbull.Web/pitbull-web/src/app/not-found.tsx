import Link from "next/link";

/**
 * Custom 404 page for unmatched routes.
 * Provides helpful navigation back to the app.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        {/* 404 Display */}
        <div className="space-y-2">
          <p className="text-8xl font-bold text-neutral-200">404</p>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Page not found
          </h1>
          <p className="text-neutral-500">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
          >
            Go to dashboard
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
          >
            View projects
          </Link>
        </div>

        {/* Helpful links */}
        <div className="pt-6 border-t border-neutral-200">
          <p className="text-sm text-neutral-500 mb-3">
            Here are some helpful links:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link
              href="/projects"
              className="text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Projects
            </Link>
            <Link
              href="/bids"
              className="text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Bids
            </Link>
            <Link
              href="/time-tracking"
              className="text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Time Tracking
            </Link>
            <Link
              href="/employees"
              className="text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Employees
            </Link>
          </div>
        </div>

        {/* Branding */}
        <p className="text-xs text-neutral-400 pt-4">
          Pitbull Construction Solutions
        </p>
      </div>
    </div>
  );
}
