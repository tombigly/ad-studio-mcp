// Retry wrapper for Gemini calls. Free tier allows ~15 req/min per model on
// gemini-2.5-flash and fewer on image models; bursts from the UI + pipeline
// hit 429 quickly. Retry transient rate-limit/availability errors with
// exponential backoff + jitter.
const RETRYABLE_MARKERS = [
  "429",
  "RESOURCE_EXHAUSTED",
  "rate limit",
  "quota",
  "503",
  "UNAVAILABLE",
  "deadline",
  "ECONNRESET",
  "ETIMEDOUT",
];

function isRetryable(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return RETRYABLE_MARKERS.some((m) => msg.includes(m.toLowerCase()));
}

function describeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Strip very long payloads so user-facing text stays readable.
  if (msg.length > 400) return msg.slice(0, 400) + "...";
  return msg;
}

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default 4. */
  maxAttempts?: number;
  /** Base delay in ms. Default 1500. Delay grows 2^attempt up to maxDelay. */
  baseDelayMs?: number;
  /** Ceiling for the per-try delay. Default 15000. */
  maxDelayMs?: number;
  /** Optional human label for error messages and logs. */
  label?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const max = opts.maxAttempts ?? 4;
  const base = opts.baseDelayMs ?? 1500;
  const ceil = opts.maxDelayMs ?? 15000;
  const label = opts.label ?? "gemini";

  let lastErr: unknown;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === max - 1) {
        throw new Error(
          `${label}: ${describeError(err)}${
            isRetryable(err) ? ` (retried ${attempt} times)` : ""
          }`
        );
      }
      const delay = Math.min(base * 2 ** attempt, ceil) + Math.random() * 500;
      console.error(
        `[${label}] attempt ${attempt + 1}/${max} failed; retrying in ${Math.round(
          delay
        )}ms — ${describeError(err).slice(0, 120)}`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
