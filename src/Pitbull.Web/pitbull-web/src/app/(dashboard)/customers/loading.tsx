import { TableSkeleton } from "@/components/skeletons";

export default function CustomersLoading() {
  return <TableSkeleton headers={["Customer", "Code", "Contact", "Credit Limit", "Status", "Actions"]} rows={8} />;
}
