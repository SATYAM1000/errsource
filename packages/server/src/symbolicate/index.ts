import { SourceMapConsumer } from 'source-map-js';
import { loadMap } from '../storage.ts';
import { parseStack } from './parse-stack.ts';
import type { StackFrame } from './parse-stack.ts';

interface SymbolicatedFrame {
  /** original minified frame, always present */
  raw: string;
  /** true when the frame was resolved through a source map */
  resolved: boolean;
  functionName?: string;
  /** original file, e.g. "src/main.ts" */
  source?: string;
  line?: number;
  column?: number;
  /** surrounding original code, formatted with line numbers and a marker */
  snippet?: string;
}

/**
 * Parsing a big source map is expensive — cache consumers per
 * (release, mapFile). Bounded so a flood of releases can't eat memory.
 */
const consumerCache = new Map<string, SourceMapConsumer | null>();

async function getConsumer(
  release: string,
  mapFile: string
): Promise<SourceMapConsumer | null> {
  const key = `${release}/${mapFile}`;
  const cached = consumerCache.get(key);
  if (cached !== undefined) return cached;

  if (consumerCache.size > 50) consumerCache.clear();

  const raw = await loadMap(release, mapFile);
  let consumer: SourceMapConsumer | null = null;
  if (raw) {
    try {
      consumer = new SourceMapConsumer(JSON.parse(raw));
    } catch {
      consumer = null; // corrupt map — treat as missing
    }
  }
  // negative results are cached too: a missing map stays missing
  consumerCache.set(key, consumer);
  return consumer;
}

/** "../../src/main.ts" → "src/main.ts" — map sources are relative to the map's location in dist/assets */
function cleanSourcePath(source: string): string {
  return source.replace(/^(\.\.\/)+/, '').replace(/^webpack:\/\/\//, '');
}

function buildSnippet(content: string, errorLine: number): string {
  const lines = content.split('\n');
  const from = Math.max(0, errorLine - 4);
  const to = Math.min(lines.length, errorLine + 3);

  return lines
    .slice(from, to)
    .map((text, i) => {
      const lineNo = from + i + 1;
      const marker = lineNo === errorLine ? '→' : ' ';
      return ` ${marker} ${String(lineNo).padStart(4)} | ${text}`;
    })
    .join('\n');
}

async function symbolicateFrame(
  release: string,
  frame: StackFrame
): Promise<SymbolicatedFrame> {
  const unresolved: SymbolicatedFrame = { raw: frame.raw, resolved: false };

  // "http://host/assets/index-abc.js" → "assets/index-abc.js.map"
  let mapFile: string;
  try {
    mapFile = `${new URL(frame.file).pathname.replace(/^\//, '')}.map`;
  } catch {
    return unresolved;
  }

  const consumer = await getConsumer(release, mapFile);
  if (!consumer) return unresolved;

  const pos = consumer.originalPositionFor({
    line: frame.line,
    column: frame.column,
  });
  if (!pos.source || pos.line == null) return unresolved;

  const content = consumer.sourceContentFor(pos.source, true);

  return {
    raw: frame.raw,
    resolved: true,
    functionName: pos.name ?? frame.functionName,
    source: cleanSourcePath(pos.source),
    line: pos.line,
    column: pos.column != null ? pos.column + 1 : undefined,
    snippet: content ? buildSnippet(content, pos.line) : undefined,
  };
}

/**
 * The whole point of errsource: minified stack in, original
 * file:line:column + code snippets out.
 */
async function symbolicate(
  release: string,
  stack: string
): Promise<SymbolicatedFrame[]> {
  const frames = parseStack(stack);
  return Promise.all(frames.map((f) => symbolicateFrame(release, f)));
}

/** Render symbolicated frames for terminal / plain-text output. */
function formatFrames(frames: SymbolicatedFrame[]): string {
  const out: string[] = [];
  for (const frame of frames) {
    if (frame.resolved) {
      const fn = frame.functionName ?? '<anonymous>';
      out.push(`  at ${fn} (${frame.source}:${frame.line}:${frame.column})`);
      if (frame.snippet) out.push('', frame.snippet, '');
    } else {
      out.push(`  at ${frame.raw} [unresolved]`);
    }
  }
  return out.join('\n');
}

export { symbolicate, formatFrames };
export type { SymbolicatedFrame };
