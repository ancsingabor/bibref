export function fakeClock(initial = '2026-11-03T23:59:59.000Z') {
  let timestamp = Date.parse(initial);
  return {
    now: () => timestamp,
    advance(milliseconds) {
      timestamp += milliseconds;
    },
  };
}

export function fakeTransport(...steps) {
  const calls = [];
  return {
    calls,
    async fetch(url, options) {
      calls.push({ url: String(url), options });
      if (calls.length > steps.length) throw new Error('Unexpected fixture dispatch');
      const step = steps[calls.length - 1];
      if (step instanceof Error) throw step;
      return typeof step === 'function' ? step(url, options) : step;
    },
  };
}

export function fixtureLedger(clock) {
  const operations = new Map();
  const counts = new Map();
  return {
    network: () => true,
    receipt(request) {
      const item = operations.get(request.id);
      if (!item) return null;
      if (item.browser !== request.browser) return { code: 'not_found' };
      if (request.binding && request.binding !== item.binding) return { code: 'request_conflict' };
      return item.result ?? { requestId: request.id, status: 'running', retryAfter: 2 };
    },
    admit(request) {
      const previous = this.receipt(request);
      if (previous) return previous;
      const day = new Date(clock.now()).toISOString().slice(0, 10);
      const key = request.browser + day;
      if ((counts.get(key) ?? 0) >= 3) return { code: 'daily_limit' };
      const operation = { ...request, key, fence: request.id, deadline: clock.now() + 60000 };
      operations.set(request.id, operation);
      return operation;
    },
    dispatch: (_operation, stage) => stage,
    confirm: () => true,
    uncertain(operation) { operation.result = { requestId: operation.id, status: 'uncertain', retryAfter: 2 }; },
    finish(operation, payload) {
      const completed = (counts.get(operation.key) ?? 0) + (payload.status === 'failed' ? 0 : 1);
      counts.set(operation.key, completed);
      operation.result = { ...payload, allowance: { remaining: 3 - completed, resetAt: new Date(clock.now() + 86400000).toISOString() } };
      return operation.result;
    },
  };
}
