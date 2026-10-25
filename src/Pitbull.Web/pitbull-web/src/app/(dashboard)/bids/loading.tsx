import { CardListSkeleton, TableSkeleton } from "@/components/skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-28 rounded-md" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-20" />
        </CardHeader>
        <CardContent className="space-y-4">
          <CardListSkeleton rows={5} />
          <div className="hidden sm:block">
            <TableSkeleton
              headers={["Number", "Name", "Status", "Client", "Value", "Due Date"]}
              rows={5}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
