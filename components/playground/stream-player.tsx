'use client';

import type { Spec } from '@json-render/core';
import { createSpecStreamCompiler, createStateStore } from '@json-render/core';
import type { Components } from '@json-render/react';
import { defineRegistry, JSONUIProvider, Renderer } from '@json-render/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { demoCatalog } from '@/lib/demo/catalog';
import { demoComponentImpls } from '@/lib/demo/components';
import { guardAll } from '@/lib/demo/guard';
import { UnknownComponent } from '@/lib/demo/registry';
import { STREAM_SCRIPT } from '@/lib/demo/stream-script';
import type { ChecklistItem } from '../lab/checklist';
import { Panel } from './ui';

const SPEEDS = [
  { label: '0.5×', ms: 700 },
  { label: '1×', ms: 350 },
  { label: '2×', ms: 150 },
  { label: '8×', ms: 35 },
];

/** The placeholder a component draws for the elements still on the wire. */
function ArrivingSkeleton({ onSeen }: { onSeen: () => void }) {
  // Mounting IS the proof that ctx.loading was true — the checklist reads this
  // rather than the player's own `done` flag, which a component never sees.
  useEffect(() => {
    onSeen();
  }, [onSeen]);

  return (
    <div aria-busy="true" className="flex flex-col gap-1.5">
      <div className="h-16 animate-pulse rounded-md border border-dashed bg-surface-hover" />
      <span className="font-mono text-[11px] text-muted-foreground">ctx.loading — more is still arriving</span>
    </div>
  );
}

/**
 * The demo registry, with one component that reads `ctx.loading`.
 *
 * `lib/demo/components.tsx` ignores the flag on purpose: every other lab
 * renders a finished spec, so there is nothing to wait for. Streaming is the
 * one place it means something, so the player builds its own registry whose
 * `Screen` draws a skeleton underneath whatever has landed so far. Nothing in
 * json-render sets `loading` for you — `<Renderer loading>` is the only source,
 * and it reaches every component unchanged.
 */
function streamingRegistry(onSkeleton: () => void) {
  const impls: Components<typeof demoCatalog> = {
    ...demoComponentImpls,
    Screen: (ctx) => (
      <>
        {demoComponentImpls.Screen(ctx)}
        {ctx.loading ? <ArrivingSkeleton onSeen={onSkeleton} /> : null}
      </>
    ),
  };

  return defineRegistry(demoCatalog, {
    components: guardAll(impls),
    actions: { submit: async () => {}, notify: async () => {}, reset: async () => {} },
  }).registry;
}

