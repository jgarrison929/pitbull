import { AgentShell } from "@/prototypes/agent-shell";
import { Switcher } from "@/prototypes/switcher";

export default function Page() {
  return (
    <>
      <Switcher active="agent" />
      <AgentShell />
    </>
  );
}
