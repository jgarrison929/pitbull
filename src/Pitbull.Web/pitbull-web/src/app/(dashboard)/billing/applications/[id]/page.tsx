"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BillingApplicationDto {
  id: string;
  projectId: string;
  ownerContractId: string;
  ownerScheduleOfValuesId: string;
  applicationNumber: number;
  periodFrom: string;
  periodThrough: string;
  applicationDate: string;
  originalContractSum: number;
  netChangeByChangeOrders: number;
  contractSumToDate: number;
  totalCompletedAndStoredToDate: number;
  retainageOnCompletedWork: number;
  retainageOnStoredMaterials: number;
  totalRetainage: number;
  retainagePercentWork: number;
  retainagePercentMaterials: number;
  totalEarnedLessRetainage: number;
  lessPreviousCertificates: number;
  currentPaymentDue: number;
  balanceToFinishIncludingRetainage: number;
  status: string;
  internalNotes: string | null;
  billingNarrative: string | null;
  createdAt: string;
  updatedAt: string | null;
  lineItems: BillingLineItemDto[] | null;
}

interface BillingLineItemDto {
  id: string;
  ownerSOVLineItemId: string;
  itemNumber: string;
  description: string;
  scheduledValue: number;
  sortOrder: number;
  workCompletedPrevious: number;
  workCompletedThisPeriod: number;
  materialsStoredToDate: number;
  totalCompletedAndStored: number;
  percentComplete: number;
  balanceToFinish: number;
  retainagePercent: number | null;
  retainageAmount: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export default function BillingApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const appId = params.id as string;

  const [app, setApp] = useState<BillingApplicationDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const fetchApp = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<BillingApplicationDto>(`/api/billing-applications/${appId}`);
      setApp(data);
    } catch {
      toast.error("Failed to load billing application");
    } finally {
      setIsLoading(false);
    }
  }, [appId]);

  useEffect(() => { fetchApp(); }, [fetchApp]);

  const handleWorkflow = async (action: string, label: string) => {
    setIsTransitioning(true);
    try {
      await api(`/api/billing-applications/${appId}/${action}`, { method: "POST" });
      toast.success(label);
      fetchApp();
    } catch {
      toast.error(`Failed: ${label}`);
    } finally {
      setIsTransitioning(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><div className="h-8 w-64 animate-pulse rounded bg-muted" /><div className="h-96 animate-pulse rounded bg-muted" /></div>;
  }

  if (!app) {
    return <div className="text-center py-12"><p className="text-muted-foreground">Application not found.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Application #{app.applicationNumber}</h1>
          <p className="text-muted-foreground">Period: {app.periodFrom} — {app.periodThrough}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge>{app.status}</Badge>
          <Button variant="outline" onClick={() => router.push(`/billing/applications/${appId}/g702`)}>
            View G702
          </Button>
        </div>
      </div>

      {/* Workflow Actions */}
      <div className="flex gap-2">
        {app.status === "Draft" && (
          <Button onClick={() => handleWorkflow("submit-for-review", "Submitted for review")} disabled={isTransitioning}>
            Submit for Review
          </Button>
        )}
        {app.status === "PmReview" && (
          <>
            <Button onClick={() => handleWorkflow("approve", "Approved")} disabled={isTransitioning}>Approve</Button>
            <Button variant="destructive" onClick={() => handleWorkflow("reject", "Rejected")} disabled={isTransitioning}>Reject</Button>
          </>
        )}
        {app.status === "ReadyToSubmit" && (
          <Button onClick={() => handleWorkflow("submit-to-owner", "Submitted to owner")} disabled={isTransitioning}>
            Submit to Owner
          </Button>
        )}
        {app.status === "PmRejected" && (
          <Button onClick={() => handleWorkflow("return-to-draft", "Returned to draft")} disabled={isTransitioning}>
            Return to Draft
          </Button>
        )}
        {app.status === "SubmittedToOwner" && (
          <>
            <Button onClick={() => handleWorkflow("architect-certified", "Architect certified")} disabled={isTransitioning}>Architect Certified</Button>
            <Button variant="destructive" onClick={() => handleWorkflow("disputed", "Marked disputed")} disabled={isTransitioning}>Disputed</Button>
          </>
        )}
        {app.status === "Disputed" && (
          <Button onClick={() => handleWorkflow("resolve-dispute", "Dispute resolved")} disabled={isTransitioning}>Resolve Dispute</Button>
        )}
        {app.status === "ArchitectCertified" && (
          <Button onClick={() => handleWorkflow("payment-due", "Payment due")} disabled={isTransitioning}>Mark Payment Due</Button>
        )}
        {app.status === "PaymentDue" && (
          <>
            <Button onClick={() => handleWorkflow("partially-paid", "Partially paid")} disabled={isTransitioning}>Partially Paid</Button>
            <Button onClick={() => handleWorkflow("paid", "Paid")} disabled={isTransitioning}>Mark Paid</Button>
          </>
        )}
        {app.status === "PartiallyPaid" && (
          <Button onClick={() => handleWorkflow("paid", "Paid")} disabled={isTransitioning}>Mark Paid</Button>
        )}
        {app.status !== "Paid" && app.status !== "Void" && (
          <Button variant="ghost" className="text-destructive" onClick={() => handleWorkflow("void", "Voided")} disabled={isTransitioning}>
            Void
          </Button>
        )}
      </div>

      {/* G702 Summary */}
      <Card>
        <CardHeader><CardTitle>G702 Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">1. Original Contract Sum</span>
              <span className="font-mono font-medium">{formatCurrency(app.originalContractSum)}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">2. Net Change by Change Orders</span>
              <span className="font-mono font-medium">{formatCurrency(app.netChangeByChangeOrders)}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">3. Contract Sum to Date (1 + 2)</span>
              <span className="font-mono font-bold">{formatCurrency(app.contractSumToDate)}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">4. Total Completed &amp; Stored to Date</span>
              <span className="font-mono font-medium">{formatCurrency(app.totalCompletedAndStoredToDate)}</span>
            </div>
            <div className="flex justify-between py-1 pl-4">
              <span className="text-muted-foreground">5a. Retainage on Completed Work ({formatPercent(app.retainagePercentWork)})</span>
              <span className="font-mono">{formatCurrency(app.retainageOnCompletedWork)}</span>
            </div>
            <div className="flex justify-between py-1 pl-4 border-b">
              <span className="text-muted-foreground">5b. Retainage on Stored Materials ({formatPercent(app.retainagePercentMaterials)})</span>
              <span className="font-mono">{formatCurrency(app.retainageOnStoredMaterials)}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">5. Total Retainage</span>
              <span className="font-mono font-medium">{formatCurrency(app.totalRetainage)}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">6. Total Earned Less Retainage (4 - 5)</span>
              <span className="font-mono font-bold">{formatCurrency(app.totalEarnedLessRetainage)}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">7. Less Previous Certificates</span>
              <span className="font-mono font-medium">{formatCurrency(app.lessPreviousCertificates)}</span>
            </div>
            <div className="flex justify-between py-1 border-b bg-muted/50 px-2 rounded">
              <span className="font-semibold">8. Current Payment Due</span>
              <span className="font-mono font-bold text-lg">{formatCurrency(app.currentPaymentDue)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">9. Balance to Finish Including Retainage</span>
              <span className="font-mono font-medium">{formatCurrency(app.balanceToFinishIncludingRetainage)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
