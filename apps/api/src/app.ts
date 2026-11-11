import type { Pool } from '@switchboard/db';
import { type Context, Hono } from 'hono';
import { requestId } from 'hono/request-id';
import { serve } from 'inngest/hono';
import { functions, inngest } from './inngest.ts';
import type { Logger } from './logger.ts';

export type AppDeps = {
  pool: Pick<Pool, 'query'>;
  logger: Logger;
};

type Env = { Variables: { requestId: string } };

export function createApp({ pool, logger }: AppDeps) {
  const app = new Hono<Env>();

  app.use(requestId());
  app.use(async (c, next) => {
    const start = performance.now();
    await next();
    logger.info(
      {
        request_id: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - start),
      },
      'request',
    );
  });

  const handleHealth = async (c: Context<Env>) => {
    try {
      await pool.query('SELECT 1');
      return c.json({ status: 'ok', db: 'ok' });
    } catch (error) {
      logger.error({ request_id: c.get('requestId'), err: error }, 'health: db unreachable');
      return c.json({ status: 'error', db: 'down' }, 503);
    }
  };
  // Hello: proves the Hono app is up without touching the DB (on Vercel, `/` belongs to web).
  app.get('/', (c) => c.json({ service: 'switchboard-api', status: 'ok' }));
  app.get('/health', handleHealth);
  app.get('/api/health', handleHealth);

  const inngestHandler = serve({ client: inngest, functions });
  app.on(['GET', 'PUT', 'POST'], '/api/inngest', (c) => inngestHandler(c));

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((error, c) => {
    logger.error({ request_id: c.get('requestId'), err: error }, 'unhandled error');
    return c.json({ error: 'internal' }, 500);
  });

  return app;
}
