"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/**
 * Format a phone number string to (XXX) XXX-XXXX format
 */
function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");
  
  // Limit to 10 digits
  const limited = digits.slice(0, 10);
  
  // Format based on length
  if (limited.length === 0) return "";
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/**
 * Extract just the digits from a formatted phone number
 */
function extractDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Validate a phone number (must be 10 digits for US format)
 */
function isValidPhoneNumber(value: string): boolean {
  const digits = extractDigits(value);
  return digits.length === 0 || digits.length === 10;
}

interface PhoneInputProps extends Omit<React.ComponentProps<typeof Input>, "type" | "onChange" | "value"> {
  label?: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** If true, returns formatted value. If false, returns digits only. */
  returnFormatted?: boolean;
}

/**
 * PhoneInput provides automatic phone number formatting as you type.
 * Formats to (XXX) XXX-XXXX pattern (US format).
 */
function PhoneInput({
  label,
  error,
  helpText,
  required,
  value,
  onChange,
  returnFormatted = true,
  id,
  className,
  ...props
}: PhoneInputProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    onChange(returnFormatted ? formatted : extractDigits(formatted));
  };

  const displayValue = returnFormatted ? value : formatPhoneNumber(value);

  const content = (
    <Input
      id={inputId}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      className={cn(error && "border-destructive focus-visible:ring-destructive/50", className)}
      aria-invalid={!!error}
      aria-describedby={cn(error ? errorId : undefined, helpText ? helpId : undefined)}
      required={required}
      value={displayValue}
      onChange={handleChange}
      placeholder="(555) 123-4567"
      {...props}
    />
  );

  if (!label) {
    return (
      <>
        {content}
        {error && (
          <p id={errorId} className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        {required && <span className="sr-only">(required)</span>}
      </Label>
      {content}
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

export { PhoneInput, formatPhoneNumber, extractDigits, isValidPhoneNumber };
