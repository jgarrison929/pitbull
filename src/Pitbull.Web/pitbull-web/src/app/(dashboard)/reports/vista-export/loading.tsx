import { CardSkeleton } from "@/components/skeletons";

export default function VistaExportLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="h-4 w-96 bg-muted rounded animate-pulse" />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
