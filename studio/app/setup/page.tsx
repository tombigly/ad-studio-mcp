import { redirect } from "next/navigation";
import { getSavedEnv } from "@/lib/actions/setup";
import { getWebhookUrls } from "@/lib/actions/webhooks";
import { SetupWizard } from "@/components/setup-wizard";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ force?: string }>;
}) {
  const { force } = await searchParams;
  const { configured, has } = await getSavedEnv();
  if (configured && !force) redirect("/");
  const webhooks = await getWebhookUrls();
  return <SetupWizard initialHas={has} initialWebhooks={webhooks} />;
}
