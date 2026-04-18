import { getSavedEnv } from "@/lib/actions/setup";
import { getMcpSummaryAction } from "@/lib/actions/mcp-config";
import { getWebhookUrls } from "@/lib/actions/webhooks";
import { getTierStatusAction } from "@/lib/actions/tier";
import { SettingsClient } from "@/components/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [env, mcp, webhooks, tier] = await Promise.all([
    getSavedEnv(),
    getMcpSummaryAction(),
    getWebhookUrls(),
    getTierStatusAction(),
  ]);
  return <SettingsClient env={env} mcp={mcp} webhooks={webhooks} tier={tier} />;
}
