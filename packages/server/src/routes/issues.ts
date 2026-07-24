import { Hono } from 'hono';
import { requireApiKey } from '../auth.ts';
import { listIssues, issueEvents } from '../db.ts';

/**
 * Read API — issues contain code snippets, so it sits behind the
 * same key as map uploads. The future dashboard talks to this.
 */
const issues = new Hono();

issues.use('*', requireApiKey);

issues.get('/', (c) => c.json(listIssues()));

issues.get('/:id/events', (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'invalid id' }, 400);
  return c.json(issueEvents(id));
});

export { issues };
