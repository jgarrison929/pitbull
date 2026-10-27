import {
  ClipboardList,
  FileText,
  History,
  ListChecks,
  ScrollText,
  SearchX,
} from "lucide-react";
import { EmptyState, emptyStateActionClass } from "@/components/app/page";

/** Demo roles. Kept here so server pages and client lists share one union. */
export type AppRole = "executive" | "pm" | "superintendent" | "foreman";

type NextAction = { label: string; href: string };

function ActionLink({
  action,
  testId,
}: {
  action: NextAction;
  testId?: string;
}) {
  return (
    <a href={action.href} className={emptyStateActionClass} data-testid={testId}>
      {action.label}
    </a>
  );
}

function jobHref(jobNumber: string) {
  return `/app/jobs/${jobNumber}`;
}

export function costEntriesAction(role: AppRole, jobNumber: string): NextAction | null {
  if (role === "foreman") {
    return { label: "Report day's work", href: jobHref(jobNumber) };
  }
  if (role === "superintendent") {
    return { label: "Open daily plans", href: jobHref(jobNumber) };
  }
  return null;
}

/** Cost entries list, when this cost code has no labor and no invoices. */
export function CostEntriesEmpty({
  role,
  jobNumber,
  code,
}: {
  role: AppRole;
  jobNumber: string;
  code: string;
}) {
  const action = costEntriesAction(role, jobNumber);
  return (
    <EmptyState
      testId="cost-item-empty-labor"
      icon={<ClipboardList className="size-5" />}
      title={`No cost posted on ${code}`}
      body="Labor posts when the superintendent approves a daily report for this cost code, and an invoice posts here as other cost."
      action={
        action ? <ActionLink action={action} testId="cost-entries-action" /> : null
      }
    />
  );
}

export function planLinesAction(
  role: AppRole,
  status: string,
  jobNumber: string,
): NextAction | null {
  if (status === "draft" && role === "superintendent") {
    return { label: "Add a line", href: jobHref(jobNumber) };
  }
  return null;
}

export function planLinesBody(role: AppRole, status: string): string {
  if (status === "draft" && role === "superintendent") {
    return "Add a cost code for the work this crew will do today.";
  }
  if (status === "draft") {
    return "The superintendent adds a cost code before this plan can go to the field.";
  }
  return "This plan was issued with no cost codes.";
}

/** Plan detail lines, when the plan has no cost codes. */
export function PlanLinesEmpty({
  role,
  status,
  jobNumber,
}: {
  role: AppRole;
  status: string;
  jobNumber: string;
}) {
  const action = planLinesAction(role, status, jobNumber);
  return (
    <EmptyState
      testId="plan-lines-empty"
      icon={<ListChecks className="size-5" />}
      title="No activities on this plan"
      body={planLinesBody(role, status)}
      action={
        action ? <ActionLink action={action} testId="plan-lines-action" /> : null
      }
    />
  );
}

export function planHistoryAction(
  role: AppRole,
  status: string,
  jobNumber: string,
): NextAction | null {
  const href = jobHref(jobNumber);
  if (status === "draft" && (role === "superintendent" || role === "foreman")) {
    return { label: "Open the plan on the job", href };
  }
  if (status === "issued" && (role === "foreman" || role === "superintendent")) {
    return { label: "Report day's work", href };
  }
  if (status === "reported" && role === "superintendent") {
    return { label: "Approve the report", href };
  }
  return null;
}

/** Plan history, when no submit, report, return, or approve has been recorded. */
export function PlanHistoryEmpty({
  role,
  status,
  jobNumber,
}: {
  role: AppRole;
  status: string;
  jobNumber: string;
}) {
  const action = planHistoryAction(role, status, jobNumber);
  return (
    <EmptyState
      testId="plan-history-empty"
      icon={<History className="size-5" />}
      title="No history recorded"
      body="Each submit, report, return, and approve is listed here with the role and the time."
      action={
        action ? (
          <ActionLink action={action} testId="plan-history-action" />
        ) : null
      }
    />
  );
}

export function changeOrdersBody(opts: {
  jobNumber: string;
  canCreate: boolean;
  estimateApproved: boolean;
}): string {
  if (!opts.estimateApproved) {
    return opts.canCreate
      ? "Approve the estimate first. A change order on a draft is wiped out when Current Budget is set from the Current Estimate."
      : "A project manager approves the estimate before anyone can log a change order on this job.";
  }
  return opts.canCreate
    ? "Log one when the owner or a sub raises a change."
    : "A project manager logs one when the owner or a sub raises a change.";
}

