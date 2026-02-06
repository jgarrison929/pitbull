import { TableSkeleton, StatsCardsSkeleton } from "@/components/skeletons";

export default function CostCodesLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-80 bg-muted animate-pulse rounded mt-2" />
      </div>
      <StatsCardsSkeleton count={5} />
      <TableSkeleton rows={10} columns={5} />
    </div>
  );
}
