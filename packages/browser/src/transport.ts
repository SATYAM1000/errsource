import type { ErrorReport } from './types.ts';

/** fingerprint → last time we sent it */
const recentlySent = new Map<string, number>();
/** timestamps of everything sent in the last minute */
let sentTimes: number[] = [];

/**
 * Client-side flood protection. An error inside a
 * requestAnimationFrame loop fires 60x per second — without this,
 * the SDK would DDoS its own server.
 */
function shouldSend(
  report: ErrorReport,
  dedupeMs: number,
  maxPerMinute: number
): boolean {
  const now = Date.now();
  const key = `${report.message}|${report.stack?.slice(0, 300) ?? ''}`;

  const lastSent = recentlySent.get(key);
  if (lastSent !== undefined && now - lastSent < dedupeMs) return false;

  sentTimes = sentTimes.filter((t) => now - t < 60_000);
  if (sentTimes.length >= maxPerMinute) return false;
  if (recentlySent.size > 100) recentlySent.clear();

  recentlySent.set(key, now);
  sentTimes.push(now);
  return true;
}

function send(endpoint: string, report: ErrorReport): void {
  try {
    void fetch(`${endpoint}/api/errors`, {
      method: 'POST',
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => {
      // swallow — the error reporter must never become the error
    });
  } catch {
    // same rule: never throw
  }
}

export { shouldSend, send };
