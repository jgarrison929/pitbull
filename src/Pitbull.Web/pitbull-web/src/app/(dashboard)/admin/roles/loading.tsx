import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-11 w-32" />
      </div>
      {[...Array(2)].map((_, i) => (
        <Card key={i}>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent className="space-y-2">
            {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-10 w-full" />)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
