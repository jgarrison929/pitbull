"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import type { PaymentApplicationDetail } from "@/lib/types";
import { paymentApplicationStatusLabel } from "@/lib/contracts";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function PaymentApplicationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [detail, setDetail] = useState<PaymentApplicationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await api<PaymentApplicationDetail>(
          `/api/paymentapplications/${id}/detail`
        );
        setDetail(data);
      } catch {
        setError("Failed to load payment application");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Loading payment application...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          {error || "Payment application not found"}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/payment-applications">Back to List</Link>
        </Button>
      </div>
    );
  }

  const g702 = detail.g702;
  const lineItems = detail.g703LineItems;

  const g703Totals = {
    scheduledValue: lineItems.reduce((s, li) => s + li.scheduledValue, 0),
    workPrevious: lineItems.reduce(
      (s, li) => s + li.workCompletedPrevious,
      0
    ),
    workThisPeriod: lineItems.reduce(
      (s, li) => s + li.workCompletedThisPeriod,
      0
    ),
    matPrevious: lineItems.reduce(
      (s, li) => s + li.materialsStoredPrevious,
      0
    ),
    matThisPeriod: lineItems.reduce(
      (s, li) => s + li.materialsStoredThisPeriod,
      0
    ),
    totalCompleted: lineItems.reduce(
      (s, li) => s + li.totalCompletedAndStoredToDate,
      0
    ),
    balanceToFinish: lineItems.reduce((s, li) => s + li.balanceToFinish, 0),
    retainage: lineItems.reduce((s, li) => s + li.retainageAmount, 0),
  };

  const overallPercent =
    g703Totals.scheduledValue > 0
      ? (g703Totals.totalCompleted / g703Totals.scheduledValue) * 100
      : 0;

  return (
    <>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Action Bar - Hidden in print */}
        <div className="no-print flex items-center justify-between mb-6">
          <Breadcrumbs
            items={[
              { label: "Payment Applications", href: "/payment-applications" },
              {
                label: `App #${detail.applicationNumber}`,
                href: `/payment-applications/${id}`,
              },
              { label: "Print" },
            ]}
          />
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" />
            Print Application
          </Button>
        </div>

        {/* G702 - APPLICATION AND CERTIFICATE FOR PAYMENT */}
        <div className="print-section border rounded-lg p-6 bg-card">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold uppercase tracking-wide">
              Application and Certificate for Payment
            </h1>
            <p className="text-sm text-muted-foreground">
              AIA Document G702 Style — Application #{detail.applicationNumber}
            </p>
          </div>

          {/* Header Info Grid */}
          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div className="space-y-3">
              <div>
                <span className="text-muted-foreground block text-xs uppercase">
                  Application No.
                </span>
                <span className="font-bold text-lg">
                  {detail.applicationNumber}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase">
                  Status
                </span>
                <span className="font-medium">
                  {paymentApplicationStatusLabel(detail.status)}
                </span>
              </div>
              {detail.invoiceNumber && (
                <div>
                  <span className="text-muted-foreground block text-xs uppercase">
                    Invoice Number
                  </span>
                  <span className="font-mono">{detail.invoiceNumber}</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground block text-xs uppercase">
                    Period From
                  </span>
                  <span>{formatDate(detail.periodStart)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase">
                    Period To
                  </span>
                  <span>{formatDate(detail.periodEnd)}</span>
                </div>
              </div>
              {detail.approvedBy && (
                <div>
                  <span className="text-muted-foreground block text-xs uppercase">
                    Approved By
                  </span>
                  <span>
                    {detail.approvedBy} on {formatDate(detail.approvedDate)}
                  </span>
                </div>
              )}
              {detail.paidDate && (
                <div>
                  <span className="text-muted-foreground block text-xs uppercase">
                    Payment Date
                  </span>
                  <span>
                    {formatDate(detail.paidDate)}
                    {detail.checkNumber && ` (Check: ${detail.checkNumber})`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* G702 Contract Summary Table */}
          <div className="border rounded mb-6">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground w-8 text-center font-bold">
                    1
                  </td>
                  <td className="p-2">Original Contract Sum</td>
                  <td className="p-2 text-right font-mono font-medium w-48">
                    {formatCurrency(g702.originalContractSum)}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    2
                  </td>
                  <td className="p-2">Net Change by Change Orders</td>
                  <td className="p-2 text-right font-mono font-medium">
                    {formatCurrency(g702.netChangeByChangeOrders)}
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
                    {formatCurrency(g702.contractSumToDate)}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    4
                  </td>
                  <td className="p-2">Total Completed & Stored to Date</td>
                  <td className="p-2 text-right font-mono font-medium">
                    {formatCurrency(g702.totalCompletedAndStoredToDate)}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    5
                  </td>
                  <td className="p-2">
                    Retainage ({formatPercent(detail.retainagePercent)})
                  </td>
                  <td className="p-2 text-right font-mono font-medium">
                    {formatCurrency(g702.retainageToDate)}
                  </td>
                </tr>
                <tr className="border-b bg-muted/30">
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    6
                  </td>
                  <td className="p-2 font-semibold">
                    Total Earned Less Retainage (Line 4 &minus; 5)
                  </td>
                  <td className="p-2 text-right font-mono font-bold">
                    {formatCurrency(g702.totalEarnedLessRetainage)}
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
                    {formatCurrency(g702.lessPreviousCertificates)}
                  </td>
                </tr>
                <tr className="border-b bg-primary/5">
                  <td className="p-2 text-center font-bold">8</td>
                  <td className="p-2 font-bold text-lg">
                    Current Payment Due
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-lg">
                    {formatCurrency(g702.currentPaymentDue)}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 text-muted-foreground text-center font-bold">
                    9
                  </td>
                  <td className="p-2">Balance to Finish (Line 3 &minus; 4)</td>
                  <td className="p-2 text-right font-mono font-medium">
                    {formatCurrency(g702.balanceToFinish)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Completion bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">
                Percentage Complete
              </span>
              <span className="font-semibold">
                {formatPercent(overallPercent)}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all"
                style={{ width: `${Math.min(overallPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* G703 - CONTINUATION SHEET */}
        {lineItems.length > 0 && (
          <div className="print-section border rounded-lg p-6 bg-card print-break-before">
            <h2 className="text-lg font-semibold mb-1">
              G703 Continuation Sheet
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Schedule of Values — {lineItems.length} line items
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[800px]">
                <thead>
                  <tr className="text-left text-muted-foreground border-b-2 text-xs uppercase">
                    <th className="pb-2 pr-2">Item</th>
                    <th className="pb-2 pr-2">Description</th>
                    <th className="pb-2 text-right pr-2">Scheduled Value</th>
                    <th className="pb-2 text-right pr-2">Work Previous</th>
                    <th className="pb-2 text-right pr-2">Work This Period</th>
                    <th className="pb-2 text-right pr-2">Materials Stored</th>
                    <th className="pb-2 text-right pr-2">Total to Date</th>
                    <th className="pb-2 text-right pr-2">%</th>
                    <th className="pb-2 text-right pr-2">Balance</th>
                    <th className="pb-2 text-right">Retainage</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li) => (
                    <tr key={li.id} className="border-b border-dashed">
                      <td className="py-1.5 pr-2 font-mono text-xs">
                        {li.itemNumber}
                      </td>
                      <td className="py-1.5 pr-2 max-w-[180px] truncate">
                        {li.description}
                      </td>
                      <td className="py-1.5 text-right pr-2 font-mono">
                        {formatCurrency(li.scheduledValue)}
                      </td>
                      <td className="py-1.5 text-right pr-2 font-mono text-muted-foreground">
                        {formatCurrency(li.workCompletedPrevious)}
                      </td>
                      <td className="py-1.5 text-right pr-2 font-mono font-medium">
                        {formatCurrency(li.workCompletedThisPeriod)}
                      </td>
                      <td className="py-1.5 text-right pr-2 font-mono">
                        {formatCurrency(li.materialsStoredThisPeriod)}
                      </td>
                      <td className="py-1.5 text-right pr-2 font-mono font-medium">
                        {formatCurrency(li.totalCompletedAndStoredToDate)}
                      </td>
                      <td className="py-1.5 text-right pr-2 font-mono text-xs">
                        {formatPercent(li.percentComplete)}
                      </td>
                      <td className="py-1.5 text-right pr-2 font-mono">
                        {formatCurrency(li.balanceToFinish)}
                      </td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground">
                        {formatCurrency(li.retainageAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold bg-muted/50">
                    <td colSpan={2} className="py-2 pr-2">
                      Grand Total
                    </td>
                    <td className="py-2 text-right pr-2 font-mono">
                      {formatCurrency(g703Totals.scheduledValue)}
                    </td>
                    <td className="py-2 text-right pr-2 font-mono">
                      {formatCurrency(g703Totals.workPrevious)}
                    </td>
                    <td className="py-2 text-right pr-2 font-mono">
                      {formatCurrency(g703Totals.workThisPeriod)}
                    </td>
                    <td className="py-2 text-right pr-2 font-mono">
                      {formatCurrency(g703Totals.matThisPeriod)}
                    </td>
                    <td className="py-2 text-right pr-2 font-mono">
                      {formatCurrency(g703Totals.totalCompleted)}
                    </td>
                    <td className="py-2 text-right pr-2 font-mono text-xs">
                      {formatPercent(overallPercent)}
                    </td>
                    <td className="py-2 text-right pr-2 font-mono">
                      {formatCurrency(g703Totals.balanceToFinish)}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {formatCurrency(g703Totals.retainage)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Signature Blocks */}
        <div className="print-section border rounded-lg p-6 bg-card print-break-avoid">
          <div className="grid grid-cols-2 gap-8">
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
                    Contractor Signature
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="border-b border-black mb-1 h-8" />
                    <p className="text-xs text-muted-foreground">
                      Printed Name
                    </p>
                  </div>
                  <div>
                    <div className="border-b border-black mb-1 h-8" />
                    <p className="text-xs text-muted-foreground">Date</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase mb-4">
                Owner&apos;s Approval
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                In accordance with the Contract Documents, based on on-site
                observations and the data comprising the above application, the
                Owner certifies that to the best of the Owner&apos;s knowledge,
                the Work has progressed as indicated.
              </p>
              <div className="space-y-4">
                <div>
                  <div className="border-b border-black mb-1 h-8" />
                  <p className="text-xs text-muted-foreground">
                    Amount Certified:{" "}
                    {formatCurrency(g702.currentPaymentDue)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="border-b border-black mb-1 h-8" />
                    <p className="text-xs text-muted-foreground">Signature</p>
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
            Pitbull Construction ERP &bull; Payment Application #
            {detail.applicationNumber} &bull; Period:{" "}
            {formatDate(detail.periodStart)} &ndash;{" "}
            {formatDate(detail.periodEnd)}
          </p>
          <p>Generated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </>
  );
}
