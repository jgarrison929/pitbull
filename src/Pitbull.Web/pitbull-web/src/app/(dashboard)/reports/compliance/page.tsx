"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Shield } from "lucide-react";
import api from "@/lib/api";
import { useCompany } from "@/contexts/company-context";
import { toast } from "sonner";

interface ComplianceDocument {
  id: string;
  entityType: string;
  entityName: string;
  documentType: string;
  documentNumber: string;
  status: string;
  expirationDate: string | null;
  daysUntilExpiration: number | null;
}

interface ComplianceDashboard {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
}

/**
 * Read-only compliance drill for executives (not behind /admin Identity Admin gate).
 */
export default function ComplianceReportPage() {
  const { activeCompany } = useCompany();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status"); // attention | ExpiringSoon | Expired | Active
  const [docs, setDocs] = useState<ComplianceDocument[]>([]);
  const [dash, setDash] = useState<ComplianceDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [list, summary] = await Promise.all([
          api<ComplianceDocument[]>("/api/compliance-documents"),
          api<ComplianceDashboard>("/api/compliance-documents/dashboard"),
        ]);
        if (!cancelled) {
          setDocs(Array.isArray(list) ? list : []);
          setDash(summary);
        }
      } catch {
        if (!cancelled) {
          toast.error("Failed to load compliance documents");
          setDocs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompany?.id]);

  const filtered = useMemo(() => {
    if (!statusParam || statusParam === "all") return docs;
    if (statusParam === "attention") {
      return docs.filter(
        (d) => d.status === "ExpiringSoon" || d.status === "Expired"
      );
    }
    return docs.filter(
      (d) => d.status.toLowerCase() === statusParam.toLowerCase()
    );
  }, [docs, statusParam]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance documents</h1>
        <p className="text-muted-foreground">
          Certifications and policies behind the executive compliance KPI
          {statusParam === "attention"
            ? " — showing expiring soon and expired only"
            : ""}
          .
        </p>
      </div>

      {dash && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{dash.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{dash.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Expiring soon</p>
              <p className="text-2xl font-bold text-amber-700">{dash.expiringSoon}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Expired</p>
              <p className="text-2xl font-bold text-red-600">{dash.expired}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {filtered.length} document{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton
              headers={["Entity", "Type", "Status", "Expires"]}
              rows={5}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No documents match"
              description="Try clearing the attention filter or add compliance documents in admin."
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {d.entityName}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({d.entityType})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.documentType}
                      {d.documentNumber ? ` · ${d.documentNumber}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{d.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {d.expirationDate
                        ? new Date(d.expirationDate).toLocaleDateString()
                        : "No expiry"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
