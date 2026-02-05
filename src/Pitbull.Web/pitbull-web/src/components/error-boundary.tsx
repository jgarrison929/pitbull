"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI. Receives error and reset function. */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  /** Called when an error is caught. Use for logging/reporting. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Section name for debugging (e.g. "Projects", "Dashboard") */
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reusable React error boundary.
 * Catches rendering errors in child components and shows a fallback UI
 * instead of a white screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, section } = this.props;

    // Log to console for debugging
    console.error(
      `[ErrorBoundary${section ? `: ${section}` : ""}] Caught error:`,
      error,
      errorInfo
    );

    if (onError) {
      onError(error, errorInfo);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.reset,
        });
      }

      return <ErrorFallback error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI.
 * Mobile responsive, user-friendly, with retry option.
 */
function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[200px] w-full p-4">
      <div className="w-full max-w-md mx-auto text-center space-y-4">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-600"
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
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-neutral-900">
            Something went wrong
          </h3>
          <p className="text-sm text-neutral-500">
            An unexpected error occurred. You can try again or go back to the
            dashboard.
          </p>
        </div>

        {/* Error details (collapsible for debugging) */}
        <details className="text-left">
          <summary className="text-xs text-neutral-400 cursor-pointer hover:text-neutral-600">
            Error details
          </summary>
          <pre className="mt-2 p-3 bg-neutral-100 rounded-md text-xs text-neutral-600 overflow-auto max-h-32 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
        </details>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Full-page error fallback for the root layout boundary.
 * Covers the entire viewport.
 */
export function PageErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
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
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-neutral-900">
            Something went wrong
          </h2>
          <p className="text-sm text-neutral-500">
            The application encountered an unexpected error. Please try
            refreshing the page.
          </p>
        </div>

        {/* Error details */}
        <details className="text-left">
          <summary className="text-xs text-neutral-400 cursor-pointer hover:text-neutral-600">
            Error details
          </summary>
          <pre className="mt-2 p-3 bg-neutral-100 rounded-md text-xs text-neutral-600 overflow-auto max-h-32 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
        </details>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
          >
            Refresh page
          </button>
        </div>
      </div>
    </div>
  );
}
