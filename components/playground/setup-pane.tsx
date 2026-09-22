'use client';

import { useState } from 'react';
import {
  CATALOG_ENTRIES,
  DEMO_FILES,
  HANDLER_ENTRIES,
  IMPL_ENTRIES,
  LIB_BLOCKS,
} from '@/lib/demo/source.generated';
import { useLabSetup } from '@/lib/labs/setup';
import { usedComponentTypes } from './source-pane';
import { CodeBlock } from './code-block';
import { cn } from '@/lib/utils';

/**
 * The whole json-render setup behind what is currently on screen.
 *
 * Reading a lab teaches you what the library DOES; this is where you see what
 * it IS. Every block below is sliced from the real files by
 * `scripts/gen-source.ts` on every build, so it cannot drift from the code
 * that just rendered the panel beside it.
 *
 * Ordered the way the dependency arrow runs — spec → catalog → registry →
 * the provider call — because that is the order the questions arrive in.
 */
export function SetupPane() {
  const setup = useLabSetup();
  const [open, setOpen] = useState<string | null>('spec');

  const types = usedComponentTypes(setup.spec);
  const used = types.filter((t) => CATALOG_ENTRIES[t] || IMPL_ENTRIES[t]);
  const handlers = (setup.handlers ?? []).filter((h) => HANDLER_ENTRIES[h]);

  const own = setup.sources ?? [];

  if (!setup.spec) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {own.length > 0
            ? 'This lab builds its own catalog and registry rather than using the shared demo one. Here it is.'
            : 'This step is not a spec playground, so there is no live spec to show — but the shared setup every lab is built on is here.'}
        </p>
        {own.map((src) => (
          <Section key={src.label} id={src.label} title={src.label} note="This lab's own source." open={open} onToggle={setOpen}>
            <CodeBlock code={src.code} lang={src.lang ?? 'tsx'} maxHeight={340} />
          </Section>
        ))}
        <Section id="files" title="the whole files" note="The shared demo setup, end to end." open={open} onToggle={setOpen}>
          {Object.entries(DEMO_FILES).map(([path, code]) => (
            <Labelled key={path} label={path}>
              <CodeBlock code={code} lang={path.endsWith('.tsx') ? 'tsx' : 'typescript'} maxHeight={320} />
            </Labelled>
          ))}
        </Section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Everything behind the panel you are looking at, sliced live from the real files — what you read here is what
        just ran.{' '}
        {used.length > 0
          ? `${used.length} component${used.length === 1 ? '' : 's'} of the shared demo catalog in play.`
          : own.length > 0
            ? 'This lab builds its own catalog and registry rather than using the shared demo one.'
            : ''}
      </p>

      <Section
        id="spec"
        title="the spec on screen"
        note="The JSON the renderer is walking right now."
        open={open}
        onToggle={setOpen}
      >
        <CodeBlock code={JSON.stringify(setup.spec, null, 2)} lang="json" maxHeight={340} />
      </Section>

      {setup.seed && Object.keys(setup.seed).length > 0 && (
        <Section
          id="seed"
          title="the state it was seeded with"
          note="<Renderer> never reads spec.state — the host seeds the store. This is that seed."
          open={open}
          onToggle={setOpen}
        >
          <CodeBlock code={JSON.stringify(setup.seed, null, 2)} lang="json" maxHeight={220} />
        </Section>
      )}

      {own.map((src) => (
        <Section key={src.label} id={src.label} title={src.label} note="This lab's own source." open={open} onToggle={setOpen}>
          <CodeBlock code={src.code} lang={src.lang ?? 'tsx'} maxHeight={340} />
        </Section>
      ))}

      {used.length > 0 && (
      <>
      <Section
        id="catalog"
        title={`catalog entries · ${used.length} in use`}
        note="What each name in the spec is allowed to carry. lib/demo/catalog.ts."
        open={open}
        onToggle={setOpen}
      >
        {used.map((t) => (
          <Labelled key={t} label={t}>
            <CodeBlock code={CATALOG_ENTRIES[t] ?? '// not in the catalog'} lang="typescript" maxHeight={220} />
          </Labelled>
        ))}
      </Section>

      <Section
        id="impl"
        title="the React those names render as"
        note="One registry entry per catalog name. lib/demo/components.tsx."
        open={open}
        onToggle={setOpen}
      >
        {used.map((t) => (
          <Labelled key={t} label={t}>
            <CodeBlock code={IMPL_ENTRIES[t] ?? '// no implementation'} lang="tsx" maxHeight={260} />
          </Labelled>
        ))}
      </Section>
      </>
      )}

      {handlers.length > 0 && (
        <Section
          id="handlers"
          title={`action handlers · ${handlers.length}`}
          note="Your code, reached by name from an action binding. lib/demo/action-handlers.ts."
          open={open}
          onToggle={setOpen}
        >
          {handlers.map((h) => (
            <Labelled key={h} label={h}>
              <CodeBlock code={HANDLER_ENTRIES[h]} lang="typescript" maxHeight={220} />
            </Labelled>
          ))}
        </Section>
      )}

      <Section
        id="provider"
        title="the provider call"
        note="The one call that connects all of the above. Everything on screen is downstream of it."
        open={open}
        onToggle={setOpen}
      >
        <CodeBlock code={LIB_BLOCKS['SpecPlayground.provider'] ?? ''} lang="tsx" maxHeight={300} />
      </Section>

      <Section
        id="files"
        title="the whole files"
        note="Nothing sliced or summarised — the setup end to end."
        open={open}
        onToggle={setOpen}
      >
        {Object.entries(DEMO_FILES).map(([path, code]) => (
          <Labelled key={path} label={path}>
            <CodeBlock code={code} lang={path.endsWith('.tsx') ? 'tsx' : 'typescript'} maxHeight={320} />
          </Labelled>
        ))}
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  note,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  note: string;
  open: string | null;
  onToggle: (next: string | null) => void;
  children: React.ReactNode;
}) {
  const isOpen = open === id;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => onToggle(isOpen ? null : id)}
        className={cn(
          'flex w-full items-baseline gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-hover',
          isOpen && 'bg-surface',
        )}
      >
        <span className="font-mono text-[12px] text-foreground">{title}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{note}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{isOpen ? '–' : '+'}</span>
      </button>
      {isOpen && <div className="flex flex-col gap-2 border-t p-2">{children}</div>}
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="border-b bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
