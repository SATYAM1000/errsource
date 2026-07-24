import { execSync } from 'node:child_process';

function detectRelease(): string {
  try {
    const bufferOutput = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const gitHash = bufferOutput.toString().trim();
    return gitHash;
  } catch {
    return `local-${Date.now()}`;
  }
}

export { detectRelease };
