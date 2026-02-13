"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  Calendar,
} from "lucide-react";
import api from "@/lib/api";
import type { RfiCostImpact } from "@/lib/types";

interface RfiCostImpactSectionProps {
  projectId: string;
  rfiId: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function changeOrderStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
      return "bg-green-100 text-green-700";
    case "pending":
    case "underreview":
      return "bg-amber-100 text-amber-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    default:
      return "bg-neutral-100 text-neutral-600";
  }
}

export function RfiCostImpactSection({
  projectId,
  rfiId,
}: RfiCostImpactSectionProps) {
  const [costImpact, setCostImpact] = useState<RfiCostImpact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCostImpact() {
      try {
        const data = await api<RfiCostImpact>(
          `/api/projects/${projectId}/rfis/${rfiId}/cost-impact`
        );
        setCostImpact(data);
      } catch (err) {
        setError("Failed to load cost impact data");
        console.error("RFI cost impact fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCostImpact();
  }, [projectId, rfiId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Cost Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!costImpact) {
    return null;
  }

  const hasCosts = costImpact.totalCost > 0;
  const hasChangeOrders = costImpact.changeOrders.length > 0;
  const hasTimeline = costImpact.timeline.length > 0;

  return (
    <div className="space-y-4">
      {/* Cost Summary Cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Cost Impact Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {/* Direct Cost */}
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">
                Direct Cost
              </div>
              <div className="text-2xl font-bold text-amber-600">
                {formatCurrency(costImpact.directCost)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                From change orders
              </div>
            </div>

            {/* Delay Cost */}
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">
                Delay Cost
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(costImpact.delayCost)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Standby & acceleration
              </div>
            </div>

            {/* Total Impact */}
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">
                Total Impact
              </div>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(costImpact.totalCost)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Combined cost
              </div>
            </div>
          </div>

          {/* Days Info */}
          <div className="flex items-center justify-center gap-6 pt-3 border-t text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Days to Resolve:</span>
              <span className="font-semibold">{costImpact.daysOpen}</span>
            </div>
            {costImpact.responseDelayDays != null &&
              costImpact.responseDelayDays > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-600 font-medium">
                    {costImpact.responseDelayDays} days overdue
                  </span>
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Linked Change Orders */}
      {hasChangeOrders && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Linked Change Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costImpact.changeOrders.map((co) => (
                  <TableRow key={co.id}>
                    <TableCell>
                      <Link
                        href={`/contracts?changeOrder=${co.id}`}
                        className="font-medium text-amber-600 hover:underline"
                      >
                        {co.number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(co.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={changeOrderStatusBadge(co.status)}
                      >
                        {co.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {hasTimeline && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-6 space-y-4">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

              {costImpact.timeline.map((event, idx) => {
                const isLate = event.daysLate != null && event.daysLate > 0;
                const isOverdue =
                  event.event.toLowerCase().includes("due") &&
                  event.event.toLowerCase().includes("missed");

                return (
                  <div key={idx} className="relative flex items-start gap-3">
                    {/* Circle marker */}
                    <div
                      className={`absolute -left-6 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                        isOverdue
                          ? "border-amber-500 bg-amber-50"
                          : "border-primary bg-background"
                      }`}
                    >
                      {isOverdue ? (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-muted-foreground">
                          {formatDate(event.date)}
                        </span>
                        {event.coNumber && (
                          <Badge variant="outline" className="text-xs">
                            {event.coNumber}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mt-0.5">
                        {event.event}
                        {event.actor && (
                          <span className="text-muted-foreground">
                            {" "}
                            by {event.actor}
                          </span>
                        )}
                        {isLate && (
                          <span className="text-amber-600 font-medium ml-2">
                            (+{event.daysLate} days late)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No cost impact message */}
      {!hasCosts && !hasChangeOrders && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No cost impact recorded for this RFI
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
