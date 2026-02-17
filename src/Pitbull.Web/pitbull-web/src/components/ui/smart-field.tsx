"use client";

import * as React from "react";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import type { AiSuggestResponse } from "@/lib/types";

interface SmartFieldProps {
  label: string;
  fieldName: string;
  entityType?: string;
  value: string;
  onChange: (value: string) => void;
  /** Additional context key-value pairs sent to the AI */
  context?: Record<string, string>;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  error?: string;
  helpText?: string;
  className?: string;
}

/**
 * SmartField is a textarea with an AI suggestion button.
 * When the sparkle icon is clicked, it calls the AI suggest endpoint
 * and shows the suggestion inline for the user to accept or dismiss.
 */
export function SmartField({
  label,
  fieldName,
  entityType,
  value,
  onChange,
  context,
  placeholder,
  rows = 3,
  required,
  error,
  helpText,
  className,
}: SmartFieldProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<string | null>(null);
  const id = React.useId();

  const handleSuggest = async () => {
    setIsLoading(true);
    setSuggestion(null);
    try {
      const result = await api<AiSuggestResponse>("/api/ai/suggest", {
        method: "POST",
        body: {
          fieldName,
          entityType,
          currentValue: value || undefined,
          context: context || undefined,
        },
      });
      setSuggestion(result.suggestion);
    } catch {
      setSuggestion(null);
    } finally {
      setIsLoading(false);
    }
  };

  const acceptSuggestion = () => {
    if (suggestion) {
      onChange(suggestion);
      setSuggestion(null);
    }
  };

  const dismissSuggestion = () => {
    setSuggestion(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSuggest}
          disabled={isLoading}
          className="h-7 gap-1.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          AI Suggest
        </Button>
      </div>

      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn(error && "border-destructive")}
      />

      {suggestion && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                AI Suggestion
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
                {suggestion}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={acceptSuggestion}
                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                title="Accept suggestion"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={dismissSuggestion}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {helpText && !error && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
