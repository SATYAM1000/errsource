type UploadResult = { ok: true } | { ok: false; reason: string };

interface UploadArgs {
  url: string;
  apiKey?: string;
  body: string;
  timeoutMs: number;
  retries: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function uploadWithRetry(args: UploadArgs): Promise<UploadResult> {
  const { url, apiKey, body, timeoutMs, retries } = args;
  let lastReason = 'unknown error';

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(1000 * 2 ** (attempt - 1));
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) return { ok: true };
      lastReason = `${res.status} ${res.statusText}`;
      if (res.status < 500 && res.status !== 429) {
        return { ok: false, reason: lastReason };
      }
    } catch (err) {
      lastReason = (err as Error).message;
    }
  }

  return { ok: false, reason: `${lastReason} (after ${retries + 1} attempts)` };
}

export { uploadWithRetry };
export type { UploadResult };
