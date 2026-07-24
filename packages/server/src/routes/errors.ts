import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { symbolicate, formatFrames } from '../symbolicate/index.ts';
import { fingerprint, culpritOf } from '../fingerprint.ts';
import { recordEvent } from '../db.ts';
import { notifyNewIssue } from '../slack.ts';

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

    const frames = report.stack
      ? await symbolicate(report.release, report.stack)
      : [];

    const fp = fingerprint(report.message, frames);
    const { issue, isNew } = recordEvent(fp, culpritOf(frames), {
      type: report.type ?? 'error',
      message: report.message,
      release: report.release,
      url: report.url,
      userAgent: report.userAgent,
      frames,
      context: report.context,
    });

    console.log(
      `\n[errors] ${isNew ? 'NEW ISSUE' : `issue #${issue.id} (x${issue.count})`} [${report.type}] "${report.message}" @ ${report.release}`
    );
    if (frames.length > 0) console.log(formatFrames(frames));

    if (isNew) void notifyNewIssue(issue, frames);

    return c.json({ ok: true, issueId: issue.id });
  }
);

export { errors };
export type { ErrorReport };
