/** Help cards for deploy refresh + offline pin queue (3.2.7) */
export interface HelpFieldCard {
  id: string;
  title: string;
  steps: string[];
  href?: string;
}

export const HELP_DEPLOY_OFFLINE_CARDS: HelpFieldCard[] = [
  {
    id: "deploy-refresh",
    title: "App looks wrong after an update",
    steps: [
      "If you see a refresh banner after a deploy, tap Refresh now.",
      "Or hard-refresh the browser / relaunch the installed PWA.",
      "This reloads the latest shell so Server Actions match the server.",
    ],
    href: "/help",
  },
  {
    id: "offline-pin-queue",
    title: "Plan pin drafts while offline",
    steps: [
      "Pins you confirm offline are queued on this device.",
      "When you are online again, the app syncs queued pins.",
      "If sync fails, you will see an honest failure message - nothing is invented as sent.",
    ],
    href: "/plans-specs",
  },
  {
    id: "network-retry",
    title: "Slow or flaky network",
    steps: [
      "Read-only list loads may retry briefly on connection drops.",
      "Create/submit actions are not auto-retried to avoid double posts.",
      "If a submit fails, check the error toast and try again.",
    ],
  },
];

export function helpDeployOfflineCardIds(): string[] {
  return HELP_DEPLOY_OFFLINE_CARDS.map((c) => c.id);
}
