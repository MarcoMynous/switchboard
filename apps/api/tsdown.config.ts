import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'tsdown';

const openPaymentsSpecsDir = resolve(
  '../../packages/open-payments/node_modules/@interledger/open-payments/dist/openapi/specs',
);

// Workspace packages ship TS source, so they're bundled in. All runtime npm deps (hono, pg,
// drizzle-orm, zod, pino, inngest) are bundled too so Vercel's serverless runtime never fails
// to resolve pnpm's symlinked node_modules from generated chunk files.
export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  shims: true,
  deps: { alwaysBundle: [/.*/], onlyBundle: false },
  dts: false,
  onSuccess() {
    cpSync(openPaymentsSpecsDir, resolve('dist/specs'), { recursive: true });
  },
});
