"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, GitCommit, Calendar, Package, FileText } from "lucide-react";

interface ApiVersionInfo {
  version: string;
  buildDate: string;
  commitHash: string;
}

export default function AboutPage() {
  const [apiVersion, setApiVersion] = useState<ApiVersionInfo | null>(null);
  const [apiError, setApiError] = useState(false);

  const frontendVersion = process.env.NEXT_PUBLIC_APP_VERSION || "unknown";
  const commitHash = process.env.NEXT_PUBLIC_COMMIT_HASH || "dev";

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    fetch(`${apiBase}/api/version`)
      .then((res) => res.json())
      .then((data) => setApiVersion(data))
      .catch(() => setApiError(true));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">About</h1>
        <p className="text-muted-foreground">
          Version information and system details
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Frontend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Frontend
            </CardTitle>
            <CardDescription>Next.js web application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Version</span>
              <Badge variant="secondary">v{frontendVersion}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Commit</span>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                {commitHash.slice(0, 7)}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Backend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCommit className="h-5 w-5" />
              Backend API
            </CardTitle>
            <CardDescription>.NET 9 API server</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {apiError ? (
              <p className="text-sm text-muted-foreground">Unable to reach API</p>
            ) : apiVersion ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Version</span>
                  <Badge variant="secondary">v{apiVersion.version}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Commit</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {apiVersion.commitHash.slice(0, 7)}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Build Date</span>
                  <span className="text-sm">
                    {new Date(apiVersion.buildDate).toLocaleDateString()}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="https://github.com/jgarrison929/pitbull-private/blob/main/CHANGELOG.md"
              target="_blank"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Changelog
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="https://github.com/jgarrison929/pitbull-private"
              target="_blank"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <GitCommit className="h-4 w-4" />
              Source Code
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Pitbull Construction Solutions © {new Date().getFullYear()} Lyles Construction Technology
      </p>
    </div>
  );
}
