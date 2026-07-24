# errsource

Self-hosted error tracking for Vite apps — see the real file, line, and code behind every minified production error, with alerts in Slack.

```
[errors] NEW ISSUE [error] "Cannot read properties of undefined (reading 'map')"
  at boom (src/main.ts:7:23)

      5 | function boom(input: { items?: string[] }) {
      6 |   // throws at runtime when items is undefined
 →    7 |   return input.items!.map((s) => s.toUpperCase());
      8 | }
```

## Try it in 3 minutes

Requires Node 24+.

```bash
git clone https://github.com/SATYAM1000/errsource.git
cd errsource
npm install

# terminal 1 — the errsource server (local storage, no config needed)
npm run server

# terminal 2 — build the example app (uploads its source maps) and serve it
npm run demo:build
npm run demo
```

Open http://localhost:4300 and click a button. Watch terminal 1: the
minified stack trace from your browser arrives symbolicated back to
`src/main.ts` with a code snippet. Click the same button again — the
issue's count goes up instead of creating a duplicate.

Browse what was recorded:

```bash
curl http://localhost:4517/api/issues | python3 -m json.tool
```

### Optional: Slack alerts

Create a [Slack incoming webhook](https://api.slack.com/messaging/webhooks) and start the server with it:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/... npm run server
```

Every **new** issue (not every occurrence) posts the culprit `file:line` and code snippet to your channel.

### Optional: S3 + auth (production-ish)

Create `packages/server/.env`:

```bash
ERRSOURCE_API_KEY=pick-a-secret        # required by the upload + issues endpoints
S3_BUCKET=your-bucket                  # maps go to S3 instead of local disk
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Then build your app with the same key: `ERRSOURCE_API_KEY=pick-a-secret npm run build`.

## Use it in your own app

```bash
npm i -D @satyamx55/vite-plugin-errsource @satyamx55/errsource-browser
```

```ts
// vite.config.ts
import errsource from '@satyamx55/vite-plugin-errsource';

export default defineConfig({
  plugins: [errsource({ serverUrl: 'https://your-errsource-server.com' })],
});
```

```ts
// src/main.ts — first import, before your app code
import { init } from '@satyamx55/errsource-browser';
init({ endpoint: 'https://your-errsource-server.com' });
```

That's all — the release id flows from the plugin to the SDK automatically via `window.__ERRSOURCE_RELEASE__`.

## Packages

| Package                                                    | What it does                                                       | Status |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| [`@satyamx55/vite-plugin-errsource`](packages/vite-plugin) | Uploads source maps to your server at build time, keyed by release | ready  |
| [`@satyamx55/errsource-browser`](packages/browser)         | Captures `window.onerror` / unhandled rejections and reports them  | ready  |
| [`@satyamx55/errsource-server`](packages/server)           | Symbolicates stack traces, groups issues in SQLite, alerts Slack   | ready  |
| [`examples/vite-app`](examples/vite-app)                   | Demo app with buttons that throw — the 3-minute tour above         | —      |

## How it fits together

1. **Build** — the Vite plugin builds with hidden source maps, uploads every `.map` to the server under a release id (git commit), injects `window.__ERRSOURCE_RELEASE__`, and removes maps from `dist/` so they are never deployed.
2. **Runtime** — the browser SDK catches uncaught errors and unhandled rejections (with client-side dedupe + rate limiting) and reports `{ message, stack, release, url }`.
3. **Symbolication** — the server loads the release's source map, translates each minified frame back to the original `file:line:column`, pulls a code snippet from `sourcesContent`, groups duplicates by fingerprint into issues (SQLite), and alerts Slack on new ones.

## Development

```bash
npm install          # installs all workspaces
npm run build        # builds the publishable packages
npm run typecheck    # typechecks every package
npm run lint         # lints the whole repo
npm run format:check # verifies formatting
```

## License

MIT © Satyam Kumar
