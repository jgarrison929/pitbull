"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Collapsible form section with smooth animation.
 * Used for accordion-style multi-section forms.
 */
export function FormSection({
  title,
  description,
  icon,
  defaultOpen = true,
  badge,
  children,
  className,
}: FormSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50",
            isOpen && "rounded-b-none border-b-0"
          )}
        >
          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {icon}
              </span>
            )}
            <div>
              <h3 className="text-sm font-semibold">{title}</h3>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            {badge}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className={cn(
            "rounded-b-lg border border-t-0 bg-card px-4 pb-4 pt-3",
            "animate-in fade-in-0 slide-in-from-top-1 duration-200"
          )}
        >
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
