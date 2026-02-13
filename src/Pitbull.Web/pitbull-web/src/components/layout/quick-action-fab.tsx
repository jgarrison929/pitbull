"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const quickActions = [
  { label: "Add Bid", href: "/bids/new", icon: "📋" },
  { label: "Add RFI", href: "/rfis/new", icon: "❓" },
  { label: "Add Time Entry", href: "/time-tracking/new", icon: "⏱️" },
];

export function QuickActionFAB() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 md:hidden">
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Quick action menu */}
      <div
        className={cn(
          "absolute bottom-16 right-0 flex flex-col gap-2 transition-all duration-200",
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 rounded-full bg-neutral-800 px-4 py-3 text-white shadow-lg hover:bg-neutral-700 transition-colors whitespace-nowrap"
          >
            <span className="text-lg">{action.icon}</span>
            <span className="text-sm font-medium">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition-all duration-200 hover:bg-amber-600 active:scale-95",
          isOpen && "rotate-45 bg-neutral-700 hover:bg-neutral-600"
        )}
        aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
        aria-expanded={isOpen}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
