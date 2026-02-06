import { DashboardStatsSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-64 bg-muted animate-pulse rounded" />
      </div>

      {/* Summary cards skeleton */}
      <DashboardStatsSkeleton count={4} />

      {/* Filter card skeleton */}
      <div className="rounded-lg border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-10 w-full bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <TableSkeleton
        headers={[
          "Project / Cost Code",
          "Hours",
          "Regular",
          "OT",
          "DT",
          "Base Wages",
          "Burden",
          "Total Cost",
        ]}
        rows={5}
      />
    </div>
  );
}
