import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* AI Insights placeholder (optional collapsed state) */}
      <div className="hidden">
        <Card>
          <CardContent className="py-4">
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Main content grid - Project Details & Client Info */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Project Details card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Client Info card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Labor Summary widget skeleton */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* RFI Cost Widget skeleton */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <Skeleton className="h-8 w-24" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Description card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="border-t pt-4">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
