import { TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-10 w-36 bg-muted animate-pulse rounded" />
      </div>

      <TableSkeleton
        headers={[
          "Payment #",
          "Vendor",
          "Date",
          "Amount",
          "Method",
          "Reference",
          "Status",
        ]}
        rows={8}
      />
    </div>
  );
}
