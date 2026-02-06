import { TableSkeleton } from "@/components/skeletons";

export default function ApprovalLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-muted animate-pulse rounded" />
          <div className="h-4 w-72 bg-muted animate-pulse rounded" />
        </div>
      </div>
      <TableSkeleton
        headers={["Date", "Employee", "Project", "Cost Code", "Hours", "Actions"]}
        rows={8}
      />
    </div>
  );
}
