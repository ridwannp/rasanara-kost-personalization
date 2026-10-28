import { loadEnv } from 'vite';
import { query9Router } from './routerHandler.js';

/**
 * Vite plugin that intercepts /api/ai/kos-assistant and /api/ai/status
 * directly in Vite's dev server & preview server.
 * Proxies requests to 9Router AI Gateway.
 */
export function vitePluginDeepseek() {
  let envConfig = {};

  return {
    name: 'vite-plugin-ai-router',
    configResolved(config) {
      envConfig = loadEnv(config.mode, process.cwd(), '');
    },
    configureServer(server) {
      setupApiMiddleware(server.middlewares, () => envConfig);
    },
    configurePreviewServer(server) {
      setupApiMiddleware(server.middlewares, () => envConfig);
    },
  };
}

function resolveConfig(env) {
  const apiKey = (
    process.env.ROUTER_API_KEY ||
    process.env.NINEROUTER_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    env.ROUTER_API_KEY ||
    env.NINEROUTER_API_KEY ||
    env.DEEPSEEK_API_KEY ||
    ''
  ).trim();

  const baseUrl = (
    process.env.ROUTER_BASE_URL ||
    process.env.NINEROUTER_BASE_URL ||
    env.ROUTER_BASE_URL ||
    env.NINEROUTER_BASE_URL ||
    'http://localhost:20128/v1'
  ).trim();

  const model = (
    process.env.ROUTER_MODEL ||
    process.env.NINEROUTER_MODEL ||
    env.ROUTER_MODEL ||
    env.NINEROUTER_MODEL ||
    'deepseek-chat'
  ).trim();

  return { apiKey, baseUrl, model };
}

function setupApiMiddleware(middlewares, getEnv) {
  middlewares.use('/api/ai/status', (req, res) => {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
    const env = getEnv();
    const { apiKey, baseUrl, model } = resolveConfig(env);

    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        provider: '9router',
        model,
        baseUrl,
        configured: Boolean(apiKey && apiKey.length > 0),
      })
    );
  });

  middlewares.use('/api/ai/kos-assistant', async (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      res.setHeader('Content-Type', 'application/json');
      try {
        const payload = JSON.parse(body || '{}');
        const env = getEnv();
        const { apiKey, baseUrl, model } = resolveConfig(env);

        if (!apiKey || apiKey.length === 0) {
          res.statusCode = 400;
          return res.end(
            JSON.stringify({
              error: 'API Key belum disetel di file .env.local (ROUTER_API_KEY).',
              code: 'API_KEY_MISSING',
            })
          );
        }

        const result = await query9Router(payload, { apiKey, baseUrl, model });
        return res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[9Router Middleware Error]:', err.message);
        res.statusCode = 500;
        return res.end(
          JSON.stringify({
            error: err.message || 'Terjadi kesalahan saat memproses permintaan ke 9Router.',
          })
        );
      }
    });
  });
}
