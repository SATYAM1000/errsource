import { config } from './config.ts';
import type { IssueRow } from './db.ts';
import type { SymbolicatedFrame } from './symbolicate/index.ts';

/**
 * Alert on NEW issues only — the issue row already deduplicates, so
 * a crash loop produces one message, not one per occurrence.
 */
async function notifyNewIssue(
  issue: IssueRow,
  frames: SymbolicatedFrame[]
): Promise<void> {
  if (!config.slackWebhookUrl) return;

  const top = frames.find((f) => f.resolved);
  const location = top
    ? `\`${top.source}:${top.line}:${top.column}\``
    : '_could not symbolicate — is the release’s source map uploaded?_';
  const snippet = top?.snippet ? `\`\`\`\n${top.snippet}\n\`\`\`` : '';

  const text = [
    `:rotating_light: *New issue*: ${issue.title}`,
    `at ${location}`,
    snippet,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await fetch(config.slackWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    // alerting must never take down ingestion
    console.warn(`[slack] notification failed: ${(err as Error).message}`);
  }
}

export { notifyNewIssue };
