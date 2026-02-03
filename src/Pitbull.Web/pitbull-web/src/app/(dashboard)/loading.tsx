import { DashboardActivitySkeleton, DashboardStatsSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <DashboardStatsSkeleton />
      <DashboardActivitySkeleton />
    </div>
  );
}
