"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, GitCommit, Calendar, Package, FileText } from "lucide-react";
import { getAppVersion } from "@/lib/app-version";
import { API_BASE_URL } from "@/lib/config";
import { fetchChangelog, type ChangelogRelease } from "@/lib/changelog";
import { ChangelogList, ChangelogReleaseView } from "@/components/changelog/changelog-notes";

interface ApiVersionInfo {
  version: string;
  buildDate: string;
  commitHash: string;
}

export default function AboutPage() {
  const [apiVersion, setApiVersion] = useState<ApiVersionInfo | null>(null);
  const [apiError, setApiError] = useState(false);
  const [currentRelease, setCurrentRelease] = useState<ChangelogRelease | null>(null);
  const [history, setHistory] = useState<ChangelogRelease[]>([]);
  const [changelogError, setChangelogError] = useState(false);
  const [changelogLoading, setChangelogLoading] = useState(true);

  const frontendVersion = getAppVersion();
  const commitHash = process.env.NEXT_PUBLIC_COMMIT_HASH || "dev";

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/version`)
      .then((res) => res.json())
      .then((data) => setApiVersion(data))
      .catch(() => setApiError(true));
  }, []);

  useEffect(() => {
    setChangelogLoading(true);
    Promise.all([
      fetchChangelog({ current: true }),
      fetchChangelog({ limit: 8 }),
    ])
      .then(([current, all]) => {
        setCurrentRelease(current.releases[0] ?? null);
        // History: skip Unreleased for the main "current" card, keep list for browsing
        setHistory(
          all.releases.filter(
            (r) => r.version.toLowerCase() !== "unreleased"
          )
        );
        setChangelogError(false);
      })
      .catch(() => setChangelogError(true))
      .finally(() => setChangelogLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">About</h1>
        <p className="text-muted-foreground">
          Version information and release notes
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
            <CardDescription>.NET 10 API server</CardDescription>
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
                    {apiVersion.buildDate
                      ? new Date(apiVersion.buildDate).toLocaleDateString()
                      : "—"}
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

      {/* What's new — tied to app version */}
      <Card id="changelog">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            What&apos;s new in v{frontendVersion}
          </CardTitle>
          <CardDescription>
            From CHANGELOG.md (same notes as the version badge)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {changelogLoading && (
            <p className="text-sm text-muted-foreground">Loading release notes…</p>
          )}
          {changelogError && (
            <p className="text-sm text-muted-foreground">
              Unable to load changelog from the API.
            </p>
          )}
          {!changelogLoading && !changelogError && currentRelease && (
            <ChangelogReleaseView release={currentRelease} />
          )}
          {!changelogLoading && !changelogError && !currentRelease && (
            <p className="text-sm text-muted-foreground">
              No release notes found for v{frontendVersion}. Recent history is below.
            </p>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {!changelogLoading && !changelogError && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent releases</CardTitle>
            <CardDescription>Latest entries from the project changelog</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangelogList releases={history} compact />
          </CardContent>
        </Card>
      )}

      {/* Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="https://github.com/jgarrison929/pitbull/blob/main/CHANGELOG.md"
              target="_blank"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="h-4 w-4" />
              Full changelog on GitHub
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="https://github.com/jgarrison929/pitbull"
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
        Pitbull Construction Solutions © {new Date().getFullYear()}
      </p>
    </div>
  );
}
