import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

interface ErrorReport {
  type: 'error' | 'unhandledrejection' | 'manual';
  message: string;
  stack?: string;
  release: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  context?: Record<string, unknown>;
}

const errors = new Hono();

/**
 * PUBLIC ingest endpoint — called from visitors' browsers, so it can
 * never hold a secret. Its defenses are shape validation, size limits
 * and (coming later) rate limiting. Worst case abuse = noise, never
 * a leak: source maps only ever leave this server as symbolicated
 * frames, not as raw files.
 */
errors.post(
  '/',
  // an error report is a few KB; anything bigger is not an error report
  bodyLimit({ maxSize: 100 * 1024 }),
  async (c) => {
    // note: .json() regardless of content-type — the SDK deliberately
    // sends text/plain to avoid a CORS preflight
    const report = await c.req.json<ErrorReport>().catch(() => null);

    if (
      !report ||
      typeof report.message !== 'string' ||
      typeof report.release !== 'string'
    ) {
      return c.json({ error: 'invalid report' }, 400);
    }

    // milestone 2: symbolicate report.stack against the stored maps here
    console.log(
      `[errors] [${report.type}] "${report.message}" @ release ${report.release}`
    );
    if (report.stack) {
      console.log(
        report.stack
          .split('\n')
          .map((l) => `    ${l.trim()}`)
          .join('\n')
      );
    }

    return c.json({ ok: true });
  }
);

export { errors };
export type { ErrorReport };
