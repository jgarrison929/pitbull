import { TableSkeleton, DashboardStatsSkeleton } from "@/components/skeletons";

export default function CostCodesLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-80 bg-muted animate-pulse rounded mt-2" />
      </div>
      <DashboardStatsSkeleton count={5} />
      <TableSkeleton 
        headers={["Code", "Description", "Division", "Type", "Status"]} 
        rows={10} 
      />
    </div>
  );
}
