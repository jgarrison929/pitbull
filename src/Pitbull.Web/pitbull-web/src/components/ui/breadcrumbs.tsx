"use client";

import Link from "next/link";
import { ChevronRight, Home, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  /** Max items to show on mobile before collapsing middle items. Default: 2 */
  mobileMaxItems?: number;
}

export function Breadcrumbs({ items, className, mobileMaxItems = 2 }: BreadcrumbsProps) {
  const [expanded, setExpanded] = useState(false);

  // On mobile, collapse middle items if there are more than mobileMaxItems
  const shouldCollapse = items.length > mobileMaxItems && !expanded;

  // When collapsed on mobile: show first item + last item with "..." in between
  const mobileItems = shouldCollapse
    ? [
        items[0]!,
        { label: "...", href: undefined } as BreadcrumbItem,
        items[items.length - 1]!,
      ]
    : items;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center text-sm text-muted-foreground", className)}
    >
      {/* Desktop: show all items */}
      <ol className="hidden sm:flex items-center gap-1 flex-wrap">
        <li className="flex items-center">
          <Link
            href="/"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center">
              <ChevronRight className="h-4 w-4 mx-1 flex-shrink-0" />
              {isLast || !item.href ? (
                <span
                  className={cn(
                    "max-w-[200px] truncate",
                    isLast && "text-foreground font-medium"
                  )}
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors max-w-[200px] truncate"
                  title={item.label}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile: collapsed breadcrumbs */}
      <ol className="flex sm:hidden items-center gap-1 flex-wrap">
        <li className="flex items-center">
          <Link
            href="/"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </Link>
        </li>
        {mobileItems.map((item, index) => {
          const isLast = index === mobileItems.length - 1;
          const isEllipsis = item.label === "...";

          return (
            <li key={index} className="flex items-center">
              <ChevronRight className="h-4 w-4 mx-1 flex-shrink-0" />
              {isEllipsis ? (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="flex items-center justify-center h-5 w-5 rounded hover:bg-accent transition-colors"
                  aria-label="Show full breadcrumb path"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              ) : isLast || !item.href ? (
                <span
                  className={cn(
                    "max-w-[150px] truncate",
                    isLast && "text-foreground font-medium"
                  )}
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors max-w-[150px] truncate"
                  title={item.label}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
