import { Skeleton } from "@/components/ui/skeleton";

export default function MigrationLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}
