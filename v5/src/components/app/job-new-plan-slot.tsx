import { NewPlanForm } from "@/components/app/new-plan-form";
import { jobPagePlanSurface } from "@/server/job-page-plans";

type CrewOption = { id: string; name: string };

/**
 * Job page New-plan control. Derives the default date from `jobPagePlanSurface`
 * so the page never passes a UTC calendar day into the form (M8t).
 */
export function JobNewPlanSlot({
  jobNumber,
  crews,
  plans,
}: {
  jobNumber: string;
  crews: CrewOption[];
  plans: { planDate: string }[];
}) {
  const { today } = jobPagePlanSurface(plans);
  return (
    <div className="mb-3" data-testid="new-plan-slot" data-default-date={today}>
      <NewPlanForm
        jobNumber={jobNumber}
        crews={crews}
        defaultDate={today}
      />
    </div>
  );
}
