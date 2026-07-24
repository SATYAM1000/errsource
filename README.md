# errsource

Self-hosted error tracking for Vite apps — see the real file, line, and code behind every minified production error, with alerts in Slack.

## Packages

| Package                                                  | What it does                                                                   | Status |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| [`@satyamx/vite-plugin-errsource`](packages/vite-plugin) | Uploads source maps to your server at build time, keyed by release             | ready  |
| [`@satyamx/errsource-browser`](packages/browser)         | Captures `window.onerror` / unhandled rejections and reports them              | wip    |
| [`@satyamx/errsource-server`](packages/server)           | Stores maps, symbolicates stack traces back to original source, notifies Slack | wip    |

## How it fits together

1. **Build** — the Vite plugin builds with hidden source maps, uploads every `.map` to the server under a release id (git commit), injects `window.__ERRSOURCE_RELEASE__`, and removes maps from `dist/`.
2. **Runtime** — the browser SDK catches errors and sends `{ message, stack, release, url }` to the server.
3. **Symbolication** — the server looks up the release's source maps, translates each minified stack frame to the original `file:line:column` plus a code snippet, and posts the result to Slack.

## Development

```bash
npm install          # installs all workspaces
npm run build        # builds every package
npm run typecheck    # typechecks every package
npm run lint         # lints the whole repo
npm run format:check # verifies formatting
```

## License

MIT © Satyam Kumar
