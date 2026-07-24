import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { config } from '../config.ts';
import { saveMap } from '../storage.ts';

const sourcemaps = new Hono();

let warnedNoKey = false;

/** Bearer auth — this endpoint receives your source code, keep it locked. */
sourcemaps.use('*', async (c, next) => {
  if (!config.apiKey) {
    if (!warnedNoKey) {
      console.warn(
        '[auth] ERRSOURCE_API_KEY is not set — accepting ALL uploads (dev mode only!)'
      );
      warnedNoKey = true;
    }
    return next();
  }
  if (c.req.header('authorization') !== `Bearer ${config.apiKey}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return next();
});

sourcemaps.post(
  '/',
  // source maps are big, but not infinitely big
  bodyLimit({ maxSize: 50 * 1024 * 1024 }),
  async (c) => {
    const body = await c.req
      .json<{ release?: string; fileName?: string; map?: string }>()
      .catch(() => null);

    if (!body?.release || !body.fileName || typeof body.map !== 'string') {
      return c.json({ error: 'expected { release, fileName, map }' }, 400);
    }

    try {
      await saveMap(body.release, body.fileName, body.map);
    } catch (err) {
      console.warn(`[maps] rejected: ${(err as Error).message}`);
      return c.json({ error: 'invalid fileName' }, 400);
    }

    console.log(
      `[maps] stored ${body.fileName} @ ${body.release} (${body.map.length} bytes)`
    );
    return c.json({ ok: true });
  }
);

export { sourcemaps };