export function useStreamPlayer() {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  /** The spec as `push()` returned it. See `chunked` below for why not getResult(). */
  const [spec, setSpec] = useState<Spec | null>(null);

  // Half-line delivery: what the compiler is holding, and how many lines it has
  // reassembled from two chunks.
  const [chunked, setChunked] = useState(false);
  const [held, setHeld] = useState<string | null>(null);
  const [rejoined, setRejoined] = useState(0);

  const [skeletonSeen, setSkeletonSeen] = useState(false);

  // One compiler and one store per run. Resetting means making new ones.
  const compilerRef = useRef(createSpecStreamCompiler<Spec>());
  const storeRef = useRef(createStateStore({}));
  const cursorRef = useRef(0);
  const heldRef = useRef<string | null>(null);
  // Did the half that went out apply nothing? That is what "buffered" means.
  const heldNothingRef = useRef(false);
  const [runId, setRunId] = useState(0);

  const registry = useMemo(() => streamingRegistry(() => setSkeletonSeen(true)), []);

  const reset = useCallback(() => {
    compilerRef.current = createSpecStreamCompiler<Spec>();
    storeRef.current = createStateStore({});
    cursorRef.current = 0;
    heldRef.current = null;
    heldNothingRef.current = false;
    setCursor(0);
    setSpec(null);
    setHeld(null);
    setRejoined(0);
    setSkeletonSeen(false);
    setPlaying(false);
    setRunId((r) => r + 1);
  }, []);

  /** The host app's job: copy /state patches into the live store. */
  const mirrorState = useCallback((line: string) => {
    try {
      // The compiler builds spec.state, but the RENDERER never reads it.
      // Mirroring state patches into the live store is the host app's job —
      // this is the single most-missed step when wiring up streaming.
      const patch = JSON.parse(line) as { op: string; path: string; value?: unknown };
      if (patch.path === '/state' && patch.value && typeof patch.value === 'object') {
        for (const [k, v] of Object.entries(patch.value as Record<string, unknown>)) {
          storeRef.current.set(`/${k}`, v);
        }
      } else if (patch.path.startsWith('/state/')) {
        storeRef.current.set(patch.path.slice('/state'.length), patch.value);
      }
    } catch {
      /* a malformed line is simply skipped, exactly as the compiler does */
    }
  }, []);

  /**
   * Feed the next thing into the compiler: one whole line, or half of one.
   *
   * The cursor lives in a ref as well as in state because a half-line step
   * must not advance it — the line is not on the wire until both halves are.
   */
  const stepOnce = useCallback(() => {
    const at = cursorRef.current;
    if (at >= STREAM_SCRIPT.length) return;
    const line = STREAM_SCRIPT[at];

    if (chunked && heldRef.current === null) {
      // Cut inside the JSON object on purpose: half a line can never parse.
      const first = line.slice(0, Math.max(8, Math.floor(line.length * 0.6)));
      const { newPatches } = compilerRef.current.push(first);
      heldRef.current = first;
      heldNothingRef.current = newPatches.length === 0;
      setHeld(first);
      return;
    }

    // This is the whole streaming API: push a chunk, read what came back.
    const rest = heldRef.current ? line.slice(heldRef.current.length) : line;
    const { result, newPatches } = compilerRef.current.push(`${rest}\n`);
    if (heldRef.current && heldNothingRef.current && newPatches.length === 1) {
      setRejoined((n) => n + 1);
    }
    heldRef.current = null;
    heldNothingRef.current = false;
    setHeld(null);

    mirrorState(line);

    cursorRef.current = at + 1;
    setCursor(at + 1);
    // The compiler keeps one result object, so React needs a fresh reference.
    setSpec({ ...result });
  }, [chunked, mirrorState]);

  useEffect(() => {
    if (!playing) return;
    if (cursor >= STREAM_SCRIPT.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(stepOnce, SPEEDS[speed].ms);
    return () => clearTimeout(t);
  }, [playing, cursor, held, speed, stepOnce]);

  const done = cursor >= STREAM_SCRIPT.length;
  const hasRoot = Boolean(spec?.root && spec.elements?.[spec.root]);

  const elementCount = useMemo(() => Object.keys(spec?.elements ?? {}).length, [spec]);

  // Checklist signals, read straight off the run: the store the /state patches
  // were mirrored into, and the prop the last line rewrites.
  const invoices = storeRef.current.getSnapshot().invoices as unknown[] | undefined;
  const m3Tone = (spec?.elements?.m3?.props as { tone?: unknown } | undefined)?.tone;

  const items: ChecklistItem[] = [
    {
      label: 'Step through the first three patches by hand.',
      done: cursor >= 3,
      steps: [
        <>
          Press <strong>Step</strong> once. Line <strong>01</strong> lights up on{' '}
          <strong>the wire · JSONL patches</strong> and the left pane still says{' '}
          <em>Nothing yet — the spec has no root</em>: <code>/root</code> names an element nobody has
          sent.
        </>,
        <>
          Press <strong>Step</strong> again. Now <code>/elements/screen</code> exists and the title
          renders.
        </>,
        <>
          Press <strong>Step</strong> a third time and watch the counter read{' '}
          <strong>patch 3/17</strong> with <strong>elements 2</strong> beside it.
        </>,
        <>
          Each press is one <code>compiler.push(line)</code>, and the spec it hands back is what the
          left pane renders. That is the entire streaming API.
        </>,
      ],
      apply: { label: 'step once', run: () => { setPlaying(false); stepOnce(); } },
    },
    {
      label: <>Get the three green <code>/state</code> patches in and fill the invoice rows.</>,
      done: Array.isArray(invoices) && invoices.length >= 3,
      hint: 'The compiler writes them into spec.state. The renderer never reads spec.state — this player copies them into the store itself, and that copy is code you write.',
      steps: [
        <>
          Keep pressing <strong>Step</strong> (or press <strong>Play</strong> and{' '}
          <strong>Pause</strong> around line 16).
        </>,
        <>
          Watch line <strong>08</strong> go by: <code>/elements/list</code> carries{' '}
          <code>repeat</code>, and renders nothing at all — there is no data yet.
        </>,
        <>
          Step past lines <strong>13</strong> to <strong>16</strong>, the green ones. Each is a{' '}
          <code>/state/invoices</code> patch.
        </>,
        <>
          Three invoice rows appear as the items land. They are reading the store this player mirrored
          those patches into, not <code>spec.state</code>.
        </>,
      ],
    },
    {
      label: <>Run it to the end and catch the late <code>replace</code>.</>,
      done: done && m3Tone === 'warning',
      steps: [
        <>
          Press <strong>Play</strong> and let it finish — the status on the right turns{' '}
          <strong>complete</strong>.
        </>,
        <>
          Read the last line, <strong>17</strong>: a <code>replace</code> on{' '}
          <code>/elements/m3/props/tone</code>, a path the model had already sent.
        </>,
        <>
          Watch the <em>Margin</em> metric change colour when it lands — from{' '}
          <code>danger</code> to <code>warning</code>. Models revise; your renderer has to tolerate it.
        </>,
        <>
          Press <strong>Reset</strong> and then <strong>2×</strong> to watch the whole build again at
          speed — the first paint happens at line 2 of 17.
        </>,
      ],
      apply: {
        label: 'play it to the end',
        run: () => {
          setSpeed(2);
          setPlaying(true);
        },
      },
    },
    {
      label: <>Catch the skeleton the page draws for itself, then watch it go when the stream closes.</>,
      done: skeletonSeen && done,
      hint: 'ctx.loading is one boolean, passed to <Renderer loading> and forwarded unchanged to every component — not per element, and not per action. Nothing sets it for you: omit the prop and it is undefined everywhere. The renderer also uses it to stay silent about children that have not arrived yet.',
      steps: [
        <>
          Press <strong>Reset</strong>, then <strong>0.5×</strong>, then <strong>Play</strong>.
        </>,
        <>
          From line <strong>02</strong> on, a dashed pulsing block sits under the page with{' '}
          <code>ctx.loading — more is still arriving</code> beneath it. That is this player&rsquo;s{' '}
          <code>Screen</code> component reading the flag; the demo registry every other lab uses
          ignores it.
        </>,
        <>
          Press <strong>Pause</strong> mid-stream. The skeleton stays: it is tied to{' '}
          <code>loading</code>, not to how much has arrived.
        </>,
        <>
          Press <strong>Play</strong> and let it reach <strong>complete</strong>. The player passes{' '}
          <code>loading={'{!done}'}</code>, so the block disappears on the same render the last patch
          lands on.
        </>,
      ],
      apply: {
        label: 'replay it slowly',
        run: () => {
          reset();
          setSpeed(0);
          setPlaying(true);
        },
      },
    },
    {
      label: <>Deliver two lines as half-line chunks and watch the compiler hold the fragment.</>,
      done: rejoined >= 2,
      hint: 'push() splits what it has on newlines and keeps the tail — anything after the last one — in a buffer until the rest arrives, so a chunk that ends mid-line costs nothing. getResult() is the exception: it empties that buffer, dropping a fragment that cannot parse. This player renders what push() returned for exactly that reason.',
      steps: [
        <>
          Press <strong>Reset</strong>, then <strong>half-line chunks</strong> — the button lights up.
        </>,
        <>
          Press <strong>Step</strong>. Line <strong>01</strong> is now part bright, part dim: the
          bright part is inside the compiler&rsquo;s buffer. <strong>patch 0/17</strong> and{' '}
          <strong>elements 0</strong> have not moved, because half a line parses as nothing.
        </>,
        <>
          Press <strong>Step</strong> again. The rest of the line goes out, the patch applies, and{' '}
          <strong>rejoined 1</strong> appears beside the counters.
        </>,
        <>
          Do the same for line <strong>02</strong> — two presses, one element — until{' '}
          <strong>rejoined 2</strong>. Network chunks land wherever they land; this is why that does
          not matter.
        </>,
      ],
      apply: {
        label: 'turn on half-line chunks',
        run: () => {
          setPlaying(false);
          setChunked(true);
        },
      },
    },
  ];

  const body = (
    <div className="flex flex-col gap-3">
      {/* transport */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-surface px-3 py-2">
        <button
          type="button"
          onClick={() => {
            if (done) reset();
            setPlaying((p) => !p);
          }}
          className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-brand-foreground transition hover:opacity-90"
        >
          {playing ? 'Pause' : done ? 'Replay' : 'Play'}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            stepOnce();
          }}
          disabled={done}
          className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40"
        >
          Step
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setChunked((c) => !c)}
          className={`rounded-md border px-2.5 py-1 text-xs transition ${
            chunked ? 'border-brand text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          half-line chunks
        </button>

        <div className="ml-1 flex items-center gap-0.5">
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setSpeed(i)}
              className={`rounded px-1.5 py-0.5 font-mono text-[11px] transition ${
                speed === i ? 'bg-surface-hover text-foreground' : 'text-muted-foreground hover:text-muted-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 font-mono text-[12px] text-muted-foreground">
          <span>
            patch <span className="tabular-nums text-foreground">{cursor}</span>/{STREAM_SCRIPT.length}
          </span>
          <span>
            elements <span className="tabular-nums text-foreground">{elementCount}</span>
          </span>
          {chunked && (
            <span className={held ? 'text-orange-600 dark:text-orange-400' : ''}>
              {held ? 'buffered ½' : `rejoined ${rejoined}`}
            </span>
          )}
          <span className={done ? 'text-emerald-600 dark:text-emerald-400' : playing ? 'text-yellow-600 dark:text-yellow-400' : ''}>
            {done ? 'complete' : playing ? 'streaming' : 'paused'}
          </span>
        </div>
      </div>

      {/* progress */}
      <div className="h-0.5 overflow-hidden rounded-full bg-surface-hover">
        <div
          className="h-full bg-brand transition-[width] duration-150"
          style={{ width: `${(cursor / STREAM_SCRIPT.length) * 100}%` }}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="rendered so far" bodyClassName="overflow-auto">
          <div className="p-4" style={{ minHeight: 520, maxHeight: 600 }}>
            {hasRoot ? (
              <JSONUIProvider key={runId} registry={registry} store={storeRef.current}>
                <Renderer spec={spec} registry={registry} loading={!done} fallback={UnknownComponent} />
              </JSONUIProvider>
            ) : (
              <div className="flex h-[360px] items-center justify-center text-xs text-muted-foreground">
                Nothing yet — the spec has no root. Press Play.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="the wire · JSONL patches">
          <div className="overflow-auto p-2 font-mono text-[11.5px] leading-[1.6]" style={{ maxHeight: 600, minHeight: 520 }}>
            {STREAM_SCRIPT.map((line, i) => {
              const sent = i < cursor;
              const current = i === cursor - 1;
              const isState = line.includes('"/state');
              // The one line that is half on the wire: bright up to the cut.
              const cut = held && i === cursor ? held.length : 0;
              return (
                <div
                  key={i}
                  className={`flex gap-2 rounded px-1.5 py-0.5 transition-colors ${
                    current || cut ? 'bg-orange-50 dark:bg-orange-950' : ''
                  } ${sent || cut ? '' : 'opacity-25'}`}
                >
                  <span className="shrink-0 tabular-nums text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                  <span className={`min-w-0 break-all ${isState ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {cut ? (
                      <>
                        {line.slice(0, cut)}
                        <span className="opacity-30">{line.slice(cut)}</span>
                      </>
                    ) : (
                      line
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );

  return { items, body };
}

/** The view on its own, for anywhere that does not stage it. */
export function StreamPlayer() {
  return useStreamPlayer().body;
}
