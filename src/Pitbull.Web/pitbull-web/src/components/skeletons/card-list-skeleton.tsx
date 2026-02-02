import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CardListSkeletonProps {
  rows?: number;
  title?: string;
}

export function CardListSkeleton({ rows = 5, title }: CardListSkeletonProps) {
  return (
    <Card>
      <CardHeader>
        {title ? (
          <Skeleton className="h-5 w-32" />
        ) : (
          <div className="h-5" />
        )}
      </CardHeader>
      <CardContent>
        {/* Mobile card layout skeleton */}
        <div className="sm:hidden space-y-3">
          {[...Array(rows)].map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full shrink-0" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}