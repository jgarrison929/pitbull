import { BidItemsSkeleton, DetailPageSkeleton } from "@/components/skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <DetailPageSkeleton />

      {/* Extra section to reduce perceived load when bid items fetch is slow */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <BidItemsSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
