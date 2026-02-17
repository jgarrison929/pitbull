import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48" />
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
      </Card>
      <Card>
        <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
