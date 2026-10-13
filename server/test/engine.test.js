import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeNative } from '../engine.js';
import { initialState, ApiError } from '../store.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibref-engine-test-'));
const bin = path.join(dir, 'fixture.py');
fs.writeFileSync(bin, `#!/usr/bin/env python3
import json,sys,time,os
r=json.loads(sys.stdin.readline())
c=r['command']
if c=='crash': os._exit(139)
if c=='malformed': print('not JSON', flush=True)
elif c=='large': print(json.dumps({'type':'output','kind':'text','text':'x'*4096}),flush=True)
elif c=='wait':
 print(json.dumps({'type':'output','kind':'text','text':str(os.getpid())}),flush=True)
 time.sleep(100)
else:
 print(json.dumps({'type':'output','kind':'text','text':('LEAK' if os.environ.get('BIBREF_COOKIE_SECRET') or os.environ.get('KV_REST_API_TOKEN') else 'OK')}),flush=True)
 print(json.dumps({'type':'result','ok':True,'state':r['state'],'closed':False}),flush=True)
`, { mode: 0o755 });
after(() => fs.rmSync(dir, { recursive: true, force: true }));
function run(command, options = {}) {
  return executeNative({ command, state: initialState() }, { bin, cwd: dir, memoryLimit: false,
    deadline: Date.now() + 5000, outputBytes: 1024, onEvent: () => {}, signal: new AbortController().signal, ...options });
}
test('valid protocol and native process failure boundaries', async () => {
  assert.equal((await run('ok')).ok, true);
  await assert.rejects(run('crash'), { code: 'engine_crash' });
  await assert.rejects(run('malformed'), { code: 'engine_protocol' });
  await assert.rejects(run('large'), { code: 'output_limit' });
});
test('deadline and cancellation terminate the process group', async () => {
  await assert.rejects(run('wait', { deadline: Date.now() + 100 }), { code: 'timeout' });
  const controller = new AbortController(); let pid;
  const task = run('wait', { signal: controller.signal, onEvent: e => { pid = Number(e.text); controller.abort(new ApiError('cancelled')); } });
  await assert.rejects(task, { code: 'cancelled' });
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});


test('native subprocess never inherits service credentials', async () => {
  process.env.BIBREF_COOKIE_SECRET = 'must-not-reach-child';
  process.env.KV_REST_API_TOKEN = 'must-not-reach-child';
  const output = [];
  try {
    await run('ok', {onEvent: e => output.push(e.text)});
    assert.deepEqual(output, ['OK']);
  } finally { delete process.env.BIBREF_COOKIE_SECRET; delete process.env.KV_REST_API_TOKEN; }
});
