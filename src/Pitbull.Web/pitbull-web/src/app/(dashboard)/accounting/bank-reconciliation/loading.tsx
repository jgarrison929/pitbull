import { TableSkeleton } from "@/components/skeletons";

export default function BankReconciliationLoading() {
  return <TableSkeleton headers={["Bank Name", "Account Name", "Last 4", "GL Account", "Type", "Status"]} rows={8} />;
}
