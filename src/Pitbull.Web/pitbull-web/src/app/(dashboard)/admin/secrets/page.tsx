"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import api from "@/lib/api";
import { useRequireAdmin } from "@/hooks/use-require-admin";

interface SecretItem {
  key: string;
  displayName: string;
  isConfigured: boolean;
  maskedValue: string | null;
}

interface SecretCategory {
  category: string;
  secrets: SecretItem[];
}

interface SecretsStatusResponse {
  configuredCount: number;
  totalCount: number;
  categories: SecretCategory[];
}

export default function SecretsPage() {
  const { isAdmin } = useRequireAdmin();
  const [data, setData] = useState<SecretsStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSecrets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api<SecretsStatusResponse>("/api/admin/secrets");
      setData(res);
    } catch {
      toast.error("Failed to load secrets status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Secrets" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Secrets Management
          </h1>
          <p className="text-muted-foreground">
            View which secrets and API keys are configured in this environment.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchSecrets}
          disabled={isLoading}
          className="min-h-[44px]"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary card */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-amber-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {data.configuredCount} / {data.totalCount}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    secrets configured
                  </p>
                </div>
                {data.configuredCount === data.totalCount ? (
                  <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    All configured
                  </Badge>
                ) : (
                  <Badge className="ml-auto bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                    {data.totalCount - data.configuredCount} missing
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category cards */}
          {data.categories.map((category) => (
            <Card key={category.category}>
              <CardHeader>
                <CardTitle className="text-base">{category.category}</CardTitle>
                <CardDescription>
                  {category.secrets.filter((s) => s.isConfigured).length} of{" "}
                  {category.secrets.length} configured
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {category.secrets.map((secret) => (
                    <div
                      key={secret.key}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {secret.isConfigured ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {secret.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {secret.key}
                          </p>
                        </div>
                      </div>
                      {secret.isConfigured && secret.maskedValue ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {secret.maskedValue}
                        </code>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-red-500 border-red-200"
                        >
                          Not set
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      ) : null}
    </div>
  );
}
