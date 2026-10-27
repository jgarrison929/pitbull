// Plain confirm copy for irreversible screen actions.
// The dialog names the object in the title and the consequence in the body.
import { utcDay } from "@/lib/dates";
import { usdCents } from "@/lib/ev";

export type ConfirmCopy = {
  title: string;
  description: string;
  confirmLabel: string;
  /** Void, reject, and remove. Approve and return stay the primary button. */
  destructive: boolean;
};

function moneyClause(name: string, cents: number): string {
  if (cents === 0) return `${name} stays the same`;
  const verb = cents > 0 ? "increases" : "decreases";
  return `${name} ${verb} by ${usdCents(Math.abs(cents))}`;
}

export function approveChangeOrderCopy(input: {
  jobNumber: string;
  label: string;
  /** Null when this priced order has no preview yet. */
  cbDeltaCents: number | null;
  eacDeltaCents: number | null;
  /** Set when approve would be refused. Shown instead of a budget move. */
  refusal: string | null;
}): ConfirmCopy {
  let description: string;
  if (input.refusal) description = input.refusal;
  else if (input.cbDeltaCents === null || input.eacDeltaCents === null)
    description =
      "Priced lines move into Current Budget. This cannot be undone.";
  else
    description = `${moneyClause("Current Budget", input.cbDeltaCents)} and ${moneyClause("EAC", input.eacDeltaCents)}. This cannot be undone.`;
  return {
    title: `Approve change order ${input.label} on ${input.jobNumber}?`,
    description,
    confirmLabel: "Approve change order",
    destructive: false,
  };
}

export function rejectChangeOrderCopy(input: {
  jobNumber: string;
  label: string;
  totalCents: number;
}): ConfirmCopy {
  return {
    title: `Reject change order ${input.label} on ${input.jobNumber}?`,
    description: `This removes ${usdCents(input.totalCents)} from pending changes. It does not enter Current Budget and cannot be undone.`,
    confirmLabel: "Reject change order",
    destructive: true,
  };
}

export function voidChangeOrderCopy(input: {
  jobNumber: string;
  label: string;
  status: string;
  totalCents: number;
}): ConfirmCopy {
  const amount = usdCents(input.totalCents);
  const description =
    input.status === "priced"
      ? `This removes ${amount} from pending changes and cannot be undone.`
      : `This ${amount} draft is not in pending changes or Current Budget. Voiding it cannot be undone.`;
  return {
    title: `Void change order ${input.label} on ${input.jobNumber}?`,
    description,
    confirmLabel: "Void change order",
    destructive: true,
  };
}

export function removePlanLineCopy(input: {
  jobNumber: string;
  crew: string;
  planDate: string;
  code: string;
  activity: string;
}): ConfirmCopy {
  const day = utcDay(input.planDate);
  return {
    title: `Remove ${input.code} from ${input.crew}'s plan?`,
    description: `Remove ${input.code} ${input.activity} from ${input.crew}'s plan for ${day} on ${input.jobNumber}. The line leaves this draft.`,
    confirmLabel: "Remove plan line",
    destructive: true,
  };
}

function reportWhen(input: {
  jobNumber: string;
  crew: string | null;
  planDate: string | null;
}): string | null {
  if (!input.crew || !input.planDate) return null;
  return `${input.crew}'s report for ${utcDay(input.planDate)}`;
}

export function approveReportCopy(input: {
  jobNumber: string;
  crew: string | null;
  planDate: string | null;
}): ConfirmCopy {
  const when = reportWhen(input);
  return {
    title: when
      ? `Approve ${when}?`
      : `Approve the daily report on ${input.jobNumber}?`,
    description: when
      ? `On ${input.jobNumber}, reported hours post to job cost and cannot be undone.`
      : "Reported hours post to job cost and cannot be undone.",
    confirmLabel: "Approve report",
    destructive: false,
  };
}

export function returnReportCopy(input: {
  jobNumber: string;
  crew: string | null;
  planDate: string | null;
}): ConfirmCopy {
  const when = reportWhen(input);
  return {
    title: when
      ? `Return ${when}?`
      : `Return the daily report on ${input.jobNumber}?`,
    description: when
      ? `On ${input.jobNumber}, the foreman keeps the reported values and nothing posts to cost.`
      : "The foreman keeps the reported values and nothing posts to cost.",
    confirmLabel: "Return report",
    destructive: false,
  };
}
