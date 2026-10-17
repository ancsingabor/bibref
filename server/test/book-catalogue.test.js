import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const catalogue = JSON.parse(fs.readFileSync(new URL('../public/book-examples.json', import.meta.url)));
const audit = JSON.parse(fs.readFileSync(new URL('../book/coverage.json', import.meta.url)));
test('book catalogue covers all executable source sessions with clean copyable commands', () => {
  assert.equal(audit.terminalSessions, 194); assert.equal(audit.pythonSessions, 2);
  assert.deepEqual(audit.unmatchedPages, []); assert.deepEqual(audit.transcriptionRequired, []);
  assert.equal(new Set(catalogue.examples.map(e => e.id)).size, catalogue.examples.length);
  for (const e of catalogue.examples) {
    assert.ok(e.page >= 1 && e.page <= 180, e.id);
    assert.ok(!e.source.includes('\\<'), e.id);
    if (e.runtime === 'python') { assert.match(e.source, /from bibref.tools import/); continue; }
    if (e.runtime === 'shell') { assert.match(e.unavailable, /execution limits/); assert.match(e.source, /^#!\/bin\/bash/); continue; }
    assert.equal(e.source, [...e.prerequisites, ...e.commands].join('\n'));
    for (const command of e.commands) {
      assert.ok(Buffer.byteLength(command) <= 65536, e.id);
      if (/^statement\b/i.test(command)) assert.ok(command.endsWith('.'), e.id);
    }
    if (e.kind === 'diagrams') assert.ok([...e.prerequisites,...e.commands].includes('diagram svg'), e.id);
  }
});
test('context mappings preserve the book’s Psalm numbering and do not invent split-psalm context', () => {
  assert.deepEqual(catalogue.contextMappings['LXX Psalms 46:10'], ['Psalms 47:10']);
  assert.equal(catalogue.contextMappings['LXX Psalms 113:1'], undefined);
  assert.deepEqual(catalogue.contextMappings['LXX Isaiah 7:14'], ['Isaiah 7:14']);
});

test('diagram context covers verses without separate Hungarian lookup examples', () => {
  assert.deepEqual(catalogue.contextMappings['LXX Isaiah 53:12'], ['Isaiah 53:12']);
  assert.deepEqual(catalogue.contextMappings['StatResGNT Luke 22:37'], ['Luke 22:37']);
  assert.deepEqual(catalogue.contextMappings['LXX Isaiah 40:4'], ['Isaiah 40:4']);
  // A Greek reference in a known numbering-exception chapter must not gain
  // a guessed mapping merely because it occurs in a diagram.
  assert.equal(catalogue.contextMappings['LXX Isaiah 64:3'], undefined);
});
