import { AssistantPanel } from "@/components/app/assistant-panel";
import type { DemoRole } from "@/lib/posthog-config";
import { recentRuns } from "@/server/assistant/actions";
import { requireUser } from "@/server/session";

/** Server half: reads this sandbox's action runs so the transcript is the log. */
export async function Assistant({
  variant,
  compact,
}: {
  variant: "rail" | "page";
  /** Foreman phone home: input + last 3 messages, rest behind Show conversation. */
  compact?: boolean;
}) {
  const user = await requireUser();
  const runs = await recentRuns(user);
  return (
    <AssistantPanel
      runs={runs}
      variant={variant}
      demoRole={user.role as DemoRole}
      compact={compact}
    />
  );
}
