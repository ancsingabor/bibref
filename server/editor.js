import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { python } from '@codemirror/lang-python';

export function createEditor(parent, { value, onChange, onRun }) {
  const view = new EditorView({ parent, state: EditorState.create({ doc: value, extensions: [
    lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(), history(),
    python(), bracketMatching(), indentOnInput(), syntaxHighlighting(HighlightStyle.define([
      { tag: tags.keyword, color: '#c6b7f2' }, { tag: tags.string, color: '#b4d8b0' },
      { tag: tags.number, color: '#9dcced' }, { tag: tags.comment, color: '#90a0ad' },
      { tag: tags.function(tags.variableName), color: '#e6c98f' },
    ])),
    EditorState.tabSize.of(4), EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'Python script', spellcheck: 'false' }),
    keymap.of([{ key: 'Mod-Enter', run: () => { onRun(); return true; } }, ...defaultKeymap, ...historyKeymap]),
    EditorView.updateListener.of(update => { if (update.docChanged) onChange(update.state.doc.toString()); }),
    EditorView.theme({ '&': { height: '100%', color: '#dce2e7', backgroundColor: '#080b0e' },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '14px', lineHeight: '1.65' },
      '.cm-content': { padding: '16px 8px', caretColor: '#9dcced' },
      '.cm-gutters': { backgroundColor: '#11171d', color: '#90a0ad', borderRight: '1px solid #27313a' },
      '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#17222c' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#304b63' },
      '&.cm-focused': { outline: '2px solid #9dcced', outlineOffset: '-2px' },
      '.cm-cursor': { borderLeftColor: '#9dcced' } }, { dark: true }),
  ] }) });
  return {
    get: () => view.state.doc.toString(),
    set: value => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } }),
    focus: () => view.focus(),
    line: number => {
      const line = view.state.doc.line(Math.max(1, Math.min(number, view.state.doc.lines)));
      view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) }); view.focus();
    },
  };
}
