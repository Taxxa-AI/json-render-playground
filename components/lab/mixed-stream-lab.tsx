'use client';

import type { Spec, StreamChunk } from '@json-render/core';
import {
  applySpecStreamPatch,
  createMixedStreamParser,
  createStateStore,
  pipeJsonRender,
  SPEC_DATA_PART_TYPE,
} from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { Panel } from '../playground/ui';
import type { ChecklistItem } from './checklist';

/**
 * Chat + generative UI: one response containing both prose and patches.
 *
 * `createMixedStreamParser` classifies each line — valid patch, or text — and
 * routes it. This is the client-side counterpart to `pipeJsonRender` on the
 * server.
 */

const RESPONSE = `Sure — here is the position across your three largest clients.
{"op":"add","path":"/root","value":"card"}
{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":"Top clients","subtitle":"By outstanding balance"},"children":["list"]}}
{"op":"add","path":"/elements/list","value":{"type":"Stack","props":{"direction":"column","gap":"sm","align":null,"wrap":null},"repeat":{"statePath":"/rows","key":"id"},"children":["row"]}}
{"op":"add","path":"/elements/row","value":{"type":"Stack","props":{"direction":"row","gap":"md","align":"center","wrap":null},"children":["n","v"]}}
{"op":"add","path":"/elements/n","value":{"type":"Text","props":{"value":{"$item":"name"},"tone":null,"size":null},"children":[]}}
{"op":"add","path":"/elements/v","value":{"type":"Badge","props":{"label":{"$item":"amount"},"tone":"warning"},"children":[]}}
{"op":"add","path":"/state/rows","value":[]}
{"op":"add","path":"/state/rows/0","value":{"id":"1","name":"Borealis AB","amount":"€4,900"}}
{"op":"add","path":"/state/rows/1","value":{"id":"2","name":"Acme Oy","amount":"€3,480"}}
{"op":"add","path":"/state/rows/2","value":{"id":"3","name":"Cygnus AS","amount":"€1,260"}}
Borealis is the one to chase first — it is the largest and the oldest.
Would you like me to draft a reminder email?`;

/**
 * What the AI SDK assembles the transform's chunks into: `message.parts`.
 *
 * The transform emits one `text-delta` per CHARACTER of prose, so the raw
 * chunk list is unreadable and, more to the point, is not what the client ever
 * sees — by the time `useJsonRenderMessage` reads a message, the deltas have
 * been folded back into text parts. Folding them here shows the wire as the
 * client receives it.
 */
type WirePart = { type: string; text?: string; patch?: unknown };

/**
 * Wrap every run of JSONL lines in a ```spec fence.
 *
 * This is the shape a server-side prompt asks the model for, and the only
 * difference between the transform's two classification modes: inside a fence
 * a line is a patch because of where it is, not because it happens to parse.
 */
function fenceSource(src: string): string {
  const out: string[] = [];
  let open = false;
  for (const line of src.split('\n')) {
    const isJsonl = line.trim().startsWith('{');
    if (isJsonl && !open) {
      out.push('```spec');
      open = true;
    } else if (!isJsonl && open) {
      out.push('```');
      open = false;
    }
    out.push(line);
  }
  if (open) out.push('```');
  return out.join('\n');
}

