import express from 'express';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import client from 'prom-client';

const SERVICE = 'gitops-backend';
const startedAt = Date.now();

const PIPELINE = [
  { id: 'commit', name: 'Git Commit', tool: 'GitHub', detail: 'Developer pushes to main' },
  { id: 'ci', name: 'Build & Test', tool: 'GitHub Actions', detail: 'Lint, unit tests, image build' },
  { id: 'registry', name: 'Push Image', tool: 'Amazon ECR', detail: 'Tagged, scanned container image' },
  { id: 'sync', name: 'GitOps Sync', tool: 'Argo CD', detail: 'Desired state pulled from Git' },
  { id: 'run', name: 'Running', tool: 'Amazon EKS', detail: 'Rolling update, zero downtime' },
];

export function createApp({ version = process.env.APP_VERSION || '1.0.0', environment = process.env.APP_ENV || 'local' } = {}) {
  const app = express();
  app.disable('x-powered-by');

  // A registry per app instance keeps tests isolated.
  const register = new client.Registry();
  register.setDefaultLabels({ service: SERVICE });
  client.collectDefaultMetrics({ register });

  const httpRequests = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [register],
  });
  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [register],
  });

  app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      const labels = { method: req.method, route: req.route?.path ?? 'unmatched', status: res.statusCode };
      httpRequests.inc(labels);
      end(labels);
    });
    next();
  });

  // Kubernetes probes
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.get('/readyz', (_req, res) => res.json({ status: 'ready' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: SERVICE }));

  app.get('/api/info', (_req, res) => {
    res.json({
      service: SERVICE,
      version,
      environment,
      hostname: os.hostname(), // pod name in Kubernetes
      node: process.version,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/pipeline', (_req, res) => res.json({ stages: PIPELINE }));

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const port = Number(process.env.PORT) || 5002;
  const server = createApp().listen(port, () => {
    console.log(`${SERVICE} listening on :${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the other process or run with PORT=<other> npm start`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
