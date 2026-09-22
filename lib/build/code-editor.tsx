'use client';

import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';

/**
 * The JS/TSX sibling of `components/playground/json-editor.tsx`.
 *
 * Same theme variables, so light/dark follow the app with no second theme.
 * Separate file because the JSON editor hard-wires the JSON language and its
 * parse linter, and a TSX buffer needs neither — errors here come from the
 * sucrase pass under the editor, not from a linter inside it.
 */
const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--code-plain)', fontSize: '12.5px' },
  '.cm-content': { fontFamily: 'var(--font-mono)', padding: '10px 0', caretColor: 'var(--foreground)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--code-gutter)',
    border: 'none',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--surface-hover) 55%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--muted-foreground)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in oklab, var(--brand) 26%, transparent)',
  },
  '.cm-cursor': { borderLeftColor: 'var(--foreground)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'color-mix(in oklab, var(--brand) 22%, transparent)',
    outline: 'none',
  },
});

export function CodeEditor({
  value,
  onChange,
  height,
  jsx = true,
  readOnly,
}: {
  value: string;
  onChange?: (v: string) => void;
  height?: number | string;
  /** Off for plain function bodies (directive resolvers, handlers). */
  jsx?: boolean;
  readOnly?: boolean;
}) {
  const extensions = useMemo(
    () => [javascript({ jsx, typescript: true }), theme, EditorView.lineWrapping],
    [jsx],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      height={height === undefined ? '100%' : typeof height === 'number' ? `${height}px` : height}
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        indentOnInput: true,
        searchKeymap: false,
      }}
      className={`jr-cm text-[12.5px] ${height === undefined ? 'h-full' : ''}`}
    />
  );
}
