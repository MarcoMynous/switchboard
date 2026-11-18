import type { NextConfig } from 'next';

function resolveApiOrigin(): string | null {
  const raw = process.env.API_ORIGIN?.trim();
  if (raw) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return raw.replace(/\/+$/, '');
      }
    } catch {
      // Ignore placeholders such as "[SENSITIVE]" injected by `vercel pull`
    }
  }
  // On Vercel, root vercel.json routes /api/* between `web` and `api` at the edge.
  if (process.env.VERCEL === '1') {
    return null;
  }
  return 'http://localhost:4000';
}

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@switchboard/env', '@switchboard/booking', '@switchboard/db'],
  experimental: {
    agentUpgrade: 'security',
  },
  async rewrites() {
    const apiOrigin = resolveApiOrigin();
    if (!apiOrigin) {
      return { beforeFiles: [], afterFiles: [], fallback: [] };
    }
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/api/:path*',
          destination: `${apiOrigin}/api/:path*`,
        },
      ],
    };
  },
};

export default config;
