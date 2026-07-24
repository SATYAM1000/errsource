/**
 * Turn whatever was thrown into { message, stack }.
 * People throw anything: Errors, strings, objects, undefined —
 * and a promise's rejection "reason" is even less predictable.
 */
function normalizeError(input: unknown): { message: string; stack?: string } {
  if (input instanceof Error) {
    return { message: input.message || input.name, stack: input.stack };
  }
  if (typeof input === 'string') {
    return { message: input };
  }
  try {
    return { message: `non-Error thrown: ${JSON.stringify(input)}` };
  } catch {
    // circular object etc. — last resort
    return { message: `non-Error thrown: ${String(input)}` };
  }
}

export { normalizeError };
