import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
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
