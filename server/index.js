import fs from 'node:fs';
import { connectStore } from './store.js';
import { createApp } from './app.js';

const manifest = JSON.parse(fs.readFileSync(process.env.BIBREF_MANIFEST || '/opt/bibref/manifest.json', 'utf8'));
const store = await connectStore();
const app = createApp({ store, manifest, secret: process.env.BIBREF_COOKIE_SECRET,
  pythonEnabled: process.env.BIBREF_PYTHON_ENABLED === '1',
  bin: process.env.BIBREF_BIN || '/usr/local/bin/bibref', cwd: process.env.BIBREF_CWD || '/opt/bibref' });
const server = app.listen(process.env.PORT || 80, '0.0.0.0', () => console.log(JSON.stringify({ event: 'ready', engineVersion: manifest.engineVersion })));
process.on('SIGTERM', () => { server.close(); setTimeout(() => process.exit(0), 25000).unref(); });
