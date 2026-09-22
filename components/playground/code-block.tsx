'use client';

import { Highlight, type PrismTheme } from 'prism-react-renderer';
import { cn } from '@/lib/utils';

/**
 * Syntax-highlighted code with line numbers and soft wrapping.
 *
 * Three decisions worth knowing:
 *
 *  - Colours are CSS variables, not literals, so light/dark follow the theme
 *    with no second theme object and no flash on toggle.
 *  - Lines WRAP rather than scroll horizontally. A tutorial where half the
 *    line is off-screen is a tutorial nobody reads. `.code-line` gives the
 *    wrapped remainder a hanging indent so it cannot be mistaken for a new
 *    statement.
 *  - Line numbers are `user-select: none`, so copying still gives you clean
 *    code.
 */
const theme: PrismTheme = {
  plain: { color: 'var(--code-plain)', backgroundColor: 'transparent' },
  styles: [
    { types: ['comment', 'prolog', 'cdata'], style: { color: 'var(--code-comment)', fontStyle: 'italic' } },
    { types: ['punctuation', 'operator'], style: { color: 'var(--code-punct)' } },
    { types: ['string', 'char', 'attr-value', 'regex', 'inserted'], style: { color: 'var(--code-string)' } },
    {
      types: ['number', 'boolean', 'constant', 'symbol', 'builtin', 'deleted'],
      style: { color: 'var(--code-number)' },
    },
    {
      types: ['keyword', 'atrule', 'selector', 'important', 'tag'],
      style: { color: 'var(--code-keyword)' },
    },
    { types: ['function', 'class-name', 'attr-name'], style: { color: 'var(--code-plain)' } },
    // JSON keys read as `property`; make them the strongest thing on the line.
    { types: ['property'], style: { color: 'var(--code-plain)', fontWeight: '500' } },
    { types: ['variable'], style: { color: 'var(--code-plain)' } },
  ],
};

/** Prism language ids. `jsonl` and `text` have no grammar — fall back sanely. */
function toPrismLang(lang?: string) {
  switch (lang) {
    case 'ts':
    case 'typescript':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'js':
    case 'javascript':
      return 'javascript';
    case 'json':
    case 'jsonl':
      return 'json';
    case 'bash':
    case 'sh':
    case 'shell':
      return 'bash';
    default:
      return 'text';
  }
}

export function CodeBlock({
  code,
  lang,
  maxHeight = 420,
  showLineNumbers = true,
  fill = false,
}: {
  code: string;
  lang?: string;
  maxHeight?: number | string;
  showLineNumbers?: boolean;
  /** Stretch to the pane. Without this a six-line file leaves a grey void. */
  fill?: boolean;
}) {
  const source = code.replace(/\n+$/, '');

  return (
    <Highlight theme={theme} code={source} language={toPrismLang(lang)}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn('overflow-y-auto overflow-x-hidden p-3 font-mono text-[13.5px] leading-[1.7]', fill && 'h-full')}
          style={{ maxHeight }}
        >
          <code className="grid" style={{ gridTemplateColumns: showLineNumbers ? 'auto 1fr' : '1fr' }}>
            {tokens.map((line, i) => {
              const { key: _lineKey, ...lineProps } = getLineProps({ line });
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: source lines are a stable ordered list
                <div key={i} className="contents">
                  {showLineNumbers && (
                    <span
                      aria-hidden
                      className="select-none pr-3 text-right tabular-nums"
                      style={{ color: 'var(--code-gutter)' }}
                    >
                      {i + 1}
                    </span>
                  )}
                  <span {...lineProps} className={cn('code-line', lineProps.className)}>
                    {line.map((token, j) => {
                      const { key: _tokenKey, ...tokenProps } = getTokenProps({ token });
                      // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional
                      return <span key={j} {...tokenProps} />;
                    })}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      )}
    </Highlight>
  );
}
