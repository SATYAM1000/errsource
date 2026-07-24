interface StackFrame {
  functionName?: string;
  /** full url of the bundle file, e.g. http://host/assets/index-abc.js */
  file: string;
  /** 1-based, as browsers report */
  line: number;
  column: number;
  /** the raw frame text, kept for display when we can't resolve it */
  raw: string;
}

/**
 * Chrome/Edge format:
 *   "    at boom (http://host/assets/index-abc.js:1:2400)"
 *   "    at http://host/assets/index-abc.js:1:2400"          (anonymous)
 *   "    at async loadData (http://host/assets/index-abc.js:1:99)"
 */
const CHROME_FRAME =
  /^\s*at\s+(?:(?:async\s+)?(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;

/**
 * Firefox/Safari format:
 *   "boom@http://host/assets/index-abc.js:1:2400"
 *   "@http://host/assets/index-abc.js:1:2400"                (anonymous)
 */
const GECKO_FRAME = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/;

function parseFrame(rawLine: string): StackFrame | null {
  const match = CHROME_FRAME.exec(rawLine) ?? GECKO_FRAME.exec(rawLine);
  if (!match) return null;

  const [, functionName, file, line, column] = match;
  // frames like "at <anonymous>" or eval frames have no real url — skip
  if (!file.includes('://')) return null;

  return {
    functionName: functionName || undefined,
    file,
    line: Number(line),
    column: Number(column),
    raw: rawLine.trim(),
  };
}

/**
 * A stack string is the message line(s) followed by one frame per line.
 * Unparseable lines are simply skipped — stack formats vary too much
 * to ever throw over them.
 */
function parseStack(stack: string): StackFrame[] {
  return stack
    .split('\n')
    .map(parseFrame)
    .filter((f): f is StackFrame => f !== null);
}

export { parseStack };
export type { StackFrame };
