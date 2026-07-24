import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { config } from './config.ts';
import { storageDescription } from './storage.ts';
import { sourcemaps } from './routes/sourcemaps.ts';
import { errors } from './routes/errors.ts';

const app = new Hono();

app.use(logger());
app.get('/health', (c) => c.json({ ok: true }));
app.route('/api/sourcemaps', sourcemaps);
app.route('/api/errors', errors);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`errsource server listening on :${info.port}`);
  console.log(`storing maps in ${storageDescription}`);
});
