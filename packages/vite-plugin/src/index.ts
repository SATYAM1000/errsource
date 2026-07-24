import type { Plugin, ResolvedConfig } from 'vite';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { detectRelease, pMap, uploadWithRetry } from './helpers/index.ts';

export interface ErrorSourceOptions {
  /** Server url where the maps will be uploaded */
  serverUrl: string;
  /** Auth token — defaults to the ERRSOURCE_API_KEY env variable */
  apiKey?: string;
  /** Unique id for the build — defaults to the current git commit hash */
  release?: string;
  /** Delete .map files from dist after upload so they never get deployed (default: true) */
  cleanupMaps?: boolean;
  /** Fail the whole build if any upload fails — turn on in CI (default: false) */
  failOnError?: boolean;
  /** Per-upload timeout in ms (default: 10_000) */
  timeoutMs?: number;
  /** Retry attempts per map on network errors / 5xx (default: 3) */
  retries?: number;
  /** How many maps to upload in parallel (default: 5) */
  concurrency?: number;
}

function errorSource(options: ErrorSourceOptions): Plugin {
  const release = options.release ?? detectRelease();
  const apiKey = options.apiKey ?? process.env.ERRSOURCE_API_KEY;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = options.retries ?? 3;
  const concurrency = options.concurrency ?? 5;
  let config: ResolvedConfig;

  return {
    name: 'vite-plugin-errsource',
    apply: 'build',
    config(userConfig) {
      if (userConfig.build?.sourcemap === undefined) {
        return { build: { sourcemap: 'hidden' } };
      }
    },
    configResolved(resolved) {
      config = resolved;
    },
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: `window.__ERRSOURCE_RELEASE__=${JSON.stringify(release)};`,
          injectTo: 'head-prepend',
        },
      ];
    },
    async writeBundle(_outputOptions, bundle) {
      const maps = Object.entries(bundle).filter(
        ([fileName, output]) =>
          fileName.endsWith('.map') && output.type === 'asset'
      );

      if (maps.length === 0) {
        config.logger.warn(
          '[errsource] no source maps in the bundle — is build.sourcemap set to false?'
        );
        return;
      }

      const results = await pMap(
        maps,
        async ([fileName, asset]) => {
          if (asset.type !== 'asset') return { fileName, ok: true as const };

          const result = await uploadWithRetry({
            url: `${options.serverUrl}/api/sourcemaps`,
            apiKey,
            timeoutMs,
            retries,
            body: JSON.stringify({
              release,
              fileName,
              map: asset.source.toString(),
            }),
          });

          if (result.ok) {
            config.logger.info(`[errsource] uploaded ${fileName}`);
            return { fileName, ok: true as const };
          }
          return { fileName, ok: false as const, reason: result.reason };
        },
        concurrency
      );

      const failed = results.filter((r) => !r.ok);
      config.logger.info(
        `[errsource] release ${release}: ${results.length - failed.length}/${results.length} maps uploaded`
      );

      if (failed.length > 0) {
        const details = failed
          .map((f) => `  ${f.fileName}: ${'reason' in f ? f.reason : ''}`)
          .join('\n');
        if (options.failOnError) {
          // this.error throws — the build exits non-zero
          this.error(
            `[errsource] ${failed.length} upload(s) failed:\n${details}`
          );
        }
        this.warn(`[errsource] ${failed.length} upload(s) failed:\n${details}`);
      }

      if (options.cleanupMaps !== false) {
        const outDir = path.resolve(config.root, config.build.outDir);
        await Promise.all(
          maps.map(([fileName]) =>
            rm(path.join(outDir, fileName), { force: true })
          )
        );
        config.logger.info(
          `[errsource] removed ${maps.length} map file(s) from ${config.build.outDir}`
        );
      }
    },
  };
}

export default errorSource;
