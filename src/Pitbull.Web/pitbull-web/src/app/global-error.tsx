"use client";

import { useEffect } from "react";

/**
 * Global error boundary for the root layout.
 * This catches errors that occur in the root layout itself.
 * Must include its own <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service in production
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md mx-auto text-center space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              </div>
            </div>

            {/* Message */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-neutral-900">
                Application Error
              </h1>
              <p className="text-neutral-500">
                A critical error occurred. Please refresh the page to continue.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white px-6 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
              >
                Refresh page
              </button>
            </div>

            {/* Branding */}
            <p className="text-xs text-neutral-400 pt-4">
              Pitbull Construction Solutions
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
