'use client';

import type { Spec } from '@json-render/core';
import { createStateStore } from '@json-render/core';
import { JSONUIProvider, Renderer, useChatUI } from '@json-render/react';
import { useEffect, useRef, useState } from 'react';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import type { ChecklistItem } from './checklist';

/**
 * A full chat loop where any assistant turn may carry a UI.
 *
 * Each message gets its OWN state store, because two generated UIs in the same
 * conversation will happily both bind to /form/email and would otherwise share
 * a value. Per-message isolation is not something the library does for you.
 */

const SUGGESTIONS = [
  'Hello — what can you build?',
  'Show me a KPI row for revenue, outstanding and margin.',
  'Now give me a short form to record a new expense claim.',
];

function MessageUI({ spec }: { spec: Spec }) {
  // One store per message, seeded from the spec's own state.
  const store = useRef(createStateStore(structuredClone(spec.state ?? {}))).current;
  return (
    <div className="mt-2 rounded-lg border bg-background p-3">
      <JSONUIProvider registry={demoRegistry} store={store}>
        <Renderer spec={spec} registry={demoRegistry} fallback={UnknownComponent} />
      </JSONUIProvider>
    </div>
  );
}

export function useChatLab({ hasKey }: { hasKey: boolean }) {
  const [input, setInput] = useState(SUGGESTIONS[0]);
  const { messages, isStreaming, error, send, clear } = useChatUI({ api: '/api/chat' });
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const assistant = messages.filter((m) => m.role === 'assistant');
  const hasSpec = (m: (typeof assistant)[number]) => Boolean(m.spec?.root && m.spec.elements?.[m.spec.root]);
  const proseOnly = assistant.some((m) => Boolean(m.text) && !hasSpec(m) && !isStreaming);
  const specTurn = assistant.some(hasSpec);
  const mixedTurn = assistant.some((m) => Boolean(m.text) && hasSpec(m));
  const twoUIs = assistant.filter(hasSpec).length >= 2;

  const items: ChecklistItem[] = [
    {
      label: 'Send the greeting and get prose back with no UI.',
      done: proseOnly,
      hint: 'The chat route overrides the catalog prompt\'s "output ONLY JSONL" rule. Without that, this turn would be a dashboard.',
      steps: [
        <>
          Click the first suggestion chip under the message box —{' '}
          <strong>&ldquo;{SUGGESTIONS[0]}&rdquo;</strong>. It fills the box.
        </>,
        <>
          Press <strong>Send</strong>.
        </>,
        <>
          Watch the assistant turn appear. Its header shows <strong>text</strong> and{' '}
          <em>not</em> <strong>+ spec</strong>.
        </>,
        <>
          Confirm no bordered UI panel appeared under the reply — a greeting is prose, and nothing else.
        </>,
      ],
      apply: { label: 'put it in the box', run: () => setInput(SUGGESTIONS[0]) },
    },
    {
      label: 'Ask for a KPI row and get a turn that carries a spec.',
      done: specTurn,
      steps: [
        <>
          Click the second suggestion chip —{' '}
          <strong>&ldquo;{SUGGESTIONS[1]}&rdquo;</strong>.
        </>,
        <>
          Press <strong>Send</strong> and watch the metrics assemble while the patches arrive.
        </>,
        <>
          The turn&rsquo;s header now carries a green <strong>+ spec</strong>, and a bordered panel holds
          three Metric components.
        </>,
      ],
      apply: { label: 'put it in the box', run: () => setInput(SUGGESTIONS[1]) },
    },
    {
      label: 'Get a turn with both prose and a spec — the parser interleaves them.',
      done: mixedTurn,
      steps: [
        <>
          Type a request that asks for a sentence as well as a UI, such as{' '}
          <em>&ldquo;Explain what you are about to show me, then show me a KPI row.&rdquo;</em>
        </>,
        <>
          Press <strong>Send</strong>.
        </>,
        <>
          Look at the turn&rsquo;s header: it reads <strong>text</strong> <em>and</em>{' '}
          <strong>+ spec</strong>.
        </>,
        <>
          The grey prose bubble sits above the bordered UI, because{' '}
          <code>useChatUI</code> classified each line as it arrived.
        </>,
      ],
      apply: {
        label: 'put it in the box',
        run: () => setInput('Explain in one sentence what you are about to show me, then show me a KPI row for revenue, outstanding and margin.'),
      },
    },
    {
      label: 'Have two UIs in one conversation. Type in one; the other does not change — each message has its own store.',
      done: twoUIs,
      hint: 'MessageUI creates one createStateStore per message. Nothing in the library isolates them for you.',
      steps: [
        <>
          Click the third suggestion chip —{' '}
          <strong>&ldquo;{SUGGESTIONS[2]}&rdquo;</strong> — and press <strong>Send</strong>.
        </>,
        <>
          Scroll up: two assistant turns now carry <strong>+ spec</strong>.
        </>,
        <>
          Type into an input in the newest UI, then look at the same field in the earlier one. It does not
          move.
        </>,
        <>
          That isolation is <code>MessageUI</code>, one <code>createStateStore</code> per message — not
          something the library does for you.
        </>,
      ],
      apply: { label: 'put it in the box', run: () => setInput(SUGGESTIONS[2]) },
    },
  ];

  const body = (
    <div className="flex flex-col gap-3">

      {!hasKey && (
        <div className="rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950 px-3.5 py-2.5 text-xs text-yellow-600 dark:text-yellow-400">
          <strong>No gateway key.</strong> Add <code>AI_GATEWAY_API_KEY</code> to <code>.env</code> to run this.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-surface">
        <div ref={scroller} className="flex flex-col gap-4 overflow-y-auto p-4" style={{ height: 600 }}>
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
              Ask for something. A turn can come back as prose, as UI, or as both.
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={m.role === 'user' ? 'max-w-[80%]' : 'w-full'}>
                <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  {m.role}
                  {m.role === 'assistant' && (
                    <>
                      {m.text && <span className="ml-1.5 text-muted-foreground">text</span>}
                      {m.spec && <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">+ spec</span>}
                    </>
                  )}
                </div>

                {m.text && (
                  <div
                    className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-[14.5px] leading-relaxed ${
                      m.role === 'user' ? 'bg-brand text-brand-foreground' : 'bg-muted text-foreground'
                    }`}
                  >
                    {m.text}
                  </div>
                )}

                {m.spec && m.spec.root && m.spec.elements?.[m.spec.root] && <MessageUI spec={m.spec} />}

                {m.role === 'assistant' && !m.text && !m.spec && isStreaming && (
                  <div className="text-[13px] text-muted-foreground">thinking…</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="border-t bg-red-50 dark:bg-red-950 px-3 py-2 font-mono text-[12px] text-red-600 dark:text-red-400">
            {error.message}
          </div>
        )}

        <div className="border-t p-2.5">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && hasKey && !isStreaming && input.trim()) {
                  e.preventDefault();
                  const t = input;
                  setInput('');
                  void send(t);
                }
              }}
              placeholder="Message…"
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-orange-500"
            />
            <button
              type="button"
              disabled={!hasKey || isStreaming || !input.trim()}
              onClick={() => {
                const t = input;
                setInput('');
                void send(t);
              }}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-40"
            >
              {isStreaming ? '…' : 'Send'}
            </button>
            <button
              type="button"
              onClick={clear}
              className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="rounded-sm border px-2 py-0.5 text-[12px] text-muted-foreground transition hover:border-orange-500 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Send the greeting first.</strong> It should come back as prose with no UI — that
        is the case most chat+GenUI integrations get wrong, because the catalog prompt ends with &ldquo;output ONLY
        JSONL patches, no markdown&rdquo;. The chat route has to explicitly override that rule, and tell the model
        prose lines must never start with <code>{'{'}</code>, or the heuristic classifier will swallow them.
      </div>
    </div>
  );

  return { items, body };
}

/** The view on its own, for anywhere that does not stage it. */
export function ChatLab({ hasKey }: { hasKey: boolean }) {
  return useChatLab({ hasKey }).body;
}
