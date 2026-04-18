"use server";

const CF_BASE = "https://api.cloudflare.com/client/v4";

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, "content-type": "application/json" };
}

export interface CfAccount {
  id: string;
  name: string;
}

export async function verifyToken(token: string): Promise<{
  ok: boolean;
  accounts?: CfAccount[];
  error?: string;
}> {
  try {
    const verify = await fetch(`${CF_BASE}/user/tokens/verify`, {
      headers: auth(token),
      signal: AbortSignal.timeout(10_000),
    });
    if (!verify.ok) {
      const body = await verify.text();
      return { ok: false, error: `Token invalid: ${body.slice(0, 120)}` };
    }
    const accts = await fetch(`${CF_BASE}/accounts`, {
      headers: auth(token),
      signal: AbortSignal.timeout(10_000),
    });
    if (!accts.ok) return { ok: true, accounts: [] };
    const json = (await accts.json()) as {
      result?: Array<{ id: string; name: string }>;
    };
    return { ok: true, accounts: json.result ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createBucket(
  token: string,
  accountId: string,
  bucketName: string
): Promise<{ ok: boolean; created: boolean; error?: string }> {
  try {
    const res = await fetch(`${CF_BASE}/accounts/${accountId}/r2/buckets`, {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ name: bucketName }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true, created: true };
    const body = await res.text();
    // 409 means it already exists — treat as success for idempotency.
    if (res.status === 409 || body.includes("already exists")) {
      return { ok: true, created: false };
    }
    return { ok: false, created: false, error: `${res.status}: ${body.slice(0, 160)}` };
  } catch (err) {
    return {
      ok: false,
      created: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function enablePublicDevUrl(
  token: string,
  accountId: string,
  bucketName: string
): Promise<{ ok: boolean; publicUrl?: string; error?: string }> {
  try {
    const res = await fetch(
      `${CF_BASE}/accounts/${accountId}/r2/buckets/${bucketName}/domains/managed`,
      {
        method: "PUT",
        headers: auth(token),
        body: JSON.stringify({ enabled: true }),
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `${res.status}: ${body.slice(0, 160)}` };
    }
    const json = (await res.json()) as {
      result?: { domain?: string; enabled?: boolean };
    };
    const domain = json.result?.domain;
    if (!domain) return { ok: false, error: "dev URL missing from response" };
    const publicUrl = domain.startsWith("http") ? domain : `https://${domain}`;
    return { ok: true, publicUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  tokenId?: string;
  jurisdiction?: string;
}

export async function createS3Token(
  token: string,
  accountId: string,
  bucketName: string,
  tokenName = "ad-studio"
): Promise<{ ok: boolean; credentials?: S3Credentials; error?: string }> {
  try {
    // Cloudflare's R2-specific tokens endpoint returns S3-compatible credentials
    // scoped to a bucket. Shape from public docs:
    // POST /accounts/{id}/r2/tokens  body { name, policies[...], ttl? }
    const res = await fetch(`${CF_BASE}/accounts/${accountId}/r2/tokens`, {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({
        name: tokenName,
        policies: [
          {
            effect: "allow",
            actions: ["r2:GetObject", "r2:PutObject", "r2:DeleteObject"],
            resources: { buckets: [bucketName] },
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as {
      result?: {
        accessKeyId?: string;
        secretAccessKey?: string;
        tokenId?: string;
        access_key_id?: string;
        secret_access_key?: string;
        id?: string;
      };
    };
    const r = json.result ?? {};
    const credentials: S3Credentials = {
      accessKeyId: r.accessKeyId ?? r.access_key_id ?? "",
      secretAccessKey: r.secretAccessKey ?? r.secret_access_key ?? "",
      tokenId: r.tokenId ?? r.id,
    };
    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      return {
        ok: false,
        error: "Cloudflare returned no S3 credentials in response",
      };
    }
    return { ok: true, credentials };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Cloudflare does NOT expose a public API endpoint to create S3-compatible
// access key / secret pairs — those are dashboard-only. We provision what we
// can (bucket + public dev URL), then hand the user a one-click link to the
// exact dashboard page where they mint credentials.
export async function provisionR2(args: {
  token: string;
  accountId: string;
  bucketName: string;
}): Promise<{
  ok: boolean;
  bucketCreated?: boolean;
  publicUrl?: string;
  tokenDashboardUrl?: string;
  error?: string;
  step?: "bucket" | "dev_url";
}> {
  const create = await createBucket(args.token, args.accountId, args.bucketName);
  if (!create.ok) return { ok: false, step: "bucket", error: create.error };

  const dev = await enablePublicDevUrl(args.token, args.accountId, args.bucketName);
  if (!dev.ok) return { ok: false, step: "dev_url", error: dev.error };

  return {
    ok: true,
    bucketCreated: create.created,
    publicUrl: dev.publicUrl,
    tokenDashboardUrl: `https://dash.cloudflare.com/${args.accountId}/r2/api-tokens`,
  };
}
