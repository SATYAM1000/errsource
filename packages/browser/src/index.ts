import type { ErrorReport, ErrsourceOptions } from './types.ts';
import { normalizeError } from './normalize.ts';
import { send, shouldSend } from './transport.ts';

declare global {
  interface Window {
    /** Injected into index.html by @satyamx55/vite-plugin-errsource */
    __ERRSOURCE_RELEASE__?: string;
  }
}

type ResolvedConfig = Required<Omit<ErrsourceOptions, 'release'>> & {
  release: string;
};

let config: ResolvedConfig | null = null;

/**
 * Install the global error listeners. Call this ONCE, as early as
 * possible — the first lines of your entry file, before the app code.
 */
function init(options: ErrsourceOptions): void {
  if (config) {
    if (config.debug) console.warn('[errsource] init() called twice — ignored');
    return;
  }

  config = {
    endpoint: options.endpoint.replace(/\/+$/, ''),
    release: options.release ?? window.__ERRSOURCE_RELEASE__ ?? 'unknown',
    maxPerMinute: options.maxPerMinute ?? 10,
    dedupeMs: options.dedupeMs ?? 5000,
    debug: options.debug ?? false,
  };

  window.addEventListener('error', onErrorEvent);
  window.addEventListener('unhandledrejection', onRejectionEvent);

  if (config.debug) {
    console.log(`[errsource] initialized (release: ${config.release})`);
  }
}

/**
 * Report an error you caught yourself — a caught error never reaches
 * the global listeners, so try/catch blocks must opt in explicitly.
 */
function captureError(error: unknown, context?: Record<string, unknown>): void {
  try {
    capture(error, 'manual', context);
  } catch {
    // the error reporter must never become the error
  }
}

function onErrorEvent(event: ErrorEvent): void {
  try {
    // cross-origin scripts without CORS report only "Script error."
    // with no stack — nothing useful to symbolicate, skip
    if (!event.error && event.message === 'Script error.') return;
    capture(event.error ?? event.message, 'error');
  } catch {
    // never throw
  }
}

function onRejectionEvent(event: PromiseRejectionEvent): void {
  try {
    capture(event.reason, 'unhandledrejection');
  } catch {
    // never throw
  }
}

function capture(
  input: unknown,
  type: ErrorReport['type'],
  context?: Record<string, unknown>
): void {
  if (!config) return;

  const { message, stack } = normalizeError(input);
  const report: ErrorReport = {
    type,
    message,
    stack,
    release: config.release,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
  };

  if (!shouldSend(report, config.dedupeMs, config.maxPerMinute)) {
    if (config.debug) console.log('[errsource] dropped (dedupe/rate limit)');
    return;
  }

  if (config.debug) console.log('[errsource] reporting:', report.message);
  send(config.endpoint, report);
}

export { init, captureError };
export type { ErrsourceOptions, ErrorReport };
