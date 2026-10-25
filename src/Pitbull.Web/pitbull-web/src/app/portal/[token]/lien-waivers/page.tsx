"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Plus,
  AlertTriangle,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/config";

interface LienWaiverDto {
  id: string;
  projectId: string;
  vendorId: string | null;
  waiverType: string;
  amount: number;
  throughDate: string;
  status: string;
  documentPath: string | null;
  description: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string | null;
}

type PageState =
  | { status: "loading" }
  | { status: "loaded"; waivers: LienWaiverDto[] }
  | { status: "unauthorized"; message: string }
  | { status: "error"; message: string };

async function portalFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
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

const WAIVER_TYPES = [
  { value: "Conditional", label: "Conditional" },
  { value: "Unconditional", label: "Unconditional" },
  { value: "Progress", label: "Progress" },
  { value: "Final", label: "Final" },
];

function statusBadge(status: string) {
  switch (status) {
    case "Requested":
      return (
        <Badge
          variant="secondary"
          className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
        >
          Requested
        </Badge>
      );
    case "Received":
      return (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        >
          Received
        </Badge>
      );
    case "Approved":
      return (
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
        >
          Approved
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

export default function LienWaiversPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [waiverType, setWaiverType] = useState("Conditional");
  const [amount, setAmount] = useState("");
  const [throughDate, setThroughDate] = useState("");
  const [description, setDescription] = useState("");

  const fetchWaivers = useCallback(async () => {
    try {
      const waivers = await portalFetch<LienWaiverDto[]>(
        `/api/vendor-portal/${token}/lien-waivers`
      );
      setState({ status: "loaded", waivers });
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
          message: "Unable to load lien waivers. Please try again.",
        });
      }
    }
  }, [token]);

  useEffect(() => {
    fetchWaivers();
  }, [fetchWaivers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !throughDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await portalFetch(`/api/vendor-portal/${token}/lien-waivers`, {
        method: "POST",
        body: JSON.stringify({
          waiverType,
          amount: parseFloat(amount),
          throughDate,
          description: description || null,
        }),
      });
      toast.success("Lien waiver submitted successfully");
      setShowForm(false);
      setWaiverType("Conditional");
      setAmount("");
      setThroughDate("");
      setDescription("");
      fetchWaivers();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Failed to submit lien waiver");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
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
            fetchWaivers();
          }}
          className="min-h-[44px]"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const { waivers } = state;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lien Waivers</h1>
          <p className="text-muted-foreground">
            View and submit lien waivers for this project.
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Submit Lien Waiver
        </Button>
      </div>

      {waivers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium mb-1">No Lien Waivers</p>
            <p className="text-xs text-muted-foreground mb-4">
              No lien waivers have been submitted for this project yet.
            </p>
            <Button
              variant="outline"
              onClick={() => setShowForm(true)}
              className="min-h-[44px]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Submit First Lien Waiver
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {waivers.map((waiver) => (
            <Card key={waiver.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium">
                        {waiver.waiverType} Waiver
                      </p>
                      {statusBadge(waiver.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Through {formatDate(waiver.throughDate)}
                    </p>
                    {waiver.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {waiver.description}
                      </p>
                    )}
                    {waiver.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1">
                        Reason: {waiver.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-semibold">
                      {formatCurrency(waiver.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDate(waiver.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Lien Waiver</DialogTitle>
            <DialogDescription>
              Complete the form below to submit a new lien waiver.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="waiverType">Waiver Type *</Label>
              <Select value={waiverType} onValueChange={setWaiverType}>
                <SelectTrigger id="waiverType" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAIVER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="throughDate">Through Date *</Label>
              <Input
                id="throughDate"
                type="date"
                value={throughDate}
                onChange={(e) => setThroughDate(e.target.value)}
                required
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea
                id="description"
                placeholder="Optional notes about this lien waiver..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
