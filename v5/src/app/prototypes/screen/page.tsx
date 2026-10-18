import { ScreenShell } from "@/prototypes/screen-shell";
import { Switcher } from "@/prototypes/switcher";

export default function Page() {
  return (
    <>
      <Switcher active="screen" />
      <ScreenShell />
    </>
  );
}
