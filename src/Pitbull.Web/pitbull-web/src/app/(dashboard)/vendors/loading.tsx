import { TableSkeleton } from "@/components/skeletons";

export default function VendorsLoading() {
  return <TableSkeleton headers={["Vendor", "Code", "Contact", "Terms", "Status", "Actions"]} rows={8} />;
}
