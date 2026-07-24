import { defineConfig } from 'vite';
import errsource from '@satyamx55/vite-plugin-errsource';

export default defineConfig({
  plugins: [
    errsource({
      // the local errsource server — see the repo README quickstart
      serverUrl: process.env.ERRSOURCE_URL ?? 'http://localhost:4517',
      timeoutMs: 3000,
      retries: 1,
    }),
  ],
});
