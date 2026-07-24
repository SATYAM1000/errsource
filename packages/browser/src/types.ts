export interface ErrsourceOptions {
  /** errsource server base url, e.g. "https://errsource.example.com" */
  endpoint: string;
  /** Build id — defaults to window.__ERRSOURCE_RELEASE__ injected by the Vite plugin */
  release?: string;
  /** Max reports sent per minute; anything above is dropped (default: 10) */
  maxPerMinute?: number;
  /** Identical errors inside this window are sent only once (default: 5000) */
  dedupeMs?: number;
  /** Log SDK activity to the console (default: false) */
  debug?: boolean;
}

export interface ErrorReport {
  type: 'error' | 'unhandledrejection' | 'manual';
  message: string;
  stack?: string;
  release: string;
  url: string;
  userAgent: string;
  timestamp: string;
  /** Free-form extra info passed to captureError() */
  context?: Record<string, unknown>;
}
