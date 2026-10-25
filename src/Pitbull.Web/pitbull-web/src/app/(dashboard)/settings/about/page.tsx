"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, GitCommit, Calendar, Package, FileText, Loader2 } from "lucide-react";
import { getAppVersion } from "@/lib/app-version";
import { API_BASE_URL } from "@/lib/config";
import {
  CHANGELOG_PAGE_SIZE,
  changelogHasMore,
  fetchChangelog,
  type ChangelogRelease,
} from "@/lib/changelog";
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
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [changelogError, setChangelogError] = useState(false);
  const [changelogLoading, setChangelogLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreLock = useRef(false);

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
      fetchChangelog({
        limit: CHANGELOG_PAGE_SIZE,
        offset: 0,
        excludeUnreleased: true,
      }),
    ])
      .then(([current, page]) => {
        setCurrentRelease(current.releases[0] ?? null);
        setHistory(page.releases);
        setHistoryTotal(page.totalCount);
        setHistoryHasMore(changelogHasMore(page));
        setChangelogError(false);
      })
      .catch(() => setChangelogError(true))
      .finally(() => setChangelogLoading(false));
  }, []);

  const loadMoreHistory = useCallback(async () => {
    if (loadingMoreLock.current || !historyHasMore || changelogError) return;
    loadingMoreLock.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchChangelog({
        limit: CHANGELOG_PAGE_SIZE,
        offset: history.length,
        excludeUnreleased: true,
      });
      setHistory((prev) => {
        const seen = new Set(prev.map((r) => r.version));
        const merged = [...prev];
        for (const r of page.releases) {
          if (!seen.has(r.version)) {
            seen.add(r.version);
            merged.push(r);
          }
        }
        return merged;
      });
      setHistoryTotal(page.totalCount);
      // hasMore against cumulative offset after this page (server offset = previous length)
      setHistoryHasMore(page.offset + page.releases.length < page.totalCount);
    } catch {
      // Keep what we have; user can scroll again to retry
    } finally {
      setLoadingMore(false);
      loadingMoreLock.current = false;
    }
  }, [history.length, historyHasMore, changelogError]);

  // Viewport-driven progressive load (IntersectionObserver sentinel)
  useEffect(() => {
    if (changelogLoading || !historyHasMore) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMoreHistory();
        }
      },
      { root: null, rootMargin: "240px 0px", threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [changelogLoading, historyHasMore, loadMoreHistory]);

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
              No release notes found for v{frontendVersion}. Full history is below.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Full history — progressive load as you scroll */}
      {!changelogLoading && !changelogError && history.length > 0 && (
        <Card id="changelog-history">
          <CardHeader>
            <CardTitle>Release history</CardTitle>
            <CardDescription>
              Full project changelog
              {historyTotal > 0
                ? historyHasMore
                  ? ` · showing ${history.length} of ${historyTotal} · scroll to load more`
                  : ` · ${history.length} releases`
                : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ChangelogList releases={history} compact />
            <div
              ref={loadMoreRef}
              className="flex min-h-10 flex-col items-center justify-center gap-2 py-2"
              aria-live="polite"
            >
              {loadingMore && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading more releases…
                </p>
              )}
              {!loadingMore && historyHasMore && (
                <button
                  type="button"
                  onClick={() => void loadMoreHistory()}
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Load more releases
                </button>
              )}
              {!historyHasMore && (
                <p className="text-xs text-muted-foreground">
                  End of changelog ({history.length} releases)
                </p>
              )}
            </div>
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
              Changelog on GitHub
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
