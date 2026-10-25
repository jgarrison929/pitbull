"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreditCard,
  AlertTriangle,
  ShieldAlert,
  DollarSign,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

interface PaymentHistoryDto {
  id: string;
  amount: number;
  throughDate: string;
  status: string;
  createdAt: string;
}

type PageState =
  | { status: "loading" }
  | { status: "loaded"; payments: PaymentHistoryDto[] }
  | { status: "unauthorized"; message: string }
  | { status: "error"; message: string };

async function portalFetch<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw {
      status: response.status,
      code: data?.code ?? "UNKNOWN",
      message: data?.error ?? `Request failed (${response.status})`,
    };
  }

  return response.json() as Promise<T>;
}

function statusBadge(status: string) {
  switch (status) {
    case "Approved":
      return (
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
        >
          Approved
        </Badge>
      );
    case "Received":
      return (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        >
          Pending
        </Badge>
      );
    case "Requested":
      return (
        <Badge
          variant="secondary"
          className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
        >
          Requested
        </Badge>
      );
    case "Rejected":
      return (
        <Badge
          variant="secondary"
          className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
        >
          Rejected
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PaymentHistoryPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<PageState>({ status: "loading" });

  const fetchPayments = useCallback(async () => {
    try {
      const payments = await portalFetch<PaymentHistoryDto[]>(
        `/api/vendor-portal/${token}/payments`
      );
      setState({ status: "loaded", payments });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status === 401) {
        setState({
          status: "unauthorized",
          message: "This link is invalid or has expired.",
        });
      } else if (e.status === 429) {
        setState({
          status: "error",
          message: "Too many requests. Please try again in a minute.",
        });
      } else {
        setState({
          status: "error",
          message: "Unable to load payment history. Please try again.",
        });
      }
    }
  }, [token]);

  useEffect(() => {
    fetchPayments();  
  }, [fetchPayments]);

  if (state.status === "loading") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (state.status === "unauthorized") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
          <ShieldAlert className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground max-w-md">
          {state.message}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Contact your general contractor for a new portal link.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-4">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold mb-2">Error</h1>
        <p className="text-muted-foreground max-w-md mb-4">
          {state.message}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setState({ status: "loading" });
            fetchPayments();
          }}
          className="min-h-[44px]"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const { payments } = state;

  const totalApproved = payments
    .filter((p) => p.status === "Approved")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
        <p className="text-muted-foreground">
          View your payment records for this project.
        </p>
      </div>

      {payments.length > 0 && (
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 shrink-0">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">
                Total Approved
              </p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {formatCurrency(totalApproved)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium mb-1">No Payment History</p>
            <p className="text-xs text-muted-foreground">
              No payments have been recorded for this project yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Table header (hidden on mobile) */}
          <div className="hidden sm:grid sm:grid-cols-4 gap-4 px-4 text-xs font-medium text-muted-foreground uppercase">
            <span>Amount</span>
            <span>Through Date</span>
            <span>Status</span>
            <span>Submitted</span>
          </div>

          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="p-4">
                {/* Mobile layout */}
                <div className="sm:hidden space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold">
                      {formatCurrency(payment.amount)}
                    </p>
                    {statusBadge(payment.status)}
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Through {formatDate(payment.throughDate)}</span>
                    <span>{formatDate(payment.createdAt)}</span>
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden sm:grid sm:grid-cols-4 gap-4 items-center">
                  <p className="font-semibold">
                    {formatCurrency(payment.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(payment.throughDate)}
                  </p>
                  <div>{statusBadge(payment.status)}</div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(payment.createdAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
