import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';
import type { SymbolicatedFrame } from './symbolicate/index.ts';

const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS issues (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT UNIQUE NOT NULL,
    title       TEXT NOT NULL,
    culprit     TEXT,
    status      TEXT NOT NULL DEFAULT 'open',
    count       INTEGER NOT NULL DEFAULT 0,
    first_seen  TEXT NOT NULL,
    last_seen   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id    INTEGER NOT NULL REFERENCES issues(id),
    type        TEXT NOT NULL,
    message     TEXT NOT NULL,
    release     TEXT NOT NULL,
    url         TEXT,
    user_agent  TEXT,
    frames_json TEXT,
    context_json TEXT,
    received_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_events_issue ON events(issue_id);
`);

interface IssueRow {
  id: number;
  fingerprint: string;
  title: string;
  culprit: string | null;
  status: string;
  count: number;
  first_seen: string;
  last_seen: string;
}

interface StoredEvent {
  type: string;
  message: string;
  release: string;
  url?: string;
  userAgent?: string;
  frames: SymbolicatedFrame[];
  context?: Record<string, unknown>;
}

/**
 * Insert the event, creating or bumping its issue.
 * Returns the issue plus whether this fingerprint is brand new —
 * the caller alerts Slack only on new ones.
 */
function recordEvent(
  fingerprint: string,
  culprit: string | null,
  event: StoredEvent
): { issue: IssueRow; isNew: boolean } {
  const now = new Date().toISOString();

  const existing = db
    .prepare('SELECT * FROM issues WHERE fingerprint = ?')
    .get(fingerprint) as IssueRow | undefined;

  let issue: IssueRow;
  if (existing) {
    db.prepare(
      'UPDATE issues SET count = count + 1, last_seen = ?, culprit = COALESCE(?, culprit) WHERE id = ?'
    ).run(now, culprit, existing.id);
    issue = { ...existing, count: existing.count + 1, last_seen: now };
  } else {
    const res = db
      .prepare(
        `INSERT INTO issues (fingerprint, title, culprit, count, first_seen, last_seen)
         VALUES (?, ?, ?, 1, ?, ?)`
      )
      .run(fingerprint, event.message.slice(0, 300), culprit, now, now);
    issue = {
      id: Number(res.lastInsertRowid),
      fingerprint,
      title: event.message.slice(0, 300),
      culprit,
      status: 'open',
      count: 1,
      first_seen: now,
      last_seen: now,
    };
  }

  db.prepare(
    `INSERT INTO events (issue_id, type, message, release, url, user_agent, frames_json, context_json, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    issue.id,
    event.type,
    event.message,
    event.release,
    event.url ?? null,
    event.userAgent ?? null,
    JSON.stringify(event.frames),
    event.context ? JSON.stringify(event.context) : null,
    now
  );

  return { issue, isNew: !existing };
}

function listIssues(): IssueRow[] {
  return db
    .prepare('SELECT * FROM issues ORDER BY last_seen DESC LIMIT 100')
    .all() as unknown as IssueRow[];
}

function issueEvents(issueId: number): unknown[] {
  return db
    .prepare(
      'SELECT * FROM events WHERE issue_id = ? ORDER BY received_at DESC LIMIT 50'
    )
    .all(issueId);
}

export { recordEvent, listIssues, issueEvents };
export type { IssueRow, StoredEvent };
