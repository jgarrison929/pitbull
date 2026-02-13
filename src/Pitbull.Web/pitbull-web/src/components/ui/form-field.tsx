"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface FormFieldProps extends React.ComponentProps<typeof Input> {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  /** Maximum character count (displays counter when set) */
  maxLength?: number;
  /** Current value for character counting (use with controlled inputs) */
  value?: string;
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
  maxLength,
  value,
  id,
  className,
  onChange,
  ...props
}: FormFieldProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;
  
  // Track character count for uncontrolled inputs
  const [charCount, setCharCount] = React.useState(0);
  const displayCount = value !== undefined ? value.length : charCount;
  const isOverLimit = maxLength ? displayCount > maxLength : false;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (value === undefined) {
      setCharCount(e.target.value.length);
    }
    onChange?.(e);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId}>
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
          {required && <span className="sr-only">(required)</span>}
        </Label>
        {maxLength && (
          <span 
            className={cn(
              "text-xs",
              isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
            )}
            aria-live="polite"
          >
            {displayCount}/{maxLength}
          </span>
        )}
      </div>
      <Input
        id={inputId}
        className={cn(
          (error || isOverLimit) && "border-destructive focus-visible:ring-destructive/50", 
          className
        )}
        aria-invalid={!!error || isOverLimit}
        aria-describedby={cn(error ? errorId : undefined, helpText ? helpId : undefined)}
        required={required}
        maxLength={maxLength}
        value={value}
        onChange={handleChange}
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

interface TextareaFieldProps extends React.ComponentProps<typeof Textarea> {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  /** Maximum character count (displays counter when set) */
  maxLength?: number;
  /** Current value for character counting (use with controlled inputs) */
  value?: string;
}

/**
 * TextareaField combines a label, textarea, error message, and help text
 * with consistent styling and accessibility features.
 */
function TextareaField({
  label,
  error,
  helpText,
  required,
  maxLength,
  value,
  id,
  className,
  onChange,
  ...props
}: TextareaFieldProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;
  
  // Track character count for uncontrolled inputs
  const [charCount, setCharCount] = React.useState(0);
  const displayCount = value !== undefined ? value.length : charCount;
  const isOverLimit = maxLength ? displayCount > maxLength : false;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (value === undefined) {
      setCharCount(e.target.value.length);
    }
    onChange?.(e);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId}>
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
          {required && <span className="sr-only">(required)</span>}
        </Label>
        {maxLength && (
          <span 
            className={cn(
              "text-xs",
              isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
            )}
            aria-live="polite"
          >
            {displayCount}/{maxLength}
          </span>
        )}
      </div>
      <Textarea
        id={inputId}
        className={cn(
          (error || isOverLimit) && "border-destructive focus-visible:ring-destructive/50", 
          className
        )}
        aria-invalid={!!error || isOverLimit}
        aria-describedby={cn(error ? errorId : undefined, helpText ? helpId : undefined)}
        required={required}
        maxLength={maxLength}
        value={value}
        onChange={handleChange}
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

export { FormField, TextareaField };
