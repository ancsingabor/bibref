
// This worker receives source, never credentials, session IDs, or API URLs.
let started = false;
self.onmessage = async ({ data }) => {
  if (started) return;
  started = true;
  const { source, channel, token } = data;
  const control = new Int32Array(channel, 0, 2);
  const payload = new Uint8Array(channel, 8);
  const decoder = new TextDecoder();
  let sequence = 0, outputBytes = 0, pending = '';
  const send = (type, extra = {}) => self.postMessage({ token, type, ...extra });
  const flush = () => { if (pending) { send('output', { text: pending }); pending = ''; } };
  self.bibref_call = (operation, args) => {
    flush();
    Atomics.store(control, 0, 0);
    send('operation', { sequence: sequence++, operation, args: JSON.parse(args) });
    if (Atomics.wait(control, 0, 0, 720000) === 'timed-out') throw new Error('bibref response timed out');
    const length = Atomics.load(control, 1);
    if (length < 0 || length > payload.length) throw new Error('Invalid bridge response');
    return decoder.decode(payload.slice(0, length));
  };
  self.bibref_output = (text) => {
    outputBytes += new TextEncoder().encode(text).length;
    if (outputBytes > 2 * 1024 * 1024) throw new Error('Python output exceeds 2 MiB');
    pending += text;
    // Flush prints promptly, while batching individual character writes.
    if (pending.includes('\n') || pending.length >= 1024) flush();
  };
  try {
    const { loadPyodide } = await import('/vendor/pyodide/pyodide.mjs');
    const pyodide = await loadPyodide({ indexURL: '/vendor/pyodide/',
      packageBaseUrl: '/vendor/pyodide/', fullStdLib: false });
    const response = await fetch('/python/tools.py', { credentials: 'omit' });
    if (!response.ok) throw new Error('Could not load bibref.tools');
    pyodide.FS.mkdirTree('/home/pyodide/bibref');
    pyodide.FS.writeFile('/home/pyodide/bibref/__init__.py', '');
    pyodide.FS.writeFile('/home/pyodide/bibref/tools.py', await response.text());
    pyodide.runPython(`
import sys, builtins
from js import bibref_output
class _Output:
    def write(self, text):
        bibref_output(text)
        return len(text)
    def flush(self): pass
    def isatty(self): return False
sys.stdout = sys.stderr = _Output()
def _no_input(*args):
    raise NotImplementedError("input() is unavailable; put values in your script")
builtins.input = _no_input
def _bibref_execute(source):
    try:
        exec(compile(source, '<script>', 'exec'), {'__name__': '__main__'})
    except BaseException:
        import traceback
        return traceback.format_exc()
`);
    send('ready');
    pyodide.globals.set('_bibref_source', source);
    const error = pyodide.runPython('_bibref_execute(_bibref_source)');
    flush();
    if (error) send('failed', { message: String(error) });
    else send('completed');
  } catch (error) {
    flush();
    send('failed', { message: String(error.message || error) });
  }
};
