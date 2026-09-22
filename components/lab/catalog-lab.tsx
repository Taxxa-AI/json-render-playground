'use client';

import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { useEffect, useMemo, useState } from 'react';
import { demoCatalog, demoComponents, demoActions } from '@/lib/demo/catalog';
import { Chip, CopyButton, Panel, Pill } from '../playground/ui';
import type { ChecklistItem } from './checklist';

/**
 * Build a catalog at runtime from whatever the learner selects, then call
 * `.prompt()` on it. This is the fastest way to internalise that the catalog
 * IS the prompt — toggle a component off and watch it vanish from the text the
 * model receives, along with its tokens.
 */

const ALL = Object.keys(demoComponents) as Array<keyof typeof demoComponents>;

export function useCatalogLab() {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(ALL));
  const [withActions, setWithActions] = useState(true);
  const [rulesText, setRulesText] = useState(
    'Never invent monetary figures; use only values present in the provided state.\nEvery spec must have exactly one Screen as its root.',
  );
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string>('Metric');
  const [view, setView] = useState<'components' | 'full'>('components');
  /** "Put it back" only means something once you have cut it down. */
  const [wentSmall, setWentSmall] = useState(false);

  useEffect(() => {
    if (enabled.size <= 4) setWentSmall(true);
  }, [enabled.size]);

  const prompt = useMemo(() => {
    const components: Record<string, unknown> = {};
    for (const name of ALL) {
      if (!enabled.has(name)) continue;
      const base = demoComponents[name];
      components[name] = overrides[name] ? { ...base, description: overrides[name] } : base;
    }
    try {
      const cat = defineCatalog(schema, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        components: components as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actions: (withActions ? demoActions : {}) as any,
      });
      return cat.prompt({
        customRules: rulesText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      });
    } catch (e) {
      return `// catalog build failed: ${(e as Error).message}`;
    }
  }, [enabled, withActions, rulesText, overrides]);

  // The per-component cost: rebuild with one fewer and diff the length.
  const baseline = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cat = defineCatalog(schema, { components: {} as any, actions: {} as any });
      return cat.prompt().length;
    } catch {
      return 0;
    }
  }, []);

  const componentSection = useMemo(() => {
    // The phrase "AVAILABLE COMPONENTS list below" appears earlier in the
    // fixed preamble, so a plain indexOf lands mid-sentence. Match the real
    // section header: start of a line, followed by " (" or ":".
    const header = /^AVAILABLE COMPONENTS[ (:]/m.exec(prompt);
    if (!header) return prompt;
    const end = prompt.indexOf('EVENTS (the `on` field)', header.index);
    return prompt.slice(header.index, end === -1 ? undefined : end).trim();
  }, [prompt]);

  const tokens = Math.round(prompt.length / 4);
  const scaffold = Math.round(baseline / 4);
  const yours = Math.max(0, tokens - scaffold);

  const items: ChecklistItem[] = [
    {
      label: (
        <>
          Get oriented: hit <strong>min</strong> to drop to two components. The prompt is rebuilt on the spot —
          this text is the literal return value of <code>catalog.prompt()</code>, not a mock-up.
        </>
      ),
      done: enabled.size <= 4,
      hint: 'Rule: a catalog is a plain object. Nothing says you must send all of it — for a large design system, build a narrower catalog per request.',
      steps: [
        <>
          Look at the big panel on the right: that is the text <code>catalog.prompt()</code> returns, rebuilt
          on every change you make on the left.
        </>,
        <>
          Read the four numbers above it — <strong>≈ total tokens</strong>,{' '}
          <strong>fixed scaffolding</strong>, <strong>your catalog</strong>, <strong>components on</strong>.
        </>,
        <>
          Press <strong>min</strong>, at the top right of the <strong>components</strong> panel.
        </>,
        <>
          The list keeps only <code>Screen</code> and <code>Text</code>; the other eleven names go grey and
          struck through, and vanish from the panel on the right.
        </>,
        <>
          Read the numbers again: <strong>components on</strong> is <code>2/13</code> and{' '}
          <strong>your catalog</strong> has collapsed — while <strong>fixed scaffolding</strong> has not moved
          at all.
        </>,
      ],
      apply: { label: 'press min for me', run: () => setEnabled(new Set(['Screen', 'Text'])) },
    },
    {
      label: (
        <>
          Put it back and read the two numbers. Most of what you pay for is <strong>fixed scaffolding</strong>{' '}
          from the React schema&rsquo;s prompt template, and no catalog edit can shrink it.
        </>
      ),
      done: wentSmall && enabled.size >= 12 && yours > 0,
      hint: `Right now: ${scaffold.toLocaleString()} scaffolding vs ${yours.toLocaleString()} yours. This prefix is prepended to every request — cache it.`,
      steps: [
        <>
          Press <strong>all</strong>, beside <strong>min</strong> at the top right of the{' '}
          <strong>components</strong> panel.
        </>,
        <>
          Compare <strong>fixed scaffolding</strong> with <strong>your catalog</strong>: the template costs
          more than all thirteen components.
        </>,
        <>
          Click <strong>full prompt</strong> at the top of the right-hand panel and scroll through it.
        </>,
        <>
          Everything outside the two <strong>AVAILABLE …</strong> sections — the JSONL rules, the repeat and
          visibility syntax, the numbered rules — is that scaffolding, on every single request.
        </>,
      ],
      apply: { label: 'put it back', run: () => setEnabled(new Set(ALL)) },
    },
    {
      label: (
        <>
          Rewrite a <code>description</code> to something useless like &ldquo;a thing&rdquo; and re-read your
          section. That string is the whole reason a model picks one component over another.
        </>
      ),
      done: Object.keys(overrides).length > 0,
      hint: 'Rule: the model never sees your React. Descriptions are documentation for a reader who cannot read the source, and changing one changes behaviour globally and silently.',
      steps: [
        <>
          In the <strong>components</strong> panel, click the word <strong>Metric</strong> itself — not its
          checkbox.
        </>,
        <>
          The <strong>description · Metric</strong> box below fills with the catalog&rsquo;s own sentence.
        </>,
        <>
          Select all of it and type <code>a thing</code>.
        </>,
        <>
          An orange <strong>edited</strong> marker appears beside <code>Metric</code> in the list.
        </>,
        <>
          Find <code>Metric</code> in the right-hand panel: <code>a thing</code> is now the entire case for
          using it.
        </>,
      ],
      apply: {
        label: 'wreck the Metric description',
        run: () => {
          setEditing('Metric');
          setOverrides({ ...overrides, Metric: 'a thing' });
        },
      },
    },
    {
      label: (
        <>
          Add a domain rule to <code>customRules</code> and find it in the <em>full prompt</em>. This is where
          you cancel the stock instruction to invent realistic sample data.
        </>
      ),
      done: rulesText.split('\n').filter((l) => l.trim()).length >= 3,
      hint: 'Rule: customRules are appended after the built-in defaultRules, so they can contradict them. "Never invent monetary figures" belongs here whenever the data is yours.',
      steps: [
        <>
          Click into the <strong>customRules (one per line)</strong> box, at the bottom left.
        </>,
        <>
          Add a third line: <code>Use only invoice numbers present in state; never invent one.</code>
        </>,
        <>
          Click <strong>full prompt</strong> at the top of the right-hand panel.
        </>,
        <>
          Scroll to the numbered rules at the end and find your sentence among them — appended after the
          built-in ones, which is why it can contradict them.
        </>,
      ],
      apply: {
        label: 'add a rule',
        run: () => {
          setRulesText(`${rulesText.replace(/\s+$/, '')}\nUse only invoice numbers present in state; never invent one.`);
          setView('full');
        },
      },
    },
    {
      label: (
        <>
          Switch the actions off. <strong>AVAILABLE ACTIONS</strong> shrinks but does not empty — the four
          built-ins are injected by the schema, not by your catalog.
        </>
      ),
      done: !withActions,
      hint: 'Rule: setState, pushState, removeState and validateForm are always available at runtime and always in the prompt.',
      steps: [
        <>
          Click <strong>your section</strong> at the top of the right-hand panel and scroll to{' '}
          <strong>AVAILABLE ACTIONS</strong>. Seven are listed.
        </>,
        <>
          Untick <strong>include 3 custom actions</strong> at the bottom of the <strong>components</strong>{' '}
          panel.
        </>,
        <>
          Read <strong>AVAILABLE ACTIONS</strong> again: <code>submit</code>, <code>notify</code> and{' '}
          <code>reset</code> are gone.
        </>,
        <>
          Four remain, each tagged <code>[built-in]</code>: <code>setState</code>, <code>pushState</code>,{' '}
          <code>removeState</code>, <code>validateForm</code>. You cannot remove those from the prompt.
        </>,
      ],
      apply: { label: 'switch them off', run: () => setWithActions(false) },
    },
  ];

  const body = (
    <div className="flex flex-col gap-3">

      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="≈ total tokens" value={tokens.toLocaleString()} tone="fg" />
        <Stat label="fixed scaffolding" value={scaffold.toLocaleString()} tone="muted" />
        <Stat label="your catalog" value={yours.toLocaleString()} tone="accent" />
        <Stat label="components on" value={`${enabled.size}/${ALL.length}`} tone="muted" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-3">
          <Panel
            title="components"
            right={
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEnabled(new Set(ALL))}
                  className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                >
                  all
                </button>
                <button
                  type="button"
                  onClick={() => setEnabled(new Set(['Screen', 'Text']))}
                  className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                >
                  min
                </button>
              </div>
            }
          >
            <div className="max-h-[280px] overflow-auto p-1.5">
              {ALL.map((name) => {
                const on = enabled.has(name);
                return (
                  <div key={name} className="flex items-center gap-2 rounded px-1.5 py-[3px] hover:bg-muted">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[var(--primary)]"
                      checked={on}
                      onChange={(e) => {
                        const next = new Set(enabled);
                        if (e.target.checked) next.add(name);
                        else next.delete(name);
                        setEnabled(next);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setEditing(name)}
                      className={`flex-1 truncate text-left font-mono text-[12.5px] transition ${
                        editing === name ? 'text-orange-600 dark:text-orange-400' : on ? 'text-foreground' : 'text-muted-foreground line-through'
                      }`}
                    >
                      {name}
                    </button>
                    {overrides[name] && <span className="font-mono text-[10px] text-yellow-600 dark:text-yellow-400">edited</span>}
                  </div>
                );
              })}
            </div>
            <div className="border-t px-3 py-1.5">
              <label className="flex cursor-pointer items-center gap-2 font-mono text-[12px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-3.5 accent-[var(--primary)]"
                  checked={withActions}
                  onChange={(e) => setWithActions(e.target.checked)}
                />
                include 3 custom actions
              </label>
            </div>
          </Panel>

          <Panel title={`description · ${editing}`}>
            <textarea
              spellCheck={false}
              value={overrides[editing] ?? demoComponents[editing as keyof typeof demoComponents]?.description ?? ''}
              onChange={(e) => setOverrides({ ...overrides, [editing]: e.target.value })}
              className="h-[90px] w-full resize-none bg-transparent p-2.5 text-[13px] leading-relaxed text-foreground outline-none"
            />
            <div className="border-t px-2.5 py-1 text-[11.5px] text-muted-foreground">
              This exact string is the only documentation the model gets about {editing}.
            </div>
          </Panel>

          <Panel title="customRules (one per line)">
            <textarea
              spellCheck={false}
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              className="h-[80px] w-full resize-none bg-transparent p-2.5 font-mono text-[12px] leading-relaxed text-foreground outline-none"
            />
          </Panel>
        </div>

        <Panel
          title={
            <div className="flex items-center gap-0.5">
              {(['components', 'full'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-sm px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                    view === v ? 'bg-surface-hover text-foreground' : 'text-muted-foreground hover:bg-surface'
                  }`}
                >
                  {v === 'components' ? 'your section' : 'full prompt'}
                </button>
              ))}
            </div>
          }
          right={<CopyButton text={prompt} />}
        >
          {/* Say plainly where this text comes from. It is the single most
              important fact on the page and it is easy to mistake for a mockup. */}
          <div className="border-b bg-muted px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">This is not a mock-up.</span> It is the literal return
            value of{' '}
            <code className="rounded-sm border bg-card px-1 py-px font-mono text-[11.5px] text-foreground">
              catalog.prompt()
            </code>{' '}
            from <code className="font-mono text-[11.5px]">@json-render/core</code>, called on a catalog rebuilt
            from your selection on the left, on every keystroke.
            {view === 'components' ? (
              <>
                {' '}
                You are looking at the <strong className="font-medium text-foreground">AVAILABLE COMPONENTS</strong>{' '}
                and <strong className="font-medium text-foreground">AVAILABLE ACTIONS</strong> sections — the only
                part your catalog contributes. Switch to <em>full prompt</em> for the rest.
              </>
            ) : (
              <>
                {' '}
                Everything outside the two <strong className="font-medium text-foreground">AVAILABLE …</strong>{' '}
                sections is <strong className="font-medium text-foreground">fixed scaffolding</strong> from the
                React schema&rsquo;s prompt template — the JSONL rules, the repeat and visibility syntax, the
                nineteen numbered rules. You pay for it whether or not you use those features, and you cannot
                shrink it by editing your catalog.
              </>
            )}
          </div>
          <pre className="min-w-0 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[12px] leading-[1.6] text-muted-foreground" style={{ height: 610 }}>
            <code>{view === 'components' ? componentSection : prompt}</code>
          </pre>
        </Panel>
      </div>

      <div className="rounded-lg border bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Try this:</strong> hit <span className="font-mono text-[12px]">min</span> to drop
        to two components and watch the token count collapse — the remainder is fixed scaffolding you pay for no
        matter what. Then rewrite <span className="font-mono text-[12px]">Metric</span>&rsquo;s description to
        something useless like &ldquo;a thing&rdquo; and read your section again. That string is the whole reason a
        model reaches for one component over another.
      </div>
    </div>
  );

  return { items, body };
}

/** The view on its own, for anywhere that does not stage it. */
export function CatalogLab() {
  return useCatalogLab().body;
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'fg' | 'muted' | 'accent' }) {
  const cls = tone === 'accent' ? 'text-orange-600 dark:text-orange-400' : tone === 'muted' ? 'text-muted-foreground' : 'text-foreground';
  return (
    <div className="rounded-lg border bg-surface px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-lg tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

/**
 * The OTHER artefact a catalog hands a model: `catalog.jsonSchema()`.
 *
 * Kept apart from the prompt above on purpose. The prompt is prose the model
 * may ignore; a structured-output schema is a contract the provider ENFORCES,
 * so the interesting question is what it can say — and `elements` is a record,
 * a map with keys the catalog cannot know. Strict JSON Schema has no way to
 * write "any key, this shape", so the half of the spec that matters comes back
 * as an empty object. Hence JSONL, described by the prompt, rather than one
 * structured JSON response.
 */

/** Where the component-name enum lives when the schema is able to carry one. */
const TYPE_PATH = ['properties', 'elements', 'additionalProperties', 'properties', 'type'];

/** Ways into the returned schema, phrased the way a spec author would ask. */
const PROBES: Array<{ id: string; label: string; path: string[] }> = [
  { id: 'root', label: 'root', path: ['properties', 'root'] },
  { id: 'elements', label: 'elements', path: ['properties', 'elements'] },
  { id: 'element', label: 'one element', path: ['properties', 'elements', 'additionalProperties'] },
  { id: 'element.type', label: 'element.type', path: TYPE_PATH },
  {
    id: 'element.props',
    label: 'element.props',
    path: ['properties', 'elements', 'additionalProperties', 'properties', 'props'],
  },
];

/**
 * Walk a path into the schema. `additionalProperties: false` is precisely how
 * strict mode SAYS "nothing lives here", so a non-object answer counts as a
 * missing one — that boolean is the gap the second task is about.
 */
function at(schema: unknown, path: string[]): Record<string, unknown> | null {
  let node: unknown = schema;
  for (const key of path) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) return null;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === 'object' && node !== null && !Array.isArray(node) ? (node as Record<string, unknown>) : null;
}

export function useJsonSchemaLab() {
  const [strict, setStrict] = useState(false);
  const [probe, setProbe] = useState('elements');
  /** Probes read WITHOUT strict — the same click under strict is a different observation. */
  const [looseSeen, setLooseSeen] = useState<Set<string>>(new Set());
  /** "It is gone" only counts once you have gone looking for it under strict. */
  const [sawGap, setSawGap] = useState(false);

  const schema = useMemo(() => demoCatalog.jsonSchema({ strict }) as Record<string, unknown>, [strict]);
  const promptChars = useMemo(() => demoCatalog.prompt().length, []);

  const selected = PROBES.find((p) => p.id === probe) ?? PROBES[0];
  const subtree = useMemo(() => at(schema, selected.path), [schema, selected]);

  useEffect(() => {
    if (!strict) setLooseSeen((prev) => (prev.has(probe) ? prev : new Set(prev).add(probe)));
  }, [strict, probe]);

  useEffect(() => {
    if (strict && subtree === null) setSawGap(true);
  }, [strict, subtree]);

  const chars = JSON.stringify(schema).length;
  const names = at(schema, TYPE_PATH)?.enum;
  const namedComponents = Array.isArray(names) ? names.length : 0;

  const items: ChecklistItem[] = [
    {
      label: (
        <>
          Find out what this schema actually pins down: click <strong>one element</strong>, then{' '}
          <strong>element.props</strong>. Your component names are in there as an <code>enum</code>; the props
          behind them are an open object.
        </>
      ),
      done: looseSeen.has('element') && looseSeen.has('element.props'),
      hint: 'Rule: catalog.jsonSchema() describes the SPEC format, not your components. Prop shapes reach the model through catalog.prompt() and reach you through TypeScript — the same blind spot catalog.validate has.',
      steps: [
        <>
          Read the right-hand panel: this is the object <code>catalog.jsonSchema()</code> returns for this
          catalog — what you would hand a provider as a structured-output schema.
        </>,
        <>
          Click <strong>one element</strong> on the <strong>ask the schema about</strong> row.
        </>,
        <>
          Read the left panel: an element is <code>type</code>, <code>props</code>, <code>children</code>,{' '}
          <code>slots</code>, <code>visible</code> and <code>repeat</code> — the spec format itself.
        </>,
        <>
          Click <strong>element.type</strong>: all thirteen component names, as an <code>enum</code>. That much a
          provider would enforce for you.
        </>,
        <>
          Click <strong>element.props</strong>: <code>{'{ "type": "object", "additionalProperties": {} }'}</code>.
          Every prop of every component, unconstrained.
        </>,
      ],
      apply: {
        label: 'probe both for me',
        run: () => {
          setStrict(false);
          setProbe('element.props');
          setLooseSeen((prev) => new Set(prev).add('element').add('element.type').add('element.props'));
        },
      },
    },
    {
      label: (
        <>
          Now tick <strong>strict: true</strong> — the mode a structured-output API requires — and go looking for
          the element again. It is gone: <code>elements</code> is a record, and strict JSON Schema cannot describe
          dynamic keys.
        </>
      ),
      done: sawGap,
      hint: 'Rule: strict mode means additionalProperties: false on every object, so a dynamic-key map has nowhere to go and is emitted as { type: "object", properties: {}, additionalProperties: false }. The structure survives only in catalog.prompt() — which is why json-render streams JSONL patches instead of asking for one structured JSON object.',
      steps: [
        <>
          Tick <strong>strict: true</strong>, at the end of the <strong>ask the schema about</strong> row.
        </>,
        <>
          Watch <strong>≈ schema chars</strong> collapse and <strong>component names in it</strong> drop to{' '}
          <code>0/13</code>. The whole right-hand panel is now a dozen lines.
        </>,
        <>
          Click <strong>one element</strong> again. The left panel says <strong>not in this schema</strong>:{' '}
          <code>elements</code> resolved to <code>{'{ properties: {}, additionalProperties: false }'}</code> and
          the walk stopped there.
        </>,
        <>
          Compare the two numbers at the top: the schema is a few hundred characters, the prompt is tens of
          thousands. Everything the model needs to know about an element is in the one the provider does not
          enforce.
        </>,
      ],
      apply: {
        label: 'tick strict for me',
        run: () => {
          setStrict(true);
          setProbe('element');
        },
      },
    },
  ];

  const body = (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="≈ schema chars" value={chars.toLocaleString()} tone="fg" />
        <Stat label="≈ prompt chars" value={promptChars.toLocaleString()} tone="muted" />
        <Stat label="component names in it" value={`${namedComponents}/${ALL.length}`} tone="accent" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card px-3 py-2">
        <span className="mr-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          ask the schema about
        </span>
        {PROBES.map((p) => (
          <Chip key={p.id} active={p.id === probe} onClick={() => setProbe(p.id)}>
            {p.label}
          </Chip>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 font-mono text-[12px] text-muted-foreground">
          <input
            type="checkbox"
            className="size-3.5 accent-[var(--primary)]"
            checked={strict}
            onChange={(e) => setStrict(e.target.checked)}
          />
          strict: true
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel
          title={`at ${selected.label}`}
          className="h-80"
          bodyClassName="min-h-0 overflow-hidden"
          right={subtree ? <Pill tone="ok">in the schema</Pill> : <Pill tone="bad">not in this schema</Pill>}
        >
          <div className="h-full overflow-auto p-3 font-mono text-[12px] leading-relaxed">
            {subtree ? (
              <pre className="whitespace-pre-wrap break-words text-muted-foreground">
                <code>{JSON.stringify(subtree, null, 2)}</code>
              </pre>
            ) : (
              <p className="font-sans text-[13px] leading-relaxed text-red-600 dark:text-red-400">
                <strong>Nothing to show.</strong> The path <code>{selected.path.join('.')}</code> does not exist in
                this schema. Under <code>strict: true</code> the <code>elements</code> record is emitted as{' '}
                <code>{'{ type: "object", properties: {}, additionalProperties: false }'}</code>, so the walk stops
                at <code>elements</code> and everything below it — your component names included — is simply not
                described.
              </p>
            )}
          </div>
        </Panel>

        <Panel
          title={`catalog.jsonSchema(${strict ? '{ strict: true }' : ''})`}
          className="h-80"
          bodyClassName="min-h-0 overflow-hidden"
          right={<CopyButton text={JSON.stringify(schema, null, 2)} />}
        >
          <pre className="h-full overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[12px] leading-[1.6] text-muted-foreground">
            <code>{JSON.stringify(schema, null, 2)}</code>
          </pre>
        </Panel>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          why json-render streams JSONL instead of asking for this
        </div>
        <div className="prose-doc px-3.5 py-2.5 text-[14px]">
          <ul>
            <li>
              <code>strict: true</code> is what OpenAI, Gemini and Anthropic structured output need:{' '}
              <code>additionalProperties: false</code> on every object, every property listed in{' '}
              <code>required</code>, optionals expressed as nullable types.
            </li>
            <li>
              A spec&rsquo;s <code>elements</code> is a <strong>record</strong> — keys the model invents. That is
              the one thing those three rules forbid, so it is emitted empty. This is documented, not a bug.
            </li>
            <li>
              So the enforced schema guarantees you an object with <code>root</code> and <code>elements</code> and
              tells the model nothing whatsoever about what an element looks like.
            </li>
          </ul>
          <p>
            The structure lives in <code>catalog.prompt()</code> instead, and json-render asks for it one JSONL
            patch at a time — which also means a spec starts rendering before the model has finished writing it.
            Reach for <code>jsonSchema()</code> when a provider demands a schema; do not expect it to replace the
            prompt.
          </p>
        </div>
      </div>
    </div>
  );

  return { items, body };
}
