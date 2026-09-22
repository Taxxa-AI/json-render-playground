'use client';

import { JSONUIProvider, Renderer, type SetState, useUIStream } from '@json-render/react';
import { useEffect, useMemo, useState } from 'react';
import { directives, functions } from '../../lib/directives';
import { UnknownComponent, handlers, registry } from '../../lib/registry';
import { appStore } from '../../lib/store';

/**
 * THE GENERATE CLIENT.
 *
 * `useUIStream` owns the transport: it POSTs, reads the text stream, parses
 * each JSONL line into a patch and applies it. You get a `spec` that grows
 * while the response is still arriving.
 */
export default function GeneratePage() {
  const [prompt, setPrompt] = useState('A review screen for my three overdue invoices');
  const { spec, isStreaming, error, usage, send } = useUIStream({ api: '/api/generate' });

  const setState = useMemo<SetState>(
    () => (updater) => {
      const next = updater(appStore.getSnapshot());
      appStore.update(Object.fromEntries(Object.entries(next).map(([key, value]) => [`/${key}`, value])));
    },
    [],
  );
  const actionHandlers = useMemo(() => handlers(() => setState, () => appStore.getSnapshot()), [setState]);

  /**
   * THE ONE THING EVERYBODY MISSES: the renderer never reads `spec.state`.
   * The model emits /state patches, the hook collects them onto the spec,
   * and unless you copy them into your store every `$state` reads undefined.
   */
  useEffect(() => {
    if (!spec?.state) return;
    appStore.update(Object.fromEntries(Object.entries(spec.state).map(([key, value]) => [`/${key}`, value])));
  }, [spec]);

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Send the live state as context so the model names paths that exist.
          void send(prompt, { state: appStore.getSnapshot() });
        }}
        className="flex gap-2"
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-[13px] dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={isStreaming}
          className="rounded-md bg-zinc-900 px-3 py-1 text-[12px] text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isStreaming ? 'Generating…' : 'Generate'}
        </button>
      </form>

      {error ? <p className="text-[12px] text-red-600">{error.message}</p> : null}
      {usage ? <p className="font-mono text-[11px] text-zinc-500">{usage.totalTokens} tokens</p> : null}

      <JSONUIProvider
        registry={registry}
        store={appStore}
        handlers={actionHandlers}
        functions={functions}
        directives={directives}
        validationFunctions={{
          notPlaceholder: (value) => String(value ?? '').trim().toUpperCase() !== 'TODO',
        }}
      >
        {/* `loading` is forwarded to every component as a prop, so a half-built
            tree can render a skeleton instead of flickering. */}
        <Renderer spec={spec} registry={registry} loading={isStreaming} fallback={UnknownComponent} />
      </JSONUIProvider>
    </div>
  );
}
