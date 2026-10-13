import { spawn } from 'node:child_process';
import { ApiError } from './store.js';

export function executeNative({ command, state, metadata = false }, { bin, cwd, deadline, outputBytes, onEvent, signal, memoryLimit = true }) {
  return new Promise((resolve, reject) => {
    const args = memoryLimit ? ['--as=536870912', '--stack=16777216', '--', bin, '--json'] : ['--json'];
    const child = spawn(memoryLimit ? '/usr/bin/prlimit' : bin, args, { cwd, detached: true, stdio: ['pipe', 'pipe', 'ignore'],
      // The native parser must never inherit Redis, cookie, or Vercel credentials.
      env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME || cwd,
        SWORD_PATH: process.env.SWORD_PATH || `${cwd}/.sword`, LANG: 'C.UTF-8' } });
    let buffered = '', bytes = 0, result, error, settled = false;
    const stop = (code) => {
      error ||= new ApiError(code, 422);
      if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    };
    const abort = () => stop(signal.reason?.code || 'cancelled');
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(() => stop('timeout'), Math.max(1, deadline - Date.now()));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (error) return;
      buffered += chunk;
      // A single native output event can be larger than a pipe chunk.
      if (Buffer.byteLength(buffered) > outputBytes + 262144) return stop('output_limit');
      let pos;
      while ((pos = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, pos); buffered = buffered.slice(pos + 1);
        try {
          const event = JSON.parse(line);
          if (event.type === 'output') {
            bytes += Buffer.byteLength(JSON.stringify(event));
            if (bytes > outputBytes) return stop('output_limit');
            onEvent(event);
          } else if (event.type === 'result' || event.type === 'metadata') result = event;
          else if (event.type === 'fatal') stop('engine_error');
          else stop('engine_protocol');
        } catch { stop('engine_protocol'); }
      }
    });
    child.on('error', () => { error = new ApiError('engine_unavailable', 503); });
    child.on('close', (code) => {
      if (settled) return; settled = true;
      clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else if (code !== 0 || !result || buffered.trim()) reject(new ApiError('engine_crash', 422));
      else resolve(result);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ command, state, metadata }) + '\n');
  });
}