/**
 * Change-order list, when the job has none.
 * `onCreate` reveals the raise form. `onReviewEstimate` moves to Approve estimate.
 */
export function ChangeOrdersEmpty({
  jobNumber,
  canCreate,
  estimateApproved,
  onCreate,
  onReviewEstimate,
}: {
  jobNumber: string;
  canCreate: boolean;
  estimateApproved: boolean;
  onCreate?: () => void;
  onReviewEstimate?: () => void;
}) {
  const review = canCreate && !estimateApproved;
  const create = canCreate && estimateApproved;
  return (
    <EmptyState
      testId="co-empty"
      icon={<ScrollText className="size-5" />}
      title={`No change orders on ${jobNumber}`}
      body={changeOrdersBody({ jobNumber, canCreate, estimateApproved })}
      action={
        create ? (
          <button
            type="button"
            className={emptyStateActionClass}
            data-testid="co-empty-create"
            onClick={onCreate}
          >
            New change order
          </button>
        ) : review ? (
          <button
            type="button"
            className={emptyStateActionClass}
            data-testid="co-empty-review-estimate"
            onClick={onReviewEstimate}
          >
            Review the estimate
          </button>
        ) : null
      }
    />
  );
}

export function changeOrderLinesBody(opts: {
  status: string;
  canPrice: boolean;
}): string {
  if (opts.status === "voided" || opts.status === "rejected") {
    return "This change order was closed before it was priced, so Current Budget did not move.";
  }
  if (opts.canPrice) {
    return "Price labor, material, equipment, and subcontract on each cost item.";
  }
  return "A project manager prices each cost item before this change can be approved.";
}

/** Lines inside one change order, when it has not been priced. */
export function ChangeOrderLinesEmpty({
  status,
  canPrice,
  onPrice,
}: {
  status: string;
  canPrice: boolean;
  onPrice?: () => void;
}) {
  const showPrice =
    canPrice && status !== "voided" && status !== "rejected";
  return (
    <EmptyState
      testId="co-lines-empty"
      icon={<ListChecks className="size-5" />}
      title="No lines yet"
      body={changeOrderLinesBody({ status, canPrice: showPrice })}
      action={
        showPrice ? (
          <button
            type="button"
            className={emptyStateActionClass}
            data-testid="co-price"
            onClick={onPrice}
          >
            Price
          </button>
        ) : null
      }
    />
  );
}

export function changesAction(
  role: AppRole,
  jobNumber: string,
  estimateApproved: boolean,
): NextAction | null {
  if (role === "pm" || role === "executive") {
    return estimateApproved
      ? {
          label: "New change order",
          href: `${jobHref(jobNumber)}#change-orders`,
        }
      : { label: "Review the estimate", href: jobHref(jobNumber) };
  }
  if (role === "superintendent") {
    return { label: "Open daily plans", href: jobHref(jobNumber) };
  }
  if (role === "foreman") {
    return { label: "Report day's work", href: jobHref(jobNumber) };
  }
  return null;
}

/** Job change log, when nobody has recorded a change. */
export function ChangesNothingYet({
  role,
  jobNumber,
  estimateApproved,
}: {
  role: AppRole;
  jobNumber: string;
  estimateApproved: boolean;
}) {
  const action = changesAction(role, jobNumber, estimateApproved);
  return (
    <EmptyState
      testId="changes-empty"
      icon={<FileText className="size-5" />}
      title={`No changes on ${jobNumber}`}
      body="Edits, daily reports, approvals, and change orders are listed here, newest first."
      action={
        action ? <ActionLink action={action} testId="changes-action" /> : null
      }
    />
  );
}

/** Job change log, when the filter matches nothing on this page. */
export function ChangesFilterEmpty({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      testId="changes-filter-empty"
      icon={<SearchX className="size-5" />}
      title="No changes match this filter"
      body="Try another name, cost code, or word from the summary."
      action={
        <button
          type="button"
          className={emptyStateActionClass}
          data-testid="changes-clear-filters"
          onClick={onClear}
        >
          Clear filters
        </button>
      }
    />
  );
}
