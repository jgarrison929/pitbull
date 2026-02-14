"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import type {
  Subcontract,
  ChangeOrder,
  PaymentApplication,
  PagedResult,
} from "@/lib/types";
import {
  subcontractStatusLabel,
  changeOrderStatusLabel,
  paymentApplicationStatusLabel,
} from "@/lib/contracts";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function ContractPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [subcontract, setSubcontract] = useState<Subcontract | null>(null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [payApps, setPayApps] = useState<PaymentApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [subRes, coRes, paRes] = await Promise.all([
          api<Subcontract>(`/api/subcontracts/${id}`),
          api<PagedResult<ChangeOrder>>(
            `/api/changeorders?subcontractId=${id}&pageSize=100`
          ),
          api<PagedResult<PaymentApplication>>(
            `/api/paymentapplications?subcontractId=${id}&pageSize=100`
          ),
        ]);
        setSubcontract(subRes);
        setChangeOrders(coRes.items);
        setPayApps(
          paRes.items.sort((a, b) => a.applicationNumber - b.applicationNumber)
        );
      } catch {
        setError("Failed to load contract data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          Loading payment application data...
        </p>
      </div>
    );
  }

  if (error || !subcontract) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          {error || "Subcontract not found"}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/contracts">Back to Contracts</Link>
        </Button>
      </div>
    );
  }

  // Calculations
  const latestPayApp =
    payApps.length > 0 ? payApps[payApps.length - 1] : null;
  const netChangeOrderAmount = changeOrders.reduce(
    (sum, co) => sum + co.amount,
    0
  );
  const balanceToFinish =
    subcontract.currentValue -
    (latestPayApp?.totalCompletedAndStored ?? 0);
  const percentComplete =
    subcontract.currentValue > 0 && latestPayApp
      ? (latestPayApp.totalCompletedAndStored / subcontract.currentValue) * 100
      : 0;

  return (
    <>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Action Bar - Hidden in print */}
        <div className="no-print flex items-center justify-between mb-6">
          <Breadcrumbs
            items={[
              { label: "Contracts", href: "/contracts" },
              {
                label: subcontract.subcontractorName,
                href: `/contracts/${id}`,
              },
              { label: "Payment Application" },
            ]}
          />
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print Application
          </Button>
        </div>

        {/* ============================================
            AIA G702 - APPLICATION AND CERTIFICATE
            FOR PAYMENT
            ============================================ */}
        <div className="print-section border rounded-lg p-6 bg-card">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold uppercase tracking-wide">
              Application and Certificate for Payment
            </h1>
            <p className="text-sm text-muted-foreground">
              AIA Document G702 Style — Payment Application
            </p>
          </div>

          {/* Top Info Grid */}
          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            {/* Left column */}
            <div className="space-y-3">
              <div>
                <span className="text-muted-foreground block text-xs uppercase">
                  To (Owner)
                </span>
                <span className="font-medium">
                  {subcontract.projectName || "Project Owner"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase">
                  From (Contractor)
                </span>
                <span className="font-medium">
                  {subcontract.subcontractorName}
                </span>
                {subcontract.subcontractorContact && (
                  <span className="block text-xs text-muted-foreground">
                    Attn: {subcontract.subcontractorContact}
                  </span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase">
                  Contract For
                </span>
                <span className="font-medium">
                  {subcontract.scopeOfWork
                    ? subcontract.scopeOfWork.slice(0, 100)
                    : subcontract.tradeCode || "—"}
                </span>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground block text-xs uppercase">
                    Application No.
                  </span>
                  <span className="font-bold text-lg">
                    {latestPayApp?.applicationNumber ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase">
                    Contract No.
                  </span>
                  <span className="font-mono">
                    {subcontract.subcontractNumber}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground block text-xs uppercase">
                    Period From
                  </span>
                  <span>
                    {latestPayApp
                      ? formatDate(latestPayApp.periodStart)
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase">
                    Period To
                  </span>
                  <span>
                    {latestPayApp
                      ? formatDate(latestPayApp.periodEnd)
                      : "—"}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase">
                  Contract Status
                </span>
                <span>{subcontractStatusLabel(subcontract.status)}</span>
              </div>
            </div>
          </div>

          {/* Contract Summary Table (G702 style) */}
          <div className="border rounded mb-6">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground w-8 text-center font-bold">
                    1
                  </td>
                  <td className="p-2">Original Contract Sum</td>
                  <td className="p-2 text-right font-mono font-medium w-48">
                    {formatCurrency(subcontract.originalValue)}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    2
                  </td>
                  <td className="p-2">Net Change by Change Orders</td>
                  <td className="p-2 text-right font-mono font-medium">
                    {formatCurrency(netChangeOrderAmount)}
                  </td>
                </tr>
                <tr className="border-b bg-muted/30">
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    3
                  </td>
                  <td className="p-2 font-semibold">
                    Contract Sum to Date (Line 1 + 2)
                  </td>
                  <td className="p-2 text-right font-mono font-bold">
                    {formatCurrency(subcontract.currentValue)}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    4
                  </td>
                  <td className="p-2">
                    Total Completed & Stored to Date
                  </td>
                  <td className="p-2 text-right font-mono font-medium">
                    {formatCurrency(
                      latestPayApp?.totalCompletedAndStored ?? 0
                    )}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    5
                  </td>
                  <td className="p-2">
                    Retainage ({formatPercent(subcontract.retainagePercent)})
                  </td>
                  <td className="p-2 text-right font-mono font-medium">
                    {formatCurrency(
                      latestPayApp?.totalRetainage ??
                        subcontract.retainageHeld
                    )}
                  </td>
                </tr>
                <tr className="border-b bg-muted/30">
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    6
                  </td>
                  <td className="p-2 font-semibold">
                    Total Earned Less Retainage (Line 4 − 5)
                  </td>
                  <td className="p-2 text-right font-mono font-bold">
                    {formatCurrency(
                      latestPayApp?.totalEarnedLessRetainage ??
                        subcontract.billedToDate - subcontract.retainageHeld
                    )}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    7
                  </td>
                  <td className="p-2">
                    Less Previous Certificates for Payment
                  </td>
                  <td className="p-2 text-right font-mono font-medium">
                    {formatCurrency(
                      latestPayApp?.lessPreviousCertificates ??
                        subcontract.paidToDate
                    )}
                  </td>
                </tr>
                <tr className="border-b bg-primary/5">
                  <td className="p-2 text-center font-bold">8</td>
                  <td className="p-2 font-bold text-lg">
                    Current Payment Due
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-lg">
                    {formatCurrency(
                      latestPayApp?.currentPaymentDue ?? 0
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    9
                  </td>
                  <td className="p-2">Balance to Finish (Line 3 − 4)</td>
                  <td className="p-2 text-right font-mono font-medium">
                    {formatCurrency(balanceToFinish)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Completion percentage bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">
                Percentage Complete
              </span>
              <span className="font-semibold">
                {formatPercent(percentComplete)}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all"
                style={{ width: `${Math.min(percentComplete, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ============================================
            G703 - CONTINUATION SHEET
            Schedule of Values / Payment Application History
            ============================================ */}
        {payApps.length > 0 && (
          <div className="print-section border rounded-lg p-6 bg-card print-break-before">
            <h2 className="text-lg font-semibold mb-1">
              Continuation Sheet — Payment Application History
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              AIA Document G703 Style — Schedule of Values
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="text-left text-muted-foreground border-b-2 text-xs uppercase">
                    <th className="pb-2 pr-2">App #</th>
                    <th className="pb-2 pr-2">Period</th>
                    <th className="pb-2 pr-2">Status</th>
                    <th className="pb-2 text-right pr-2">
                      Prev. Work
                    </th>
                    <th className="pb-2 text-right pr-2">
                      This Period
                    </th>
                    <th className="pb-2 text-right pr-2">
                      Stored Materials
                    </th>
                    <th className="pb-2 text-right pr-2">
                      Total Completed
                    </th>
                    <th className="pb-2 text-right pr-2">
                      Retainage
                    </th>
                    <th className="pb-2 text-right">Payment Due</th>
                  </tr>
                </thead>
                <tbody>
                  {payApps.map((pa) => (
                    <tr key={pa.id} className="border-b border-dashed">
                      <td className="py-2 pr-2 font-mono font-medium">
                        #{pa.applicationNumber}
                      </td>
                      <td className="py-2 pr-2 text-xs whitespace-nowrap">
                        {formatDate(pa.periodStart)} —{" "}
                        {formatDate(pa.periodEnd)}
                      </td>
                      <td className="py-2 pr-2 text-xs">
                        {paymentApplicationStatusLabel(pa.status)}
                      </td>
                      <td className="py-2 text-right pr-2 font-mono">
                        {formatCurrency(pa.workCompletedPrevious)}
                      </td>
                      <td className="py-2 text-right pr-2 font-mono font-medium">
                        {formatCurrency(pa.workCompletedThisPeriod)}
                      </td>
                      <td className="py-2 text-right pr-2 font-mono">
                        {formatCurrency(pa.storedMaterials)}
                      </td>
                      <td className="py-2 text-right pr-2 font-mono">
                        {formatCurrency(pa.totalCompletedAndStored)}
                      </td>
                      <td className="py-2 text-right pr-2 font-mono text-amber-600">
                        {formatCurrency(pa.totalRetainage)}
                      </td>
                      <td className="py-2 text-right font-mono font-semibold">
                        {formatCurrency(pa.currentPaymentDue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold bg-muted/50">
                    <td colSpan={4} className="py-2 pr-2 text-right">
                      Totals
                    </td>
                    <td className="py-2 text-right pr-2 font-mono">
                      {formatCurrency(
                        payApps.reduce(
                          (s, pa) => s + pa.workCompletedThisPeriod,
                          0
                        )
                      )}
                    </td>
                    <td className="py-2 text-right pr-2 font-mono">
                      {formatCurrency(
                        payApps.reduce(
                          (s, pa) => s + pa.storedMaterials,
                          0
                        )
                      )}
                    </td>
                    <td className="py-2 text-right pr-2 font-mono" />
                    <td className="py-2 text-right pr-2 font-mono text-amber-600">
                      {formatCurrency(
                        latestPayApp?.totalRetainage ?? 0
                      )}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {formatCurrency(
                        payApps.reduce(
                          (s, pa) => s + pa.currentPaymentDue,
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Change Orders Section */}
        {changeOrders.length > 0 && (
          <div className="print-section border rounded-lg p-6 bg-card print-break-avoid">
            <h2 className="text-lg font-semibold mb-4">
              Change Order Summary
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-muted-foreground border-b-2">
                  <th className="pb-2 pr-2">CO #</th>
                  <th className="pb-2 pr-2">Title</th>
                  <th className="pb-2 pr-2">Status</th>
                  <th className="pb-2 pr-2">Date</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {changeOrders.map((co) => (
                  <tr key={co.id} className="border-b border-dashed">
                    <td className="py-2 pr-2 font-mono text-xs">
                      {co.changeOrderNumber}
                    </td>
                    <td className="py-2 pr-2">{co.title}</td>
                    <td className="py-2 pr-2 text-xs">
                      {changeOrderStatusLabel(co.status)}
                    </td>
                    <td className="py-2 pr-2 text-xs">
                      {formatDate(co.approvedDate || co.submittedDate)}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {co.amount >= 0 ? "+" : ""}
                      {formatCurrency(co.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold bg-muted/50">
                  <td colSpan={4} className="py-2 pr-2 text-right">
                    Net Change
                  </td>
                  <td className="py-2 text-right font-mono">
                    {formatCurrency(netChangeOrderAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Signature Blocks */}
        <div className="print-section border rounded-lg p-6 bg-card print-break-avoid">
          <div className="grid grid-cols-2 gap-8">
            {/* Contractor Certification */}
            <div>
              <h3 className="text-sm font-semibold uppercase mb-4">
                Contractor&apos;s Certification
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                The undersigned Contractor certifies that to the best of the
                Contractor&apos;s knowledge, information and belief, the Work
                covered by this Application for Payment has been completed in
                accordance with the Contract Documents.
              </p>
              <div className="space-y-4">
                <div>
                  <div className="border-b border-black mb-1 h-8" />
                  <p className="text-xs text-muted-foreground">
                    Contractor: {subcontract.subcontractorName}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="border-b border-black mb-1 h-8" />
                    <p className="text-xs text-muted-foreground">
                      Signature
                    </p>
                  </div>
                  <div>
                    <div className="border-b border-black mb-1 h-8" />
                    <p className="text-xs text-muted-foreground">Date</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Owner Approval */}
            <div>
              <h3 className="text-sm font-semibold uppercase mb-4">
                Owner&apos;s Approval
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                In accordance with the Contract Documents, based on on-site
                observations and the data comprising the above application, the
                Owner certifies that to the best of the Owner&apos;s
                knowledge, the Work has progressed as indicated.
              </p>
              <div className="space-y-4">
                <div>
                  <div className="border-b border-black mb-1 h-8" />
                  <p className="text-xs text-muted-foreground">
                    Amount Certified:{" "}
                    {formatCurrency(
                      latestPayApp?.approvedAmount ??
                        latestPayApp?.currentPaymentDue ??
                        0
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="border-b border-black mb-1 h-8" />
                    <p className="text-xs text-muted-foreground">
                      Signature
                    </p>
                  </div>
                  <div>
                    <div className="border-b border-black mb-1 h-8" />
                    <p className="text-xs text-muted-foreground">Date</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          <p>
            Pitbull Construction ERP • Payment Application •{" "}
            {subcontract.subcontractorName} •{" "}
            {subcontract.subcontractNumber}
          </p>
          <p>Generated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </>
  );
}
