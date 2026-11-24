import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForServer} from '../src/serverStartup.ts';

test('retries health only until JSON readiness, then stops', async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({url, options});
    if (requests.length === 1) return new Response('Unavailable', {status: 503});
    if (requests.length === 2) return new Response('<html>Starting</html>');
    return Response.json({status: 'ok'});
  };
  await waitForServer(new AbortController().signal, {fetcher, maxWait: 500, retryDelay: 0});
  assert.equal(requests.length, 3);
  assert.ok(requests.every(({url, options}) => url === '/api/health' && !options.body && !options.method));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(requests.length, 3);
});

test('times out a hanging health request and recovers', async () => {
  let count = 0;
  const fetcher = async (_url, options) => {
    if (++count === 1) return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), {once: true});
    });
    return Response.json({status: 'ok'});
  };
  await waitForServer(new AbortController().signal, {fetcher, requestTimeout: 5, maxWait: 500, retryDelay: 0});
  assert.equal(count, 2);
});

test('stops after the total startup deadline', async () => {
  await assert.rejects(waitForServer(new AbortController().signal, {
    fetcher: async () => new Response('', {status: 502}), maxWait: 15, retryDelay: 2,
  }), /taking longer than expected/);
});

test('cancels on page unmount without further retries', async () => {
  const controller = new AbortController();
  let count = 0;
  const pending = waitForServer(controller.signal, {
    fetcher: async () => {count++; return new Response('', {status: 503});}, retryDelay: 100,
  });
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(pending, {name: 'AbortError'});
  assert.equal(count, 1);
});
