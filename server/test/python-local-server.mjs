// Dedicated local acceptance server. Never use production storage credentials.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { connectStore } from '../store.js';
import { createApp } from '../app.js';

if (process.env.VERCEL || !process.env.TEST_REDIS_URL) throw new Error('Use TEST_REDIS_URL with a local disposable Redis');
const namespace = `test:python-e2e:${randomUUID()}`;
const store = await connectStore({ REDIS_URL: process.env.TEST_REDIS_URL }, { prefix: namespace, global: `${namespace}:limits` });
const manifest = JSON.parse(fs.readFileSync(process.env.BIBREF_MANIFEST || '/opt/bibref/manifest.json', 'utf8'));
createApp({ store, manifest, pythonEnabled: true, secret: 'local-python-acceptance-only-'.repeat(3),
  bin: '/usr/local/bin/bibref', cwd: '/opt/bibref' }).listen(process.env.PORT || 80, '0.0.0.0');
console.log(JSON.stringify({ event: 'local_python_ready', namespace }));
