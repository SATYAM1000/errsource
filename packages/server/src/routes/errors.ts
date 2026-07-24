import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { symbolicate, formatFrames } from '../symbolicate/index.ts';

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

    console.log(
      `\n[errors] [${report.type}] "${report.message}" @ release ${report.release}`
    );

    if (report.stack) {
      const frames = await symbolicate(report.release, report.stack);
      console.log(formatFrames(frames));
    }
    if (report.context) {
      console.log(`  context: ${JSON.stringify(report.context)}`);
    }

    return c.json({ ok: true });
  }
);

export { errors };
export type { ErrorReport };
