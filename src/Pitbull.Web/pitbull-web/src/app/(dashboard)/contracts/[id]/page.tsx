"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, Receipt, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import type { Subcontract, ChangeOrder, PaymentApplication, PagedResult } from "@/lib/types";
import {
  subcontractStatusBadgeClass,
  subcontractStatusLabel,
  changeOrderStatusBadgeClass,
  changeOrderStatusLabel,
  paymentApplicationStatusBadgeClass,
  paymentApplicationStatusLabel,
  formatCurrency,
  formatPercent,
} from "@/lib/contracts";
import { toast } from "sonner";

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString();
}

export default function SubcontractDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [subcontract, setSubcontract] = useState<Subcontract | null>(null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [payApps, setPayApps] = useState<PaymentApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [subRes, coRes, paRes] = await Promise.all([
          api<Subcontract>(`/api/subcontracts/${id}`),
          api<PagedResult<ChangeOrder>>(`/api/changeorders?subcontractId=${id}`),
          api<PagedResult<PaymentApplication>>(`/api/paymentapplications?subcontractId=${id}`),
        ]);
        setSubcontract(subRes);
        setChangeOrders(coRes.items);
        setPayApps(paRes.items);
      } catch {
        toast.error("Failed to load subcontract details");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (isLoading) {
    return <SubcontractDetailSkeleton />;
  }

  if (!subcontract) {
    return (
      <div className="space-y-6">
        <Link
          href="/contracts"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Contracts
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Subcontract not found</h2>
            <p className="text-muted-foreground">
              The subcontract you&apos;re looking for doesn&apos;t exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const billedPercent = subcontract.currentValue > 0 
    ? (subcontract.billedToDate / subcontract.currentValue) * 100 
    : 0;

  return (
    <div className="space-y-6">
      <Link
        href="/contracts"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Contracts
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {subcontract.subcontractorName}
            </h1>
            <Badge
              variant="secondary"
              className={subcontractStatusBadgeClass(subcontract.status)}
            >
              {subcontractStatusLabel(subcontract.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono">
            {subcontract.subcontractNumber}
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-[44px] shrink-0"
        >
          Edit Subcontract
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trade</span>
              <span className="font-medium">{subcontract.tradeCode || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original Value</span>
              <span className="font-mono">{formatCurrency(subcontract.originalValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Value</span>
              <span className="font-mono font-medium">{formatCurrency(subcontract.currentValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Billed to Date</span>
              <span className="font-mono">{formatCurrency(subcontract.billedToDate)} ({formatPercent(billedPercent)})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid to Date</span>
              <span className="font-mono">{formatCurrency(subcontract.paidToDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retainage Held</span>
              <span className="font-mono">{formatCurrency(subcontract.retainageHeld)} ({formatPercent(subcontract.retainagePercent)})</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subcontractor Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contact</span>
              <span className="font-medium">{subcontract.subcontractorContact || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{subcontract.subcontractorEmail || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{subcontract.subcontractorPhone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">License</span>
              <span className="font-mono text-xs">{subcontract.licenseNumber || "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Insurance</span>
              <span>
                {subcontract.insuranceCurrent ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700">Current</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 text-red-700">Expired</Badge>
                )}
                {subcontract.insuranceExpirationDate && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (exp. {formatDate(subcontract.insuranceExpirationDate)})
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scope of Work */}
      {subcontract.scopeOfWork && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope of Work</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {subcontract.scopeOfWork}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Change Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Change Orders
            </CardTitle>
            <CardDescription>
              {changeOrders.length} change order{changeOrders.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            + New CO
          </Button>
        </CardHeader>
        <CardContent>
          {changeOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No change orders yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changeOrders.map((co) => (
                  <TableRow key={co.id}>
                    <TableCell className="font-mono text-sm">
                      {co.changeOrderNumber}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {co.title}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {co.amount >= 0 ? "+" : ""}{formatCurrency(co.amount)}
                    </TableCell>
                    <TableCell>
                      {co.daysExtension ? `+${co.daysExtension}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={changeOrderStatusBadgeClass(co.status)}
                      >
                        {changeOrderStatusLabel(co.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Applications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Payment Applications
            </CardTitle>
            <CardDescription>
              {payApps.length} pay app{payApps.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            + New Pay App
          </Button>
        </CardHeader>
        <CardContent>
          {payApps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No payment applications yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Work This Period</TableHead>
                  <TableHead className="text-right">Payment Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payApps.map((pa) => (
                  <TableRow key={pa.id}>
                    <TableCell className="font-mono text-sm">
                      {pa.applicationNumber}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(pa.periodStart)} - {formatDate(pa.periodEnd)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(pa.workCompletedThisPeriod)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(pa.currentPaymentDue)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={paymentApplicationStatusBadgeClass(pa.status)}
                      >
                        {paymentApplicationStatusLabel(pa.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SubcontractDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-11 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
