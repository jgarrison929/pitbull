"use server";

import { revalidatePath } from "next/cache";
import { isActionName, run } from "@/server/assistant/actions";
import { requireUser } from "@/server/session";
import type { ScheduleImportSkipped } from "@/lib/schedule-import/types";

export type ScheduleImportState = {
  summary?: string;
  detailLines?: string[];
  skipped?: ScheduleImportSkipped[];
};

/**
 * Schedule page form → typed schedule.import* actions.
 * Reads the File from multipart FormData so a 10 MB XER fits under the
 * raised server-action body limit without base64 inflation.
 */
export async function runScheduleImportState(
  _prev: ScheduleImportState,
  formData: FormData,
): Promise<ScheduleImportState> {
  const action = formData.get("action");
  const label = String(formData.get("label") ?? action);
  if (
    action !== "schedule.importXer" &&
    action !== "schedule.importMspXml"
  ) {
    return {
      summary:
        "Choose a .xer or .xml file. Binary .mpp is not supported.",
    };
  }
  if (!isActionName(action)) return {};

  const job = String(formData.get("job") ?? "");
  const mode = String(formData.get("mode") ?? "replace");
  const upload = formData.get("upload");
  const fileName =
    (typeof formData.get("fileName") === "string" &&
      String(formData.get("fileName"))) ||
    (upload instanceof File ? upload.name : "");
  const fileBytes =
    upload instanceof File
      ? new Uint8Array(await upload.arrayBuffer())
      : new Uint8Array();

  const user = await requireUser();
  const { result } = await run(user, `${label} (button)`, action, {
    job: job || undefined,
    mode,
    fileName: fileName || undefined,
    fileBytes,
  });
  revalidatePath("/app", "layout");
  return {
    summary: result.summary,
    ...(result.detailLines?.length ? { detailLines: result.detailLines } : {}),
    ...(result.skipped?.length ? { skipped: result.skipped } : {}),
  };
}
