import { AssistantPanel } from "@/components/app/assistant-panel";
import { recentRuns } from "@/server/assistant/actions";
import { requireUser } from "@/server/session";

/** Server half: reads this sandbox's action runs so the transcript is the log. */
export async function Assistant({ variant }: { variant: "rail" | "page" }) {
  const user = await requireUser();
  const runs = await recentRuns(user);
  return <AssistantPanel runs={runs} variant={variant} />;
}
