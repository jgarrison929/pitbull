"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Wallet, HandCoins, Landmark, Scale } from "lucide-react";
import api from "@/lib/api";
import type { PagedResult, Subcontract } from "@/lib/types";
import { SubcontractStatus } from "@/lib/types";
import {
  subcontractStatusBadgeClass,
  subcontractStatusLabel,
  formatCurrency,
} from "@/lib/contracts";

// "active" contracts = Executed or InProgress
const ACTIVE_STATUSES = new Set([
  SubcontractStatus.Executed,
  SubcontractStatus.InProgress,
]);
import { toast } from "sonner";
import { ChangeOrderDialog } from "@/components/contracts/change-order-dialog";
import { useCompany } from "@/contexts/company-context";

export default function ContractsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeCompany } = useCompany();
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Read status filter from URL (e.g. /contracts?status=active)
  const statusParam = searchParams.get("status");
  const filteredSubcontracts = useMemo(() => {
    if (!statusParam) return subcontracts;
    if (statusParam.toLowerCase() === "active") {
      return subcontracts.filter((s) => ACTIVE_STATUSES.has(s.status));
    }
    return subcontracts;
  }, [subcontracts, statusParam]);

  // Check for fromRfi query param to auto-open change order dialog
  const fromRfiId = searchParams.get("fromRfi");
  const rfiNumber = searchParams.get("rfiNumber");
  const rfiSubject = searchParams.get("rfiSubject");

  const [showChangeOrderDialog, setShowChangeOrderDialog] = useState(false);
  const [prefillDescription, setPrefillDescription] = useState<string | undefined>();

  // Open change order dialog if coming from RFI
  useEffect(() => {
    if (fromRfiId) {
      const description = rfiNumber && rfiSubject
        ? `Per RFI #${rfiNumber}: ${rfiSubject}`
        : rfiNumber
        ? `Per RFI #${rfiNumber}`
        : undefined;
      setPrefillDescription(description);
      setShowChangeOrderDialog(true);
    }
  }, [fromRfiId, rfiNumber, rfiSubject]);

  useEffect(() => {
    async function fetchSubcontracts() {
      setIsLoading(true);
      try {
        const result = await api<PagedResult<Subcontract>>(
          "/api/subcontracts?pageSize=50"
        );
        setSubcontracts(result.items);
      } catch {
        toast.error("Failed to load subcontracts");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSubcontracts();
    // Re-fetch when the active company changes
  }, [activeCompany?.id]);

  function handleDialogClose(open: boolean) {
    setShowChangeOrderDialog(open);
    if (!open && fromRfiId) {
      // Clear the query params when dialog closes
      router.replace("/contracts", { scroll: false });
    }
  }

  function handleChangeOrderCreated() {
    // Optionally refresh data or navigate somewhere
    // For now, just show the toast (already handled in dialog)
  }

  const displayedSubcontracts = filteredSubcontracts;
  const totalCommitted = displayedSubcontracts.reduce((sum, sub) => sum + sub.currentValue, 0);
  const totalPaidToDate = displayedSubcontracts.reduce((sum, sub) => sum + sub.paidToDate, 0);
  const totalRetentionHeld = displayedSubcontracts.reduce((sum, sub) => sum + sub.retainageHeld, 0);
  const totalRemaining = Math.max(0, totalCommitted - totalPaidToDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
          <p className="text-muted-foreground">
            Manage subcontracts, change orders, and payment applications
          </p>
        </div>
        <Button
          asChild
          className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0"
        >
          <Link href="/contracts/new">+ New Subcontract</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">
              {statusParam ? "Active Subcontracts" : "All Subcontracts"}
            </CardTitle>
            {statusParam && (
              <Badge variant="secondary" className="text-xs">
                Filtered: {statusParam}
                <Link href="/contracts" className="ml-1.5 hover:text-foreground">&times;</Link>
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Committed</CardTitle>
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalCommitted)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Paid To Date</CardTitle>
                <HandCoins className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalPaidToDate)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retention Held</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRetentionHeld)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Remaining</CardTitle>
                <Scale className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRemaining)}</div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <>
              <div className="sm:hidden">
                <CardListSkeleton rows={5} />
              </div>
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={[
                    "Number",
                    "Subcontractor",
                    "Trade",
                    "Value",
                    "Billed",
                    "Status",
                  ]}
                  rows={5}
                />
              </div>
            </>
          ) : displayedSubcontracts.length === 0 ? (
            statusParam ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  No subcontracts match the current filter.
                </p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/contracts">Clear filter</Link>
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No subcontracts yet"
                description="Create your first subcontract to start tracking vendors, change orders, and payment applications."
                actionLabel="+ Create Your First Subcontract"
                actionHref="/contracts/new"
              />
            )
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {displayedSubcontracts.map((sub) => (
                  <div
                    key={sub.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/contracts/${sub.id}`}
                          className="font-medium text-amber-700 hover:underline text-sm"
                        >
                          {sub.subcontractorName}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {sub.subcontractNumber}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${subcontractStatusBadgeClass(sub.status)} text-xs shrink-0`}
                      >
                        {subcontractStatusLabel(sub.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Trade
                        </span>
                        <p className="font-medium">{sub.tradeCode || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Contract Value
                        </span>
                        <p className="font-medium font-mono">
                          {formatCurrency(sub.currentValue)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Billed to Date
                        </span>
                        <p className="font-medium font-mono">
                          {formatCurrency(sub.billedToDate)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Retainage Held
                        </span>
                        <p className="font-medium font-mono">
                          {formatCurrency(sub.retainageHeld)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto"><Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Subcontractor</TableHead>
                      <TableHead>Trade</TableHead>
                      <TableHead className="text-right">Contract Value</TableHead>
                      <TableHead className="text-right">Billed</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedSubcontracts.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-mono text-sm">
                          {sub.subcontractNumber}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/contracts/${sub.id}`}
                            className="font-medium text-amber-700 hover:underline"
                          >
                            {sub.subcontractorName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sub.tradeCode || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(sub.currentValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(sub.billedToDate)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={subcontractStatusBadgeClass(sub.status)}
                          >
                            {subcontractStatusLabel(sub.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Change Order Dialog - opens when fromRfi param is present */}
      <ChangeOrderDialog
        open={showChangeOrderDialog}
        onOpenChange={handleDialogClose}
        originatingRfiId={fromRfiId || undefined}
        prefillDescription={prefillDescription}
        onCreated={handleChangeOrderCreated}
      />
    </div>
  );
}
