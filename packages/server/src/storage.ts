import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { config } from './config.ts';

/**
 * `release` and `fileName` come from an HTTP request — never trust
 * them as paths. Rejects traversal ("../"), absolute paths and
 * anything else that could escape our storage namespace.
 */
function assertSafe(release: string, fileName: string): void {
  const ok = (s: string) =>
    s.length > 0 &&
    !s.startsWith('/') &&
    !s.includes('\\') &&
    !s.split('/').includes('..') &&
    !s.split('/').includes('');
  if (!ok(release) || release.includes('/') || !ok(fileName)) {
    throw new Error(`unsafe storage path: ${release}/${fileName}`);
  }
}

// ---------- S3 driver (used when S3_BUCKET is set) ----------

const s3 = config.s3Bucket ? new S3Client({ region: config.awsRegion }) : null;

function s3Key(release: string, fileName: string): string {
  return `${config.s3Prefix}/${release}/${fileName}`;
}

// ---------- local-disk driver (dev fallback) ----------

const localRoot = path.resolve(config.storageDir);

function localPath(release: string, fileName: string): string {
  const full = path.resolve(localRoot, release, fileName);
  // belt and suspenders on top of assertSafe
  if (!full.startsWith(localRoot + path.sep)) {
    throw new Error(`path traversal attempt: ${release}/${fileName}`);
  }
  return full;
}

// ---------- public api ----------

async function saveMap(
  release: string,
  fileName: string,
  map: string
): Promise<void> {
  assertSafe(release, fileName);

  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: s3Key(release, fileName),
        Body: map,
        ContentType: 'application/json',
      })
    );
    return;
  }

  const file = localPath(release, fileName);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, map, 'utf8');
}

/** Returns the raw map JSON, or null if we never received it. */
async function loadMap(
  release: string,
  fileName: string
): Promise<string | null> {
  try {
    assertSafe(release, fileName);

    if (s3) {
      const res = await s3.send(
        new GetObjectCommand({
          Bucket: config.s3Bucket,
          Key: s3Key(release, fileName),
        })
      );
      return (await res.Body?.transformToString()) ?? null;
    }

    return await readFile(localPath(release, fileName), 'utf8');
  } catch {
    return null;
  }
}

const storageDescription = s3
  ? `s3://${config.s3Bucket}/${config.s3Prefix}/`
  : `${config.storageDir}/ (local disk — set S3_BUCKET for S3)`;

export { saveMap, loadMap, storageDescription };
