"use server";
import { revalidatePath } from "next/cache";
import { getTierMode, setTierMode } from "../mcp";
import type { TierMode } from "../mcp";
import { saveEnvAction } from "./setup";

export async function getTierStatusAction(): Promise<{
  mode: TierMode;
  hasFreeKey: boolean;
}> {
  const mode = await getTierMode();
  const hasFreeKey = Boolean(process.env.GEMINI_API_KEY_FREE);
  return { mode, hasFreeKey };
}

export async function setTierAction(mode: TierMode) {
  await setTierMode(mode);
  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePath("/settings");
  return { mode };
}

export async function saveFreeTierKeyAction(key: string) {
  if (!key.trim()) throw new Error("Key cannot be empty");
  await saveEnvAction({ GEMINI_API_KEY_FREE: key.trim() });
  return { saved: true };
}
