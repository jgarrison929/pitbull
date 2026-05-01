"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import posthog from "posthog-js";
import { reportError } from "@/lib/error-reporter";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Optional label for what this boundary wraps, shown in error message */
  label?: string;
  /** Alias for label */
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const displayLabel = this.props.label || this.props.section;
    console.error(`ErrorBoundary${displayLabel ? ` [${displayLabel}]` : ""}:`, error, errorInfo);

    // Report to backend DB
    reportError({
      source: "frontend",
      level: "error",
      message: error.message,
      stackTrace: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      metadata: JSON.stringify({ label: displayLabel }),
    });

    // Report to PostHog Error Tracking
    if (posthog.__loaded) {
      posthog.capture("$exception", {
        $exception_message: error.message,
        $exception_type: "ReactError",
        $exception_stack_trace_raw: error.stack,
        $exception_source: "react_error_boundary",
        $exception_component_stack: errorInfo.componentStack,
        label: displayLabel,
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed border-muted-foreground/25 rounded-lg bg-muted/10">
          <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {(this.props.label || this.props.section)
              ? `Something went wrong loading ${this.props.label || this.props.section}`
              : "Something went wrong"}
          </p>
          <p className="text-xs text-muted-foreground/75 mb-4 max-w-sm">
            {process.env.NODE_ENV === "development"
              ? (this.state.error?.message || "An unexpected error occurred")
              : "An unexpected error occurred"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
