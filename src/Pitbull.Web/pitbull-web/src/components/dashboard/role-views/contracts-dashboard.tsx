"use client";

import { useEffect, useState, type ComponentType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  FilePenLine,
  Banknote,
  ShieldAlert,
  ScrollText,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useCompany } from "@/contexts/company-context";

interface DashboardAnalytics {
  activeProjects: number;
  openRFIs: number;
  upcomingDeadlines: {
    date: string;
    projectName: string;
    milestone: string;
    daysRemaining: number;
  }[];
  recentActivity: {
    user: string;
    action: string;
    entity: string;
    timestamp: string;
    description?: string | null;
  }[];
}

interface BriefingContractsSection {
  activeOwnerContractCount: number;
  activeSubcontractCount: number;
  openChangeOrderCount: number;
  pendingPayAppCount: number;
  expiringComplianceDocCount: number;
  expiredComplianceDocCount: number;
}

interface MorningBriefingDto {
  contracts?: BriefingContractsSection | null;
  core?: { activeProjectCount: number };
}

/**
 * Contract administrator home.
 * Day job: main/owner contracts, subcontracts, sub pay apps, insurance & project compliance.
 * Real entity counts only — no invented commercial health scores.
 */
export function ContractsDashboard({
  data,
  isLoading,
}: {
  data: DashboardAnalytics | null;
  isLoading: boolean;
}) {
  const { activeCompany } = useCompany();
  const [contracts, setContracts] = useState<BriefingContractsSection | null>(
    null
  );
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSummaryLoading(true);
      try {
        const briefing = await api<MorningBriefingDto>("/api/briefing/morning");
        if (!cancelled) setContracts(briefing.contracts ?? null);
      } catch {
        if (!cancelled) setContracts(null);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompany?.id]);

  const loading = isLoading || summaryLoading;
  const complianceAttention =
    (contracts?.expiringComplianceDocCount ?? 0) +
    (contracts?.expiredComplianceDocCount ?? 0);

  const cards: {
    href: string;
    title: string;
    value: number | null;
    hint: string;
    icon: ComponentType<{ className?: string }>;
    warn?: boolean;
  }[] = [
    {
      href: "/billing/contracts",
      title: "Active owner contracts",
      value: contracts?.activeOwnerContractCount ?? null,
      hint: "Main / prime agreements",
      icon: ScrollText,
    },
    {
      href: "/contracts",
      title: "Active subcontracts",
      value: contracts?.activeSubcontractCount ?? null,
      hint: "Negotiate & administer",
      icon: FileText,
    },
    {
      href: "/payment-applications",
      title: "Pending sub pay apps",
      value: contracts?.pendingPayAppCount ?? null,
      hint: "Submitted or reviewed",
      icon: Banknote,
      warn: (contracts?.pendingPayAppCount ?? 0) > 0,
    },
    {
      href: "/reports/compliance",
      title: "Insurance / compliance",
      value: contracts == null ? null : complianceAttention,
      hint:
        contracts == null
          ? "Expiring + expired sub/project docs"
          : `${contracts.expiringComplianceDocCount} expiring · ${contracts.expiredComplianceDocCount} expired`,
      icon: ShieldAlert,
      warn: complianceAttention > 0,
    },
    {
      href: "/change-orders",
      title: "Open change orders",
      value: contracts?.openChangeOrderCount ?? null,
      hint: "Pending or under review",
      icon: FilePenLine,
      warn: (contracts?.openChangeOrderCount ?? 0) > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Contract administration: main contracts, subcontractor agreements, pay
        apps, and insurance/compliance reviews. Metrics are real register
        counts — not a portfolio health score.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href + card.title} href={card.href} className="group">
              <Card
                className={`h-full cursor-pointer transition-colors group-hover:border-amber-500/50 group-hover:shadow-md ${
                  card.warn ? "border-amber-200/80 dark:border-amber-500/30" : ""
                }`}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold tabular-nums">
                        {card.value ?? "—"}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {card.hint}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Link href="/projects" className="group block max-w-md">
        <Card className="transition-colors group-hover:border-amber-500/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active projects (context)
            </CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums">
                  {data?.activeProjects ?? 0}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Jobs where contracts and compliance are negotiated — not a
                  health KPI
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
