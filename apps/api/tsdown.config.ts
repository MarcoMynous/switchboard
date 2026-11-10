import { defineConfig } from 'tsdown';

// Workspace packages ship TS source, so they're bundled in. All runtime npm deps (hono, pg,
// drizzle-orm, zod, pino, inngest) are bundled too so Vercel's serverless runtime never fails
// to resolve pnpm's symlinked node_modules from generated chunk files.
export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  deps: { alwaysBundle: [/.*/], onlyBundle: false },
  dts: false,
});
