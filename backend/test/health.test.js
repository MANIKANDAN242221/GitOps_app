import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

let server;
let base;

before(async () => {
  server = createApp({ version: '9.9.9', environment: 'test' }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('GET /healthz returns ok', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('GET /readyz returns ready', async () => {
  const res = await fetch(`${base}/readyz`);
  assert.equal(res.status, 200);
});

test('GET /api/info reports version and environment', async () => {
  const body = await (await fetch(`${base}/api/info`)).json();
  assert.equal(body.version, '9.9.9');
  assert.equal(body.environment, 'test');
  assert.ok(body.hostname);
  assert.equal(typeof body.uptimeSeconds, 'number');
});

test('GET /api/pipeline returns five stages', async () => {
  const body = await (await fetch(`${base}/api/pipeline`)).json();
  assert.equal(body.stages.length, 5);
});

test('GET /metrics exposes Prometheus metrics', async () => {
  await fetch(`${base}/api/health`);
  const res = await fetch(`${base}/metrics`);
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.match(text, /http_requests_total/);
  assert.match(text, /process_cpu_user_seconds_total/);
});

test('unknown route returns 404 JSON', async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found' });
});
