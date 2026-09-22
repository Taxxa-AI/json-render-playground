'use client';

import { json, jsonParseLinter } from '@codemirror/lang-json';
import { lintGutter, linter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';

/**
 * A real editor, not a <textarea>.
 *
 * The textarea was the single biggest obstacle to actually doing the tasks:
 * no bracket matching, no auto-indent, no folding, and a 34-line document in a
 * scrolling box where one missing comma silently broke everything. CodeMirror
 * gives bracket matching, auto-close, folding, and inline lint squiggles on the
 * exact character that is wrong.
 *
 * Colours come from the same CSS variables as the static code blocks, so the
 * editor follows light/dark with no second theme.
 */
const baseTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--code-plain)', fontSize: '13px' },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    padding: '10px 0',
    caretColor: 'var(--foreground)',
  },
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
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--surface-hover)',
    border: '1px solid var(--border)',
    color: 'var(--muted-foreground)',
    borderRadius: '3px',
    padding: '0 4px',
  },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--destructive)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--popover-foreground)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
  },
});

/** Token colours, matching components/playground/code-block.tsx exactly. */
const syntax = EditorView.baseTheme({});

export function JsonEditor({
  value,
  onChange,
  height,
  readOnly,
}: {
  value: string;
  onChange?: (v: string) => void;
  /**
   * Leave this out. The editor then fills its container, which is what you
   * almost always want — a fixed pixel height clips the document while empty
   * pane sits below it. Only pass a number for a deliberately small inline
   * editor, and even then the parent should be able to scroll.
   */
  height?: number | string;
  readOnly?: boolean;
}) {
  const extensions = useMemo(
    () => [json(), linter(jsonParseLinter()), lintGutter(), baseTheme, syntax, EditorView.lineWrapping],
    [],
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
        foldGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        indentOnInput: true,
        searchKeymap: false,
      }}
      className={`jr-cm text-[13px] ${height === undefined ? 'h-full' : ''}`}
    />
  );
}
