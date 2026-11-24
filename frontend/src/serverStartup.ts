/** Wake the backend on page opening; retry only its read-only health endpoint. */
export async function waitForServer(signal: AbortSignal, options: {
  fetcher?: typeof fetch; maxWait?: number; requestTimeout?: number; retryDelay?: number;
} = {}): Promise<void> {
  const {fetcher = fetch, maxWait = 90_000, requestTimeout = 15_000, retryDelay = 2_000} = options;
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const attempt = new AbortController();
    const abortAttempt = () => attempt.abort();
    signal.addEventListener('abort', abortAttempt, {once: true});
    const timer = setTimeout(abortAttempt, Math.min(requestTimeout, deadline - Date.now()));
    try {
      const response = await fetcher('/api/health', {signal: attempt.signal, cache: 'no-store', credentials: 'same-origin'});
      const body = response.ok ? await response.json().catch(() => null) : null;
      if (body?.status === 'ok') return;
    } catch {
      signal.throwIfAborted();
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abortAttempt);
    }
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const abort = () => {clearTimeout(timer); reject(signal.reason);};
      const timer = setTimeout(() => {signal.removeEventListener('abort', abort); resolve();},
        Math.max(0, Math.min(retryDelay, deadline - Date.now())));
      signal.addEventListener('abort', abort, {once: true});
    });
  }
  signal.throwIfAborted();
  throw new Error('The server is taking longer than expected to start. Please try again shortly.');
}
