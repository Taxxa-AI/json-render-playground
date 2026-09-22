'use client';

import { useMemo, useState } from 'react';
import { CodeBlock } from '@/components/playground/code-block';
import { JsonEditor } from '@/components/playground/json-editor';
import { ChromeButton, Editor, Pill } from '@/components/playground/ui';
import { RUNNERS } from '@/lib/reference/runners';
import type { ReferenceRun } from '@/lib/reference';

/**
 * The live half of a UTILITY entry: editable input, and the real function's
 * real return value.
 *
 * Nothing is mocked — `lib/reference/runners.ts` imports the same functions
 * your app would. The output pane is read-only because it is evidence.
 */
export function MiniRun({ run }: { run: ReferenceRun }) {
  const runner = RUNNERS[run.fn];
  const [a, setA] = useState(run.input);
  const [b, setB] = useState(run.input2 ?? '');
  const [lossy, setLossy] = useState(true);

  const result = useMemo(() => {
    if (!runner) return { output: '', error: `No runner registered for "${run.fn}"` };
    const second = run.fn === 'autoFixSpec' ? String(lossy) : run.input2 !== undefined ? b : undefined;
    return runner.run(a, second);
  }, [runner, run.fn, run.input2, a, b, lossy]);

  if (!runner) {
    return <p className="mt-3 font-mono text-[12px] text-red-600">No runner registered for &ldquo;{run.fn}&rdquo;.</p>;
  }

  // JSONL and prose inputs get a plain editor; anything JSON-shaped gets CodeMirror.
  const jsonish = (text: string) => text.trim().startsWith('{') || text.trim().startsWith('[');
  const twoUp = run.input2 !== undefined || run.fn === 'autoFixSpec';

  return (
    <div className="mt-3 overflow-hidden rounded-md border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted px-2.5 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">run</span>
        <span className="font-mono text-[11px] text-foreground">{run.fn}()</span>
        <div className="ml-auto flex items-center gap-1.5">
          {run.fn === 'autoFixSpec' && (
            <ChromeButton active={lossy} onClick={() => setLossy((v) => !v)} title="Toggle the lossy option">
              lossy: {String(lossy)}
            </ChromeButton>
          )}
          {result.error ? <Pill tone="bad">input error</Pill> : <Pill tone="ok">ran</Pill>}
          <ChromeButton
            onClick={() => {
              setA(run.input);
              setB(run.input2 ?? '');
              setLossy(true);
            }}
          >
            reset
          </ChromeButton>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col border-b lg:border-b-0 lg:border-r">
          <Field label={run.label}>
            {jsonish(run.input) ? (
              <div className="h-[168px] overflow-auto">
                <JsonEditor value={a} onChange={setA} />
              </div>
            ) : (
              <Editor value={a} onChange={setA} height={168} />
            )}
          </Field>
          {twoUp && run.input2 !== undefined && (
            <Field label={run.labelB ?? 'second argument'}>
              {jsonish(run.input2) ? (
                <div className="h-[132px] overflow-auto">
                  <JsonEditor value={b} onChange={setB} />
                </div>
              ) : (
                <Editor value={b} onChange={setB} height={132} />
              )}
            </Field>
          )}
          {run.fn === 'autoFixSpec' && (
            <p className="border-t bg-surface px-2.5 py-1.5 text-[12px] text-muted-foreground">
              The second argument is the <code className="font-mono">lossy</code> toggle above, not an editor.
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col">
          <Field label={runner.outputLabel}>
            <div className="max-h-[300px] min-h-[168px] overflow-auto">
              {result.error ? (
                <p className="px-3 py-2 font-mono text-[12px] leading-relaxed text-red-600 dark:text-red-400">
                  {result.error}
                </p>
              ) : (
                <CodeBlock
                  code={result.output}
                  lang={/^[[{]/.test(result.output.trim()) ? 'json' : 'text'}
                  maxHeight={300}
                />
              )}
            </div>
          </Field>
          {result.notes && result.notes.length > 0 && (
            <ul className="shrink-0 border-t bg-muted px-2.5 py-1.5">
              {result.notes.map((n, i) => (
                <li key={i} className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col border-b last:border-b-0">
      <span className="shrink-0 border-b bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
