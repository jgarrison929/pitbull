import { Skeleton } from "@/components/ui/skeleton";

export default function ContractPrintLoading() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-96 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
