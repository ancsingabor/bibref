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
if c=='split':
 line=json.dumps({'type':'output','kind':'text','text':'split'})+'\\n'
 sys.stdout.write(line[:9]); sys.stdout.flush(); time.sleep(0.02)
 sys.stdout.write(line[9:]+json.dumps({'type':'result','ok':True,'state':r['state'],'closed':False})+'\\n'); sys.stdout.flush()
elif c=='coalesced':
 sys.stdout.write(json.dumps({'type':'output','kind':'text','text':'coalesced'})+'\\n'+json.dumps({'type':'result','ok':True,'state':r['state'],'closed':False})+'\\n'); sys.stdout.flush()
elif c=='unknown': print(json.dumps({'type':'unrecognized'}),flush=True)
elif c=='fatal': print(json.dumps({'type':'fatal','message':'fixture failure'}),flush=True)
elif c=='no-result': print(json.dumps({'type':'output','kind':'text','text':'incomplete'}),flush=True)
elif c=='trailing':
 sys.stdout.write(json.dumps({'type':'result','ok':True,'state':r['state']})+'\\npartial'); sys.stdout.flush()
elif c=='nonzero':
 print(json.dumps({'type':'result','ok':True,'state':r['state']}),flush=True); sys.exit(7)
elif c=='crash': os._exit(139)
elif c=='malformed': print('not JSON', flush=True)
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
// Controlled writes exercise incremental parsing; OS read chunk partitions remain nondeterministic.
// memoryLimit=false deliberately leaves Linux prlimit acceptance outside these claims.
test('G3 N01–N08 controlled framing and error categories', async t => {
  for (const [id, command] of [['N01', 'split'], ['N02', 'coalesced']]) {
    await t.test(`${id} valid ${command} framing`, async () => {
      const events = [];
      const result = await run(command, { onEvent: event => events.push(event) });
      assert.equal(result.ok, true); assert.deepEqual(result.state, initialState());
      assert.deepEqual(events, [{ type: 'output', kind: 'text', text: command }]);
    });
  }
  for (const [id, command, code] of [
    ['N03', 'unknown', 'engine_protocol'], ['N04', 'fatal', 'engine_error'],
    ['N05', 'no-result', 'engine_crash'], ['N06', 'trailing', 'engine_crash'],
    ['N07', 'missing', 'engine_unavailable'], ['N08', 'nonzero', 'engine_crash'],
  ]) await t.test(`${id} ${command}`, async () => {
    await assert.rejects(run(command, command === 'missing' ? { bin: path.join(dir, 'does-not-exist') } : {}), { code });
  });
});
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
