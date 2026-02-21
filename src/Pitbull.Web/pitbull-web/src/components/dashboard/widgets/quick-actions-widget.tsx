"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock3, ClipboardCheck, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";

export function QuickActionsWidget({
  pendingApprovals,
}: {
  pendingApprovals: number;
}) {
  const { hasAnyRole } = useAuth();

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <Button
        variant="outline"
        asChild
        className="h-auto py-3 flex-col gap-1.5 min-h-[44px]"
      >
        <Link href="/projects/new">
          <Plus className="h-5 w-5 text-amber-600" />
          <span className="text-sm font-medium">New Project</span>
        </Link>
      </Button>
      <Button
        variant="outline"
        asChild
        className="h-auto py-3 flex-col gap-1.5 min-h-[44px]"
      >
        <Link href="/time-tracking/crew-entry">
          <Clock3 className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium">Enter Time</span>
        </Link>
      </Button>
      {hasAnyRole(["Admin", "Manager", "Supervisor"]) && (
        <Button
          variant="outline"
          asChild
          className="h-auto py-3 flex-col gap-1.5 min-h-[44px] relative"
        >
          <Link href="/time-tracking/approval">
            <ClipboardCheck className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium">Approve Time</span>
            {pendingApprovals > 0 && (
              <Badge className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 text-[10px] bg-amber-500 text-white">
                {pendingApprovals}
              </Badge>
            )}
          </Link>
        </Button>
      )}
      <Button
        variant="outline"
        asChild
        className="h-auto py-3 flex-col gap-1.5 min-h-[44px]"
      >
        <Link href="/reports">
          <BarChart3 className="h-5 w-5 text-purple-600" />
          <span className="text-sm font-medium">Run Reports</span>
        </Link>
      </Button>
    </div>
  );
}
