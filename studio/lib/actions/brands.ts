"use server";
import { revalidatePath } from "next/cache";
import { db, createBrand, enrichBrandFromUrl } from "../mcp";

export interface CreateBrandInput {
  name: string;
  url?: string;
  voice?: string;
  audiences?: string[];
  pillars?: string[];
  do_list?: string[];
  dont_list?: string[];
}

export async function createBrandAction(input: CreateBrandInput) {
  const result = await createBrand(input);
  revalidatePath("/brands");
  revalidatePath("/");
  return result;
}

export async function enrichBrandAction(brand_id: string, url?: string) {
  const result = await enrichBrandFromUrl({ brand_id, url });
  revalidatePath(`/brands/${brand_id}`);
  revalidatePath("/brands");
  return result;
}

export async function deleteBrandAction(brand_id: string) {
  await db.prepare("DELETE FROM brands WHERE id = ?").run(brand_id);
  revalidatePath("/brands");
  revalidatePath("/");
  return { brand_id, deleted: true };
}

export async function updateBrandJsonAction(brand_id: string, brand_json: string) {
  // Validate JSON before writing
  try {
    JSON.parse(brand_json);
  } catch {
    throw new Error("brand_json is not valid JSON");
  }
  await db.prepare("UPDATE brands SET brand_json = ? WHERE id = ?").run(brand_json, brand_id);
  revalidatePath(`/brands/${brand_id}`);
  return { brand_id, updated: true };
}
