"use server";
import { revalidatePath } from "next/cache";
import { db, runPipeline, publishAd } from "../mcp";
import type { GenerateAdArgs } from "../mcp";

export async function generateAdAction(args: GenerateAdArgs) {
  const result = await runPipeline(args);
  revalidatePath("/ads");
  revalidatePath("/");
  return result;
}

export async function approveAdAction(ad_id: string) {
  const row = (await db
    .prepare("SELECT status FROM ads WHERE id = ?")
    .get(ad_id)) as { status: string } | undefined;
  if (!row) throw new Error(`ad ${ad_id} not found`);
  if (row.status !== "draft") {
    throw new Error(`ad ${ad_id} is ${row.status}, cannot approve`);
  }
  await db.prepare("UPDATE ads SET status = 'approved' WHERE id = ?").run(ad_id);
  revalidatePath("/ads");
  revalidatePath(`/ads/${ad_id}`);
  return { ad_id, status: "approved" };
}

export async function publishAdAction(ad_id: string, when?: string) {
  const result = await publishAd({ ad_id, when });
  revalidatePath("/ads");
  revalidatePath(`/ads/${ad_id}`);
  revalidatePath("/calendar");
  return result;
}

export async function deleteAdAction(ad_id: string) {
  await db.prepare("DELETE FROM ads WHERE id = ?").run(ad_id);
  revalidatePath("/ads");
  revalidatePath("/");
  return { ad_id, deleted: true };
}

export async function updateCaptionsAction(ad_id: string, captions_json: string) {
  try {
    JSON.parse(captions_json);
  } catch {
    throw new Error("captions_json is not valid JSON");
  }
  await db.prepare("UPDATE ads SET captions_json = ? WHERE id = ?").run(
    captions_json,
    ad_id
  );
  revalidatePath(`/ads/${ad_id}`);
  return { ad_id, updated: true };
}
