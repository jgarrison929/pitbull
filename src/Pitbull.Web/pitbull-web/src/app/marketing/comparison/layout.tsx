import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Pitbull vs Procore vs Vista vs Sage | Construction Software Comparison",
  description:
    "Compare Pitbull Construction Solutions against Procore, Vista/Viewpoint, Sage 300 CRE, Foundation Software, and HCSS. One platform with every module at one price per user.",
};

export default function ComparisonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
