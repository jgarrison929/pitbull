import { TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-72 bg-muted rounded animate-pulse mt-2" />
      </div>
      <TableSkeleton
        headers={["Code", "Name", "Status", "Default", "Actions"]}
        rows={4}
      />
    </div>
  );
}
