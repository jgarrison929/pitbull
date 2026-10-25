import { Skeleton } from "@/components/ui/skeleton";

export default function MigrationWizardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-72" />
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center flex-1">
            <Skeleton className="h-8 w-8 rounded-full" />
            {i < 4 && <Skeleton className="h-0.5 flex-1 mx-1" />}
          </div>
        ))}
      </div>
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}
