"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface FormFieldProps extends React.ComponentProps<typeof Input> {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
}

/**
 * FormField combines a label, input, error message, and help text
 * with consistent styling and accessibility features.
 */
function FormField({
  label,
  error,
  helpText,
  required,
  id,
  className,
  ...props
}: FormFieldProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        {required && <span className="sr-only">(required)</span>}
      </Label>
      <Input
        id={inputId}
        className={cn(error && "border-destructive focus-visible:ring-destructive/50", className)}
        aria-invalid={!!error}
        aria-describedby={cn(error ? errorId : undefined, helpText ? helpId : undefined)}
        required={required}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {helpText && !error && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {helpText}
        </p>
      )}
    </div>
  );
}

export { FormField };
