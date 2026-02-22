"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusColor = "gray" | "blue" | "green" | "red" | "amber" | "purple" | "teal";

interface StatusConfig {
  label: string;
  color: StatusColor;
}

const colorClasses: Record<StatusColor, string> = {
  gray: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

// Centralized status → color mapping for all entity types
const statusMap: Record<string, Record<string, StatusConfig>> = {
  TimeEntry: {
    Draft: { label: "Draft", color: "gray" },
    Submitted: { label: "Submitted", color: "blue" },
    Approved: { label: "Approved", color: "green" },
    Rejected: { label: "Rejected", color: "red" },
    // Also support numeric keys (backend may send 0/1/2/3)
    "3": { label: "Draft", color: "gray" },
    "0": { label: "Submitted", color: "blue" },
    "1": { label: "Approved", color: "green" },
    "2": { label: "Rejected", color: "red" },
  },
  Submittal: {
    Draft: { label: "Draft", color: "gray" },
    Submitted: { label: "Submitted", color: "blue" },
    InReview: { label: "In Review", color: "amber" },
    Approved: { label: "Approved", color: "green" },
    ApprovedAsNoted: { label: "Approved as Noted", color: "teal" },
    ReviseAndResubmit: { label: "Revise & Resubmit", color: "purple" },
    Rejected: { label: "Rejected", color: "red" },
    Closed: { label: "Closed", color: "gray" },
    "0": { label: "Draft", color: "gray" },
    "1": { label: "Submitted", color: "blue" },
    "2": { label: "In Review", color: "amber" },
    "3": { label: "Approved", color: "green" },
    "4": { label: "Approved as Noted", color: "teal" },
    "5": { label: "Revise & Resubmit", color: "purple" },
    "6": { label: "Rejected", color: "red" },
    "7": { label: "Closed", color: "gray" },
  },
  RFI: {
    Open: { label: "Open", color: "blue" },
    Answered: { label: "Answered", color: "green" },
    Closed: { label: "Closed", color: "gray" },
    "0": { label: "Open", color: "blue" },
    "1": { label: "Answered", color: "green" },
    "2": { label: "Closed", color: "gray" },
  },
  ChangeOrder: {
    Pending: { label: "Pending", color: "amber" },
    UnderReview: { label: "Under Review", color: "blue" },
    Approved: { label: "Approved", color: "green" },
    Rejected: { label: "Rejected", color: "red" },
    Withdrawn: { label: "Withdrawn", color: "gray" },
    Void: { label: "Void", color: "gray" },
    "0": { label: "Pending", color: "amber" },
    "1": { label: "Under Review", color: "blue" },
    "2": { label: "Approved", color: "green" },
    "3": { label: "Rejected", color: "red" },
    "4": { label: "Withdrawn", color: "gray" },
    "5": { label: "Void", color: "gray" },
  },
  PaymentApplication: {
    Draft: { label: "Draft", color: "gray" },
    Submitted: { label: "Submitted", color: "blue" },
    Reviewed: { label: "Reviewed", color: "amber" },
    Approved: { label: "Approved", color: "green" },
    Paid: { label: "Paid", color: "teal" },
    Rejected: { label: "Rejected", color: "red" },
    Void: { label: "Void", color: "gray" },
    "0": { label: "Draft", color: "gray" },
    "1": { label: "Submitted", color: "blue" },
    "2": { label: "Reviewed", color: "amber" },
    "3": { label: "Approved", color: "green" },
    "4": { label: "Paid", color: "teal" },
    "5": { label: "Rejected", color: "red" },
    "6": { label: "Void", color: "gray" },
  },
  VendorInvoice: {
    Pending: { label: "Pending", color: "amber" },
    Matched: { label: "Matched", color: "blue" },
    PartiallyMatched: { label: "Partially Matched", color: "purple" },
    Approved: { label: "Approved", color: "green" },
    Paid: { label: "Paid", color: "teal" },
    "1": { label: "Pending", color: "amber" },
    "2": { label: "Matched", color: "blue" },
    "3": { label: "Partially Matched", color: "purple" },
    "4": { label: "Approved", color: "green" },
    "5": { label: "Paid", color: "teal" },
  },
};

export interface StatusBadgeProps {
  entityType: string;
  status: string | number;
  className?: string;
}

export function StatusBadge({ entityType, status, className }: StatusBadgeProps) {
  const statusKey = String(status);
  const config = statusMap[entityType]?.[statusKey];

  const label = config?.label ?? statusKey;
  const colorClass = config ? colorClasses[config.color] : colorClasses.gray;

  return (
    <Badge variant="secondary" className={cn(colorClass, className)}>
      {label}
    </Badge>
  );
}

// Helper to get just the label for a status (useful when you need the text without the badge)
export function getStatusLabel(entityType: string, status: string | number): string {
  const config = statusMap[entityType]?.[String(status)];
  return config?.label ?? String(status);
}

// Helper to get just the color class for a status (backwards compat with existing patterns)
export function getStatusColorClass(entityType: string, status: string | number): string {
  const config = statusMap[entityType]?.[String(status)];
  return config ? colorClasses[config.color] : colorClasses.gray;
}
