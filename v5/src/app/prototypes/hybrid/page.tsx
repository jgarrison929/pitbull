import { HybridShell } from "@/prototypes/hybrid-shell";
import { Switcher } from "@/prototypes/switcher";

export default function Page() {
  return (
    <>
      <Switcher active="hybrid" />
      <HybridShell />
    </>
  );
}
