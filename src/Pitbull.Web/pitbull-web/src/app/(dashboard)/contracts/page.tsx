"use client";

import { useEffect, useState } from "react";
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
import { FileText } from "lucide-react";
import api from "@/lib/api";
import type { PagedResult, Subcontract } from "@/lib/types";
import {
  subcontractStatusBadgeClass,
  subcontractStatusLabel,
  formatCurrency,
} from "@/lib/contracts";
import { toast } from "sonner";

export default function ContractsPage() {
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSubcontracts() {
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
  }, []);

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
          <CardTitle className="text-lg">All Subcontracts</CardTitle>
        </CardHeader>
        <CardContent>
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
          ) : subcontracts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No subcontracts yet"
              description="Create your first subcontract to start tracking vendors, change orders, and payment applications."
              actionLabel="+ Create Your First Subcontract"
              actionHref="/contracts/new"
            />
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {subcontracts.map((sub) => (
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
                <Table>
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
                    {subcontracts.map((sub) => (
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
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