export function useMixedStreamLab() {
  const [source, setSource] = useState(RESPONSE);
  const [text, setText] = useState('');
  const [spec, setSpec] = useState<Spec | null>(null);
  const [running, setRunning] = useState(false);
  const [patchCount, setPatchCount] = useState(0);
  /** Set when a line that STARTS with a brace comes back out of onText. */
  const [sawTricky, setSawTricky] = useState(false);
  const storeRef = useRef(createStateStore({}));
  const [runId, setRunId] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const run = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    storeRef.current = createStateStore({});
    setText('');
    setSpec(null);
    setPatchCount(0);
    setRunId((r) => r + 1);
    setRunning(true);

    const working: Spec = { root: '', elements: {} };

    const parser = createMixedStreamParser({
      onText: (t) => {
        // A prose line beginning with "{" is the classifier's hard case: it
        // buffers, fails to parse it as a patch, and flushes it back as text.
        if (t.trim().startsWith('{')) setSawTricky(true);
        setText((prev) => (prev ? `${prev}\n${t}` : t));
      },
      onPatch: (patch) => {
        applySpecStreamPatch(working as unknown as Record<string, unknown>, patch);
        const p = patch as { path?: string; value?: unknown };
        if (p.path?.startsWith('/state/')) {
          storeRef.current.set(p.path.slice('/state'.length), p.value);
        }
        setPatchCount((n) => n + 1);
        setSpec({ ...working, elements: { ...working.elements } });
      },
    });

    // Feed it in small chunks that deliberately split mid-line, the way a real
    // network read does. The parser buffers until it has a complete line.
    const chunks: string[] = [];
    for (let i = 0; i < source.length; i += 23) chunks.push(source.slice(i, i + 23));

    let i = 0;
    const tick = () => {
      if (i >= chunks.length) {
        parser.flush();
        setRunning(false);
        return;
      }
      parser.push(chunks[i++]);
      timer.current = setTimeout(tick, 22);
    };
    tick();
  }, [source]);

  /**
   * The SERVER half of the same job.
   *
   * `pipeJsonRender` is only a `pipeThrough`, so the identical response can be
   * run here with no key and no route — and that is the whole point of the
   * stage: the classification happens once, upstream, and what reaches the
   * client is already sorted into prose and `data-spec` parts.
   */
  const [fenced, setFenced] = useState(false);
  const [wire, setWire] = useState<WirePart[] | null>(null);
  const [fenceClean, setFenceClean] = useState(false);
  const [piping, setPiping] = useState(false);

  const pipe = useCallback(async () => {
    setPiping(true);
    setWire(null);
    const body = fenced ? fenceSource(source) : source;

    const input = new ReadableStream<StreamChunk>({
      start(controller) {
        // A non-text chunk, to show it survives: the transform only inspects
        // text and passes tool events and step markers straight through.
        controller.enqueue({ type: 'tool-output-available', toolCallId: 'call_1', output: { rows: 3 } });
        controller.enqueue({ type: 'text-start', id: '1' });
        for (let i = 0; i < body.length; i += 23) {
          controller.enqueue({ type: 'text-delta', id: '1', delta: body.slice(i, i + 23) });
        }
        controller.enqueue({ type: 'text-end', id: '1' });
        controller.close();
      },
    });

    const parts: WirePart[] = [];
    const reader = pipeJsonRender(input).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.type === 'text-start') parts.push({ type: 'text', text: '' });
      else if (value.type === 'text-delta') {
        // The chunk union ends in a catch-all `{ type: string }`, so the
        // discriminant narrows nothing — the delta has to be named by hand.
        const last = parts[parts.length - 1];
        if (last?.type === 'text') last.text = (last.text ?? '') + (value as { delta: string }).delta;
      } else if (value.type === 'text-end') continue;
      else if (value.type === SPEC_DATA_PART_TYPE) {
        parts.push({ type: value.type, patch: (value.data as { patch: unknown }).patch });
      } else parts.push({ type: value.type });
    }

    // An empty text part is a block the AI SDK opened and never filled — it is
    // not on the wire in any meaningful sense, so it is not shown as a part.
    const kept = parts.filter((p) => p.type !== 'text' || Boolean(p.text?.trim()));
    setWire(kept);
    setFenceClean(
      fenced &&
        kept.some((p) => p.type === SPEC_DATA_PART_TYPE) &&
        !kept.some((p) => p.type === 'text' && p.text?.includes('```')),
    );
    setPiping(false);
  }, [fenced, source]);

  const hasRoot = Boolean(spec?.root && spec.elements?.[spec.root]);

  const proseLines = text.split('\n').filter(Boolean).length;
  const specParts = wire?.filter((p) => p.type === SPEC_DATA_PART_TYPE).length ?? 0;

  const items: ChecklistItem[] = [
    {
      label: 'Stream one response and watch prose and UI come out of the same lines.',
      done: patchCount > 0,
      steps: [
        <>
          Press <strong>Stream it</strong> at the top left.
        </>,
        <>
          Watch the counter on the right of that bar: <strong>patches</strong> climbs while{' '}
          <strong>text lines</strong> climbs separately. One response, two sinks.
        </>,
        <>
          The <strong>onPatch → rendered UI</strong> panel builds the card row by row as the patches
          land — it is never handed a finished spec.
        </>,
        <>
          Read the note beside the button: the source is cut into 23-character chunks, so most lines
          arrive split in half. The parser buffers until it has a whole line.
        </>,
      ],
      apply: { label: 'stream it', run: () => run() },
    },
    {
      label: <>Read <code>onText</code> and <code>onPatch</code> as two separate sinks.</>,
      done: proseLines >= 3,
      hint: 'createMixedStreamParser classifies each COMPLETE line, then routes it. Nothing else decides.',
      steps: [
        <>
          Look at <strong>onText → prose</strong>: three sentences, in the order the model wrote them.
        </>,
        <>
          Find those same sentences in <strong>the raw model response (editable)</strong> on the left —
          the first line, and the last two.
        </>,
        <>
          Every line between them was JSON, and none of it reached the prose panel.
        </>,
        <>
          In a chat UI these are two different components: the text goes in the bubble, the patches go
          into a spec.
        </>,
      ],
    },
    {
      label: <>Break the classifier: give it a prose line that starts with <code>{'{'}</code>.</>,
      done: sawTricky,
      hint: 'The heuristic buffers any line starting with a brace, tries to parse it, fails, and flushes it back out as text. It recovers — but this is why explicit ```spec fences are better when you can get them.',
      steps: [
        <>
          Click into <strong>the raw model response (editable)</strong>.
        </>,
        <>
          Add a line of prose that begins with a brace —{' '}
          <code>{'{note} see above'}</code> — between two of the patch lines.
        </>,
        <>
          Press <strong>Stream it</strong> again.
        </>,
        <>
          Find that line in <strong>onText → prose</strong>. It was buffered as a suspected patch, failed
          to parse, and was flushed back out as text — and the <strong>patches</strong> counter did not
          move for it.
        </>,
      ],
      apply: {
        label: 'add the tricky line',
        run: () => {
          setSource((prev) =>
            prev.includes('{note} see above')
              ? prev
              : prev.replace(
                  '{"op":"add","path":"/state/rows","value":[]}',
                  '{note} see above\n{"op":"add","path":"/state/rows","value":[]}',
                ),
          );
        },
      },
    },
    {
      label: <>Run the same response through <code>pipeJsonRender</code> and read the wire it produces.</>,
      done: specParts > 0,
      hint: 'Same classifier, one hop earlier. The client is handed message.parts and does no parsing at all — useJsonRenderMessage just picks the data-spec parts out of the array it was given.',
      steps: [
        <>
          Press <strong>Pipe it</strong>. The response is fed in as an AI SDK message stream instead of as plain
          text.
        </>,
        <>
          Read <strong>the wire the client receives</strong>: the prose is <code>text</code>, and every patch is its
          own <code>data-spec</code> part. Nothing on the wire has to be guessed at twice.
        </>,
        <>
          Find the <code>tool-output-available</code> part at the top. Non-text chunks pass through untouched — a
          plain-text route like this playground&rsquo;s cannot carry them at all.
        </>,
        <>
          Note what did <em>not</em> happen: no brace-line was buffered in the browser. This route&rsquo;s{' '}
          <code>/api/chat</code> streams plain text and classifies in the client; that is the other half of the
          choice.
        </>,
      ],
      apply: { label: 'pipe it', run: () => void pipe() },
    },
    {
      label: <>Wrap the patches in a <code>```spec</code> fence — the markers never reach the client.</>,
      done: fenceClean,
      hint: 'Fence mode is preferred because it removes the guess. The cost is that inside a fence a line that fails to parse is dropped outright, where the heuristic would have flushed it back as prose.',
      steps: [
        <>
          Press <strong>fence the patches</strong>, which wraps every run of JSONL lines in{' '}
          <code>```spec</code> … <code>```</code>.
        </>,
        <>
          Press <strong>Pipe it</strong> again.
        </>,
        <>
          The patch count is unchanged and no <code>text</code> part contains a backtick: the transform swallows both
          markers.
        </>,
        <>
          If you added the tricky <code>{'{note} see above'}</code> line earlier, it is now <em>gone</em> rather than
          prose — inside a fence, anything that is not a patch is dropped.
        </>,
      ],
      apply: { label: 'fence the patches', run: () => setFenced(true) },
    },
  ];

  const sourceBox = (
    <Panel title="the raw model response (editable)">
      <textarea
        spellCheck={false}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        className="h-[300px] w-full resize-none bg-transparent p-3 font-mono text-[11.5px] leading-[1.55] text-foreground outline-none"
      />
    </Panel>
  );

  const clientPane = (
    <div className="flex flex-col gap-3">

      <div className="flex items-center gap-2 rounded-lg border bg-surface px-3 py-2">
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded bg-brand px-3 py-1 text-xs font-medium text-brand-foreground disabled:opacity-40"
        >
          {running ? 'Streaming…' : 'Stream it'}
        </button>
        <span className="font-mono text-[11.5px] text-muted-foreground">
          chunked at 23 chars, so lines split mid-token — the parser buffers
        </span>
        <span className="ml-auto font-mono text-[11.5px] text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400">{patchCount}</span> patches ·{' '}
          <span className="text-foreground">{proseLines}</span> text lines
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {sourceBox}

        <div className="flex flex-col gap-3">
          <Panel title="onText → prose">
            <div className="max-h-[120px] min-h-[80px] overflow-auto whitespace-pre-wrap p-3 text-[14px] leading-relaxed text-foreground">
              {text || <span className="text-muted-foreground">Prose lines land here.</span>}
            </div>
          </Panel>
          <Panel title="onPatch → rendered UI" bodyClassName="overflow-auto">
            <div className="p-3" style={{ minHeight: 290, maxHeight: 320 }}>
              {hasRoot ? (
                <JSONUIProvider key={runId} registry={demoRegistry} store={storeRef.current}>
                  <Renderer spec={spec} registry={demoRegistry} loading={running} fallback={UnknownComponent} />
                </JSONUIProvider>
              ) : (
                <div className="flex h-[140px] items-center justify-center text-[12px] text-muted-foreground">
                  Press &ldquo;Stream it&rdquo;.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <div className="rounded-lg border bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Try breaking the classifier.</strong> Add a prose line that begins with{' '}
        <code>{'{'}</code> — say <code>{'{note} see above'}</code> — and stream again. The heuristic buffers any line
        starting with a brace, tries to parse it as a patch, fails, and flushes it back out as text. It recovers, but
        the round trip is why the server-side transform prefers explicit <code>```spec</code> fences when it can get
        them: fencing removes the guesswork entirely.
      </div>
    </div>
  );

  const serverPane = (
    <div className="flex flex-col gap-3">

      <div className="flex items-center gap-2 rounded-lg border bg-surface px-3 py-2">
        <button
          type="button"
          onClick={() => void pipe()}
          disabled={piping}
          className="rounded bg-brand px-3 py-1 text-xs font-medium text-brand-foreground disabled:opacity-40"
        >
          {piping ? 'Piping…' : 'Pipe it'}
        </button>
        <button
          type="button"
          onClick={() => setFenced((f) => !f)}
          className={`rounded border px-2.5 py-1 text-xs ${
            fenced ? 'border-orange-500 text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {fenced ? 'fenced' : 'fence the patches'}
        </button>
        <span className="font-mono text-[11.5px] text-muted-foreground">
          {fenced ? 'FENCE mode — position decides' : 'HEURISTIC mode — a leading brace decides'}
        </span>
        <span className="ml-auto font-mono text-[11.5px] text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400">{specParts}</span> data-spec ·{' '}
          <span className="text-foreground">{(wire?.length ?? 0) - specParts}</span> other parts
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {sourceBox}

        <Panel title="the wire the client receives">
          <div className="flex flex-col gap-1.5 overflow-auto p-3" style={{ height: 300 }}>
            {wire === null && <span className="text-[12px] text-muted-foreground">Press &ldquo;Pipe it&rdquo;.</span>}
            {wire?.map((part, i) => (
              <div key={i} className="flex gap-2 font-mono text-[11.5px] leading-[1.5]">
                <span
                  className={
                    part.type === SPEC_DATA_PART_TYPE
                      ? 'shrink-0 text-emerald-600 dark:text-emerald-400'
                      : 'shrink-0 text-muted-foreground'
                  }
                >
                  {part.type}
                </span>
                <span className="min-w-0 break-all text-foreground">
                  {part.type === SPEC_DATA_PART_TYPE ? (
                    JSON.stringify(part.patch)
                  ) : part.type === 'text' ? (
                    part.text
                  ) : (
                    <span className="text-muted-foreground">passed through untouched</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="rounded-lg border bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Same classifier, one hop earlier.</strong> <code>pipeJsonRender</code> is
        a <code>pipeThrough</code> over an AI SDK message stream, so it runs offline here with no route and no key —
        on a real server it wraps <code>result.toUIMessageStream()</code>. Patches leave as{' '}
        <code>data-spec</code> parts, prose as text, and tool events pass through untouched. The client then does no
        parsing at all: <code>useJsonRenderMessage(message.parts)</code> reads the array it was handed. This
        playground&rsquo;s <code>/api/chat</code> takes the other path — plain text on the wire, classified in the
        browser by <code>createMixedStreamParser</code> — which is what the three stages before this one showed.
      </div>
    </div>
  );

  /** `focus` comes from the stage, so the server wire is not on screen while you are reading about the client one. */
  const body = (focus?: string) => (focus === 'server' ? serverPane : clientPane);

  return { items, body };
}

/** The view on its own, for anywhere that does not stage it. */
export function MixedStreamLab() {
  return useMixedStreamLab().body();
}
