"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  CreditCard,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Building2,
  FolderOpen,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

interface PortalContext {
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  companyName: string;
}

type PortalState =
  | { status: "loading" }
  | { status: "valid"; context: PortalContext }
  | { status: "invalid"; code: string; message: string }
  | { status: "error"; message: string };

async function portalApi<T>(endpoint: string): Promise<T> {
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

export default function PortalLandingPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<PortalState>({ status: "loading" });

  useEffect(() => {
    async function validate() {
      try {
        const context = await portalApi<PortalContext>(
          `/api/vendor-portal/${token}/validate`
        );
        setState({ status: "valid", context });
      } catch (err: unknown) {
        const e = err as { status?: number; code?: string; message?: string };
        if (e.status === 401 || e.status === 404) {
          setState({
            status: "invalid",
            code: e.code ?? "INVALID_TOKEN",
            message:
              e.message ??
              "This link is invalid or has expired.",
          });
        } else if (e.status === 429) {
          setState({
            status: "error",
            message:
              "Too many requests. Please try again in a minute.",
          });
        } else {
          setState({
            status: "error",
            message:
              "Unable to connect. Check your internet connection and try again.",
          });
        }
      }
    }
    validate();
  }, [token]);

  if (state.status === "loading") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (state.status === "invalid") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
          <ShieldAlert className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-xl font-bold mb-2">Invalid or Expired Link</h1>
        <p className="text-muted-foreground max-w-md mb-2">
          {state.message}
        </p>
        <p className="text-sm text-muted-foreground">
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
        <h1 className="text-xl font-bold mb-2">Connection Error</h1>
        <p className="text-muted-foreground max-w-md mb-4">
          {state.message}
        </p>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="min-h-[44px]"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const { context } = state;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome, {context.vendorName}
        </h1>
        <p className="text-muted-foreground">
          Vendor portal for managing your project documents and payments.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Building2 className="h-5 w-5 text-amber-500 shrink-0" />
            <CardTitle className="text-sm font-medium">Company</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{context.companyName}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <FolderOpen className="h-5 w-5 text-blue-500 shrink-0" />
            <CardTitle className="text-sm font-medium">Project</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{context.projectName}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={`/portal/${token}/lien-waivers`}>
          <Card className="h-full hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                <FileText className="h-7 w-7 text-amber-600" />
              </div>
              <div className="text-center">
                <p className="font-semibold">Lien Waivers</p>
                <p className="text-sm text-muted-foreground">
                  View and submit lien waivers
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/portal/${token}/payments`}>
          <Card className="h-full hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                <CreditCard className="h-7 w-7 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="font-semibold">Payment History</p>
                <p className="text-sm text-muted-foreground">
                  View payment records and retention
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="rounded-lg border p-4 flex items-start gap-3">
        <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Secure Access</p>
          <p className="text-xs text-muted-foreground">
            This portal link is unique to your vendor account. Do not share it
            with unauthorized parties. The link will expire automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
