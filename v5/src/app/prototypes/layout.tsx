import type { Metadata } from "next";

// Prototypes are reachable by URL only: no link from the app, and search engines are told to skip them.
export const metadata: Metadata = {
  title: "Pitbull · M1 shell prototypes",
  robots: { index: false, follow: false },
};

export default function PrototypesLayout({
  children,
}: LayoutProps<"/prototypes">) {
  return children;
}
