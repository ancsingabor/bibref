import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
const root = import.meta.dirname;
mkdirSync(path.join(root, 'public/vendor'), { recursive: true });
for (const [source, target] of [
 ['jquery/dist/jquery.min.js', 'jquery.min.js'],
 ['jquery.terminal/js/jquery.terminal.min.js', 'terminal.min.js'],
 ['jquery.terminal/css/jquery.terminal.min.css', 'terminal.min.css'],
 ['dompurify/dist/purify.min.js', 'purify.min.js'],
 ['jquery/LICENSE.txt', 'jquery-LICENSE.txt'],
 ['jquery.terminal/LICENSE', 'terminal-LICENSE.txt'],
 ['dompurify/LICENSE', 'dompurify-LICENSE.txt'],
 ['dompurify/LICENSE-MPL', 'dompurify-LICENSE-MPL.txt'],
]) copyFileSync(path.join(root, 'node_modules', source), path.join(root, 'public/vendor', target));

mkdirSync(path.join(root, 'public/vendor/licenses'), { recursive: true });
for (const name of ['@codemirror/autocomplete', '@codemirror/streamparser', '@marijn/find-cluster-break', '@codemirror/commands', '@codemirror/lang-python', '@codemirror/language', '@codemirror/state', '@codemirror/view', '@lezer/highlight', '@lezer/python', '@lezer/common', '@lezer/lr', 'style-mod', 'crelt', 'w3c-keyname']) {
  copyFileSync(path.join(root, 'node_modules', name, 'LICENSE'), path.join(root, 'public/vendor/licenses', name.replaceAll('/', '-') + '.txt'));
}
copyFileSync(path.join(root, 'licenses/pyodide-LICENSE.txt'), path.join(root, 'public/vendor/licenses/pyodide.txt'));
copyFileSync(path.join(root, 'licenses/python-LICENSE.txt'), path.join(root, 'public/vendor/licenses/python.txt'));

// npm's lockfile pins both the runtime and its bundled standard library.
mkdirSync(path.join(root, 'public/vendor/pyodide'), { recursive: true });
for (const file of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  copyFileSync(path.join(root, 'node_modules/pyodide', file), path.join(root, 'public/vendor/pyodide', file));
}
await build({ entryPoints: [path.join(root, 'editor.js')], outfile: path.join(root, 'public/vendor/editor.js'),
  bundle: true, minify: true, format: 'esm', target: ['es2022'], legalComments: 'linked' });
