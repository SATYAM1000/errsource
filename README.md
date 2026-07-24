# @satyamx/vite-plugin-errsource

A Vite plugin that uploads your production source maps to your own server at build time — so minified stack traces like `index-DkA9f3.js:1:45231` can be resolved back to the real file, line, and code that caused the error.

Part of **errsource**, a self-hosted error tracker: this plugin (build time) + a browser SDK (error capture) + a symbolication server (stack trace → original source + Slack alerts).

## Why

When an error happens in production, the browser reports positions inside your minified bundle — one giant line, meaningless column numbers. The source maps that could decode them shouldn't be deployed publicly (they contain your entire source code). This plugin solves both problems:

- builds with `sourcemap: "hidden"` — maps are generated, but the bundle carries no `//# sourceMappingURL=` comment, so visitors' browsers never see them
- uploads every `.map` file to **your** errsource server, keyed by a release id (your git commit hash)
- injects `window.__ERRSOURCE_RELEASE__` into your `index.html`, so error reports can be matched to the exact maps of the build that produced them
- deletes the `.map` files from `dist/` after upload, so a static deploy can't leak them

## Install

```bash
npm install -D @satyamx/vite-plugin-errsource
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import errsource from '@satyamx/vite-plugin-errsource';

export default defineConfig({
  plugins: [
    errsource({
      serverUrl: 'https://errsource.example.com',
      failOnError: !!process.env.CI, // strict in CI, lenient locally
    }),
  ],
});
```

Pass the API key through the environment instead of hardcoding it:

```bash
ERRSOURCE_API_KEY=your-secret npm run build
```

The plugin only runs during `vite build` — it does nothing in dev, where stack traces already point at your real files.

## Options

| Option        | Type      | Default                         | Description                                                              |
| ------------- | --------- | ------------------------------- | ------------------------------------------------------------------------ |
| `serverUrl`   | `string`  | — (required)                    | Your errsource server. Maps are POSTed to `{serverUrl}/api/sourcemaps`.  |
| `apiKey`      | `string`  | `process.env.ERRSOURCE_API_KEY` | Sent as `Authorization: Bearer <key>` with every upload.                 |
| `release`     | `string`  | current git commit hash         | Unique id for this build. Falls back to `local-<timestamp>` outside git. |
| `cleanupMaps` | `boolean` | `true`                          | Delete `.map` files from the output dir after upload.                    |
| `failOnError` | `boolean` | `false`                         | Fail the build (non-zero exit) if any upload fails. Recommended in CI.   |
| `timeoutMs`   | `number`  | `10000`                         | Per-upload timeout.                                                      |
| `retries`     | `number`  | `3`                             | Retry attempts per map — network errors, timeouts, 5xx and 429 only.     |
| `concurrency` | `number`  | `5`                             | How many maps upload in parallel.                                        |

## How it works

1. **`config`** — if you haven't set `build.sourcemap` yourself, the plugin sets it to `"hidden"`. An explicit setting of yours is always respected.
2. **`transformIndexHtml`** — injects `<script>window.__ERRSOURCE_RELEASE__="<release>"</script>` so the browser SDK can stamp every error report with the build it came from.
3. **`writeBundle`** — after Vite writes `dist/`, the plugin collects every `.map` asset and uploads them (in parallel, with timeout + exponential-backoff retries) as JSON: `{ release, fileName, map }`. Failed uploads are reported per file; with `failOnError` the build aborts.
4. **Cleanup** — uploaded maps are removed from `dist/`, so deploying the folder never publishes your source.

## Security notes

- The API key is used **only at build time, in Node** — it is never part of the bundle and never reaches the browser. Don't prefix it with `VITE_`, or Vite will inline it into client code.
- Source maps contain your complete original source (`sourcesContent`). Keep the upload endpoint authenticated and treat the server's storage as private.

## License

MIT © Satyam Kumar
