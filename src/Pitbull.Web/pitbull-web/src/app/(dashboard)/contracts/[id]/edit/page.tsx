"use client";

import { useParams } from "next/navigation";
import { SubcontractEditor } from "@/components/contracts/subcontract-editor";

export default function EditSubcontractPage() {
  const params = useParams();
  const id = params.id as string;

  return <SubcontractEditor mode="edit" subcontractId={id} />;
}
