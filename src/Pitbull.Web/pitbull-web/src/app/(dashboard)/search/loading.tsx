import { CardListSkeleton } from "@/components/skeletons";

export default function SearchLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
        <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
      </div>
      <div className="h-12 w-full bg-muted animate-pulse rounded" />
      <CardListSkeleton rows={5} />
    </div>
  );
}
