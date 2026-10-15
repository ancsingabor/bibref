export const RESPONSE_BYTES = 2 * 1024 * 1024;
export const supported = () => self.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';
const operations = new Set(['text_n', 'latintext_n', 'lookup_n', 'raw_n', 'find_n', 'maxresults', 'jaccard12', 'nearest12', 'getrefs_maxlength']);

export function startPython(source, { operation, output, state, completed, failed }) {
  if (!supported()) throw new Error('Python needs a current browser with cross-origin isolation over HTTPS. Terminal is still available.');
  if (new TextEncoder().encode(source).length > 65536) throw new Error('Script exceeds 64 KiB');
  const channel = new SharedArrayBuffer(RESPONSE_BYTES + 8);
  const control = new Int32Array(channel, 0, 2), payload = new Uint8Array(channel, 8);
  const worker = new Worker('/python/worker.js', { type: 'module' });
  const token = crypto.randomUUID();
  let stopped = false, inFlight = false, nextSequence = 0, bytes = 0;
  const stop = () => { stopped = true; worker.terminate(); clearTimeout(timer); };
  const fail = error => { if (!stopped) { stop(); failed(error instanceof Error ? error : new Error(String(error))); } };
  const timer = setTimeout(() => fail(new Error('Python exceeded its 12-minute time limit')), 720000);
  worker.onerror = event => { event.preventDefault(); fail(new Error(event.message || 'Python worker failed')); };
  worker.onmessage = async ({ data }) => {
    if (stopped || !data || data.token !== token) return;
    try {
      if (data.type === 'operation') {
        if (inFlight || data.sequence !== nextSequence || nextSequence >= 256 || !operations.has(data.operation) || !Array.isArray(data.args) || data.args.length > 5 ||
            !data.args.every(value => typeof value === 'string' ? value.length <= 60000 : Number.isSafeInteger(value)) ||
            new TextEncoder().encode(JSON.stringify(data.args)).length > 65536) throw new Error('Invalid Python bridge request');
        inFlight = true;
        const sequence = nextSequence++;
        let result;
        try { result = { ok: true, value: await operation(data.operation, data.args, sequence) }; }
        catch (error) { result = { ok: false, message: error.message || 'bibref operation failed' }; }
        if (stopped) return;
        const encoded = new TextEncoder().encode(JSON.stringify(result));
        bytes += encoded.length;
        if (encoded.length > payload.length || bytes > RESPONSE_BYTES) throw new Error('Run output/results exceed 2 MiB');
        payload.set(encoded); Atomics.store(control, 1, encoded.length);
        inFlight = false; Atomics.store(control, 0, 1); Atomics.notify(control, 0);
      } else if (data.type === 'output') {
        if (typeof data.text !== 'string') throw new Error('Invalid Python output');
        bytes += new TextEncoder().encode(data.text).length;
        if (bytes > RESPONSE_BYTES) throw new Error('Run output/results exceed 2 MiB');
        output(data.text);
      } else if (data.type === 'ready') state('Running');
      else if (data.type === 'completed') { stop(); completed(); }
      else if (data.type === 'failed') fail(new Error(String(data.message).slice(0, 65536)));
      else throw new Error('Invalid Python worker message');
    } catch (error) { fail(error); }
  };
  state('Loading Python');
  worker.postMessage({ source, channel, token });
  return { stop };
}
