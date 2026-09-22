'use client';

import { useState } from 'react';
import { LIB_BLOCKS } from '@/lib/demo/source.generated';
import { CodeBlock } from './code-block';
import { Chip, CopyButton } from './ui';

/**
 * The host side of the integration.
 *
 * The other panes cover the spec and what the spec names: the tree, the JSON,
 * the state, the catalog entry, the React a component renders as. What none of
 * them showed is the code in YOUR app that makes any of it run — the provider
 * call, the handlers map you hand it, the validation functions you register.
 * The labs used to describe that in prose. Prose is not source.
 *
 * Everything here is real text, sliced at build time by scripts/gen-source.ts:
 * the app's own files out of this repo, the library's out of the installed
 * @json-render dist. Nothing is retyped, so nothing can drift.
 */

export interface WiringBlock {
  /** File path or symbol — what you would open to find this. */
  label: string;
  /** A key into LIB_BLOCKS, or literal source when `code` is given. */
  block?: string;
  code?: string;
  lang?: string;
  /** One line: why this block is part of the wiring. */
  note?: React.ReactNode;
  /** Library internals, rather than something you write. Off by default. */
  internal?: boolean;
}

export function WiringPane({ blocks, height }: { blocks: WiringBlock[]; height: number }) {
  const [scope, setScope] = useState<'yours' | 'all'>('yours');

  const provider: WiringBlock = {
    label: 'components/playground/spec-playground.tsx',
    block: 'SpecPlayground.provider',
    note: (
      <>
        The one call that connects everything. Every pane in this playground is downstream of these six props.
      </>
    ),
  };

  const all = [provider, ...blocks];
  const shown = scope === 'all' ? all : all.filter((b) => !b.internal);
  const hidden = all.length - shown.length;

  return (
    <div className="overflow-y-auto" style={{ maxHeight: height }}>
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted px-3 py-1.5">
        <Chip active={scope === 'yours'} onClick={() => setScope('yours')}>
          your code
        </Chip>
        <Chip active={scope === 'all'} onClick={() => setScope('all')}>
          + library internals
        </Chip>
        <span className="text-[12px] text-muted-foreground">
          {scope === 'yours'
            ? 'What this app writes to make the spec run.'
            : 'Plus the functions inside @json-render that read it.'}
        </span>
      </div>

      {shown.map((b) => {
        const code = b.code ?? LIB_BLOCKS[b.block ?? ''] ?? '';
        if (!code) return null;
        return (
          <div key={b.label} className="border-b last:border-b-0">
            <div className="flex items-center justify-between gap-2 bg-card px-3 py-1">
              <span className="min-w-0 truncate font-mono text-[12px] font-medium text-foreground">{b.label}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {b.internal ? 'library' : 'your code'}
                </span>
                <CopyButton text={code} />
              </div>
            </div>
            {b.note && (
              <div className="border-t bg-muted px-3 py-1.5 text-[12px] leading-relaxed text-muted-foreground">
                {b.note}
              </div>
            )}
            <CodeBlock code={code} lang={b.lang ?? 'tsx'} maxHeight="none" showLineNumbers={false} />
          </div>
        );
      })}

      {scope === 'yours' && hidden > 0 && (
        <div className="border-t bg-muted px-3 py-2 text-[12px] text-muted-foreground">
          {hidden} more {hidden === 1 ? 'block' : 'blocks'} inside <span className="font-mono">@json-render</span> —
          switch to <span className="font-mono">+ library internals</span> to read what actually consumes the code
          above.
        </div>
      )}
    </div>
  );
}
