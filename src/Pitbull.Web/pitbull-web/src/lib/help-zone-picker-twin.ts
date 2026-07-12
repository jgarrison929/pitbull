/**
 * Help Center — field zone picker + Digital Twin fuel (2.18.8).
 * Honest: optional by default; required only when company enables RequireSpatialOnProgress.
 * Demo may skip. Empty zones ≠ all-clear.
 */

export const ZONE_PICKER_TWIN_SECTION_TITLE =
  "Field zone picker and Digital Twin";

export type ZonePickerHelpBullet = {
  id: string;
  title: string;
  body: string;
};

export const zonePickerTwinBullets: ZonePickerHelpBullet[] = [
  {
    id: "where-picker",
    title: "Where is the zone picker?",
    body:
      "On the mobile daily report (`/daily-reports/mobile`), pick a job first. When the project has twin zones, a Zone select appears under project/date. You can also deep-link with `?zoneId=` from Digital Twin “report in this zone.”",
  },
  {
    id: "optional-default",
    title: "Optional by default",
    body:
      "Zone is optional unless your company turns on Require spatial zone on progress under Settings → Projects. Drafts can always save without a zone.",
  },
  {
    id: "when-required",
    title: "When zone is required",
    body:
      "If the company setting is on and the job has zones, non-draft submit needs a zone. The field shows “Zone (required)” and blocks submit with a clear toast. Production users are not inventing green progress without a ref.",
  },
  {
    id: "demo-skip",
    title: "Demo skip",
    body:
      "Demo personas (Explore as a role) may skip the zone even when the company setting is on, so walkthroughs stay unblocked. Production still enforces.",
  },
  {
    id: "twin-fuel",
    title: "How it fuels Digital Twin",
    body:
      "Choosing a zone links the daily report’s SpatialNodeId so zone drill, photo pins, and overlays can show real field fuel. Empty zone panels stay neutral gray — never all-clear green by default.",
  },
  {
    id: "quality-metric",
    title: "Capture quality (not a KPI)",
    body:
      "PMs can use `GET /api/projects/{id}/spatial/capture-quality` for a labeled data-quality % of recent reports/progress with a spatial ref. It is not an executive vanity KPI.",
  },
];

export const zonePickerTwinSteps: string[] = [
  "Open a project with Spatial.View → Digital Twin at `/projects/{id}/twin`.",
  "Ensure zones exist (seed graph if needed) so the field Zone picker has options.",
  "On mobile daily report, select the same job → pick a zone → submit.",
  "Return to twin zone drill to see linked reports / photos when data exists.",
  "Never treat empty or gray twin panels as “all clear.”",
];

export function zonePickerTwinHelpBlob(): string {
  return [
    ZONE_PICKER_TWIN_SECTION_TITLE,
    ...zonePickerTwinBullets.map((b) => `${b.title}: ${b.body}`),
    ...zonePickerTwinSteps,
  ].join("\n");
}
