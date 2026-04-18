import { getSavedEnv } from "@/lib/actions/setup";
import { getMcpSummaryAction } from "@/lib/actions/mcp-config";
import { getWebhookUrls } from "@/lib/actions/webhooks";
import { SettingsClient } from "@/components/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [env, mcp, webhooks] = await Promise.all([
    getSavedEnv(),
    getMcpSummaryAction(),
    getWebhookUrls(),
  ]);
  return <SettingsClient env={env} mcp={mcp} webhooks={webhooks} />;
}
