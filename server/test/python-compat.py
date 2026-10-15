"""Compare browser return types/values against the original pexpect wrapper."""
import importlib.util
import json
from pathlib import Path
import re
import sys
import types

root = Path(__file__).resolve().parents[2]
sys.modules['pexpect'] = types.ModuleType('pexpect')

class Engine:
    def sendline(self, command):
        if command.startswith(('text', 'lookup')):
            output = 'Stored internally as fares.'
        elif command.startswith(('latintext', 'raw')):
            output = 'Stored.'
        elif command.startswith('find'):
            output = 'Found in Genesis 1:1+1 1:1-2 (book position 2-5)\n1 occurrences.'
        elif command.startswith('maxresults'):
            output = 'Set to 10000.'
        elif command == 'jaccard12':
            output = 'Jaccard distance is 0.000000.'
        elif command == 'nearest12':
            output = 'Nearest Jaccard distance is 0.250000 with substring abc.'
        elif command.startswith('getrefs'):
            output = 'match (length=23, pos1=3)\nFinished'
        else:
            raise AssertionError(command)
        self.buffer = (command + '\n' + output).encode()

    def expect(self, patterns):
        if isinstance(patterns, str):
            patterns = [patterns]
        matches = [(index, re.search(pattern.encode(), self.buffer)) for index, pattern in enumerate(patterns)]
        index, match = min((item for item in matches if item[1]), key=lambda item: item[1].start())
        self.before, self.match = self.buffer[:match.start()], match
        self.buffer = self.buffer[match.end():]
        return index

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

reference = load('reference', root / 'py/bibref/tools.py')
reference.bibref = Engine()
calls = []
def call(operation, encoded):
    args = json.loads(encoded)
    calls.append((operation, args))
    values = {'text_n': 'fares', 'lookup_n': 'fares', 'latintext_n': None, 'raw_n': None,
              'find_n': [['Genesis 1:1+1 1:1-2', 2, 5]], 'maxresults': 10000,
              'jaccard12': 0, 'nearest12': [25, 'abc'], 'getrefs_maxlength': '23'}
    return json.dumps({'ok': True, 'value': values[operation]})
js = types.ModuleType('js')
js.bibref_call = call
sys.modules['js'] = js
browser = load('browser', root / 'server/public/python/tools.py')
cases = [
    ('text_n', [1, 'Φαρες']), ('latintext_n', [2, 'abc']), ('lookup_n', [1, 'LXX Genesis 1:1']),
    ('raw_n', [2, 'LXX', 'Genesis', 1, 10]), ('find_n', [1, 'LXX']), ('maxresults', [10000]),
    ('jaccard12', []), ('nearest12', []), ('getrefs_maxlength', ['SBLGNT LXX Psalms 2']),
    ('jaccard', ['υιος', 'υιος']), ('latin_to_greek', ['abcdefghijklmnopqrstuvwxyz']),
]
for name in ['text1','text2']: cases.append((name, ['Φαρες']))
for name in ['latintext1','latintext2']: cases.append((name, ['abc']))
for name in ['lookup1','lookup2']: cases.append((name, ['LXX Genesis 1:1']))
for name in ['find1','find2']: cases.append((name, ['LXX']))
for name in ['raw1','raw2']: cases.append((name, ['LXX','Genesis',1,10]))
for name, args in cases:
    expected = getattr(reference, name)(*args)
    actual = getattr(browser, name)(*args)
    assert expected == actual and type(expected) is type(actual), (name, expected, actual)
browser.text1('Raqab Rouj Iwajam')
assert calls[-1] == ('text_n', [1, 'Ραχαβ Ρουθ Ιωαθαμ'])
# The book's Greek font extracts as ASCII. Punctuation bypasses the optional
# ASCII conversion, so the runnable example must carry actual Unicode Greek.
examples_source = (root / 'server/public/python/examples.js').read_text()
nearest_source = examples_source.split('  nearest: `', 1)[1].split('`,', 1)[0]
sys.modules['bibref'] = types.ModuleType('bibref')
sys.modules['bibref.tools'] = browser
exec(nearest_source, {})
assert ('text_n', [2, 'Ος αν απολυση την γυναικα αυτου, δοτω αυτη αποστασιον']) in calls
assert [args for operation, args in calls if operation == 'raw_n'][-3:] == [
    [1, 'LXX', book, 1, -1] for book in ['Leviticus', 'Numbers', 'Deuteronomy']]
for name in ['spawn_bibref', 'set_bibref_path']:
    try:
        getattr(browser, name)()
        raise AssertionError(name)
    except NotImplementedError:
        pass
print(f'{len(cases)} original-wrapper return values/types match; book notation and unsupported helpers passed')
