import { Skeleton } from "@/components/ui/skeleton";
import { MOBILE_FIELD_WIZARD_ACTION_BAR } from "@/components/layout/mobile-shell";

export default function MobileDailyReportLoading() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className={MOBILE_FIELD_WIZARD_ACTION_BAR}>
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
