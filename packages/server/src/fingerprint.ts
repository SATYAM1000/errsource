import { createHash } from 'node:crypto';
import type { SymbolicatedFrame } from './symbolicate/index.ts';

/**
 * Two reports are "the same issue" when they share a fingerprint.
 * We hash the normalized message + the top original code locations:
 *
 * - numbers are stripped from the message so "id 123 not found" and
 *   "id 456 not found" group together
 * - resolved frames are keyed by original source:line — stable across
 *   releases even though minified positions shift on every build
 * - unresolved frames fall back to the raw frame text
 */
function fingerprint(message: string, frames: SymbolicatedFrame[]): string {
  const normalizedMessage = message.replace(/\d+/g, 'N').slice(0, 200);

  const resolved = frames.filter((f) => f.resolved);
  const frameKey =
    resolved.length > 0
      ? resolved
          .slice(0, 5)
          .map((f) => `${f.source}:${f.line}`)
          .join('|')
      : frames
          .slice(0, 5)
          .map((f) => f.raw)
          .join('|');

  return createHash('sha256')
    .update(`${normalizedMessage}::${frameKey}`)
    .digest('hex')
    .slice(0, 16);
}

/** "src/main.ts:7" of the topmost resolved frame — the issue's one-line home address. */
function culpritOf(frames: SymbolicatedFrame[]): string | null {
  const top = frames.find((f) => f.resolved);
  return top ? `${top.source}:${top.line}` : null;
}

export { fingerprint, culpritOf };
