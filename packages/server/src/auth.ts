import type { MiddlewareHandler } from 'hono';
import { config } from './config.ts';

let warnedNoKey = false;

/**
 * Bearer auth for private endpoints (map uploads, issue browsing).
 * With no ERRSOURCE_API_KEY configured we run in dev mode and accept
 * everything — convenient locally, loudly warned about.
 */
const requireApiKey: MiddlewareHandler = async (c, next) => {
  if (!config.apiKey) {
    if (!warnedNoKey) {
      console.warn(
        '[auth] ERRSOURCE_API_KEY is not set — accepting ALL private requests (dev mode only!)'
      );
      warnedNoKey = true;
    }
    return next();
  }
  if (c.req.header('authorization') !== `Bearer ${config.apiKey}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return next();
};

export { requireApiKey };
