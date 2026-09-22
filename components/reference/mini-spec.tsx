'use client';

import { createStateStore, isNonEmptySpec, validateSpec, type Spec } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { Component, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { JsonEditor } from '@/components/playground/json-editor';
import { ChromeButton, Pill } from '@/components/playground/ui';
import { UnknownComponent, demoRegistry } from '@/lib/demo/registry';
import type { ReferenceExample, ReferenceFailure } from '@/lib/reference';
import { cn } from '@/lib/utils';

/**
 * The live half of a reference entry: an editable spec on the left, the thing
 * it renders on the right, and the state model underneath.
 *
 * Two deliberate choices:
 *
 *  - The store survives edits to the spec, so you can change a prop without
 *    losing what you typed into the form above it. It is rebuilt only when you
 *    switch between the working and broken specs, or press reset — the two
 *    moments where stale state would make the example lie.
 *  - A spec that does not parse keeps the LAST GOOD render and shows the
 *    parser message. A pane that blanks on every half-typed brace is a pane
 *    nobody edits.
 */
export function MiniSpec({
  example,
  failure,
  height = 300,
}: {
  example?: ReferenceExample;
  failure?: ReferenceFailure;
  height?: number;
}) {
  const [mode, setMode] = useState<'good' | 'bad'>(example ? 'good' : 'bad');
  const active = (mode === 'bad' ? failure : example) ?? example ?? failure;
  const [resetCount, setResetCount] = useState(0);
  const [text, setText] = useState(() => JSON.stringify(active?.spec ?? {}, null, 2));
  const [editedFor, setEditedFor] = useState<'good' | 'bad'>(mode);

  // Switching mode swaps the document. Render-phase state sync, not an effect:
  // an effect here would flash the previous spec for one frame.
  if (editedFor !== mode) {
    setEditedFor(mode);
    setText(JSON.stringify(active?.spec ?? {}, null, 2));
  }

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, spec: JSON.parse(text) as Spec };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [text]);

  const [lastGood, setLastGood] = useState<Spec | null>(parsed.ok ? parsed.spec : null);
  if (parsed.ok && parsed.spec !== lastGood) {
    // Cheap identity check: JSON.parse always returns a fresh object, so this
    // runs once per successful edit.
    setLastGood(parsed.spec);
  }
  const renderSpec = parsed.ok ? parsed.spec : lastGood;

  const seed = active?.seed;
  const store = useMemo(
    () => createStateStore(structuredClone(seed ?? {})),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, mode, resetCount],
  );

  const issues = useMemo(() => {
    if (!renderSpec || typeof renderSpec !== 'object') return null;
    try {
      return validateSpec(renderSpec, { checkOrphans: true });
    } catch {
      return null;
    }
  }, [renderSpec]);

  if (!active) return null;

  const errors = issues?.issues.filter((i) => i.severity === 'error') ?? [];
  const warnings = issues?.issues.filter((i) => i.severity === 'warning') ?? [];

  return (
    <div className="mt-3 overflow-hidden rounded-md border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted px-2.5 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">live</span>
        {failure && (
          <div className="flex items-center gap-0.5">
            {example && (
              <ChromeButton active={mode === 'good'} onClick={() => setMode('good')}>
                works
              </ChromeButton>
            )}
            <ChromeButton active={mode === 'bad'} onClick={() => setMode('bad')}>
              what goes wrong
            </ChromeButton>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {mode === 'bad' && <Pill tone="bad">broken on purpose</Pill>}
          <ChromeButton
            onClick={() => {
              setText(JSON.stringify(active.spec, null, 2));
              setResetCount((n) => n + 1);
            }}
          >
            reset
          </ChromeButton>
        </div>
      </header>

      {active.note && (
        <p
          className={cn(
            'border-b px-2.5 py-1.5 text-[12.5px] leading-relaxed',
            mode === 'bad'
              ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300'
              : 'bg-surface text-muted-foreground',
          )}
        >
          {active.note}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col border-b lg:border-b-0 lg:border-r">
          <div className="min-h-0 overflow-auto" style={{ height }}>
            <JsonEditor value={text} onChange={setText} />
          </div>
          <div className="shrink-0 border-t px-2.5 py-1.5 font-mono text-[11px]">
            {!parsed.ok ? (
              <span className="text-red-600 dark:text-red-400">JSON: {parsed.error}</span>
            ) : errors.length > 0 ? (
              <span className="text-red-600 dark:text-red-400">
                validateSpec: {errors.length} error{errors.length > 1 ? 's' : ''} · {errors[0].code}
              </span>
            ) : warnings.length > 0 ? (
              <span className="text-yellow-700 dark:text-yellow-400">
                validateSpec: valid · {warnings.length} warning{warnings.length > 1 ? 's' : ''} · {warnings[0].code}
              </span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400">validateSpec: valid</span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className={cn('min-h-0 flex-1 overflow-auto p-3', !parsed.ok && 'opacity-45')} style={{ height }}>
            {isNonEmptySpec(renderSpec) ? (
              <RenderGuard resetKey={`${mode}-${resetCount}-${text.length}`}>
                <JSONUIProvider key={`${mode}-${resetCount}`} registry={demoRegistry} store={store}>
                  <Renderer spec={renderSpec} registry={demoRegistry} fallback={UnknownComponent} />
                </JSONUIProvider>
              </RenderGuard>
            ) : (
              <span className="font-mono text-[12px] text-muted-foreground">
                not a spec yet — needs a string `root` and a non-empty `elements`
              </span>
            )}
          </div>
          <StateStrip store={store} />
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="border-t bg-red-50 px-2.5 py-1.5 dark:bg-red-950">
          {errors.slice(0, 4).map((issue, i) => (
            <li key={i} className="font-mono text-[11px] leading-relaxed text-red-700 dark:text-red-300">
              <span className="opacity-70">{issue.code}</span> · {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The state model, live. Small on purpose — it is a sanity check, not a pane. */
function StateStrip({ store }: { store: ReturnType<typeof createStateStore> }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const text = JSON.stringify(snapshot);
  return (
    <div className="shrink-0 border-t bg-muted px-2.5 py-1.5">
      <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">state</span>
      <span className="break-all font-mono text-[11px] text-foreground">
        {text === '{}' ? <span className="text-muted-foreground">empty — this example seeds nothing</span> : text}
      </span>
    </div>
  );
}

/**
 * Some edits THROW rather than fail quietly — `"visible": null` reaches
 * `"$index" in cond` inside evaluateVisibility and takes the render with it.
 * Without a boundary one broken example would blank the whole page, which
 * for a reference of 117 live examples is not acceptable. The boundary
 * resets whenever the spec text changes, so fixing the JSON recovers.
 */
class RenderGuard extends Component<
  { resetKey: string; children: ReactNode },
  { error: Error | null; seenKey: string }
> {
  state = { error: null as Error | null, seenKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  /** A new resetKey means the input changed, so give the tree another go. */
  static getDerivedStateFromProps(
    props: { resetKey: string },
    state: { error: Error | null; seenKey: string },
  ) {
    if (props.resetKey === state.seenKey) return null;
    return { error: null, seenKey: props.resetKey };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <div className="mb-1 uppercase tracking-wide opacity-70">render threw</div>
          {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}
