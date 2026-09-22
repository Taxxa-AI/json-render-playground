import Link from 'next/link';
import { Code, Facts } from '@/components/playground/ui';
import { formatMinutes, minutesFor, TRACKS } from '@/lib/path';
import { GROUPS, PAGES, STEPS } from '@/lib/steps';

export const dynamic = 'force-dynamic';

export default function Home() {
  const hasKey = Boolean(process.env.AI_GATEWAY_API_KEY);
  const keySteps = STEPS.filter((s) => s.needsKey);
  const offlineSteps = STEPS.filter((s) => !s.needsKey);
  const totalMinutes = minutesFor(STEPS.map((s) => s.slug));

  return (
    <div className="mx-auto w-full max-w-[1760px] px-4 py-10 sm:px-5 lg:px-10 lg:py-12">
      <h1 className="font-display text-[40px] leading-[1.1] tracking-tight text-foreground">json-render, hands on</h1>
      <div className="mt-3 max-w-3xl space-y-2 text-base leading-relaxed text-muted-foreground">
        <p>
          json-render renders a JSON <em>spec</em> — a flat map of keyed elements — as React. Your{' '}
          <strong className="font-medium text-foreground">catalog</strong> declares which components may exist and what
          props they take; your <strong className="font-medium text-foreground">registry</strong> says what each one
          renders as. The spec itself is written by a model, by your own code, or by you.
        </p>
        <p>
          {STEPS.length} labs, about {formatMinutes(totalMinutes)} end to end. You edit specs, break them, and watch what
          happens.{' '}
          <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs text-foreground">@json-render/react</code>{' '}
          v0.20, React 19, AI SDK v7.
        </p>
      </div>

      {/* ---- Start here ---- */}
      <section className="mt-8">
        <h2 className="font-mono text-[12px] uppercase tracking-wide text-muted-foreground">Start here</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
          Pick the goal that matches your job. Each track is an ordered subset of the labs below, with a checkpoint
          quiz per group.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {TRACKS.map((t) => (
            <Link
              key={t.id}
              href={`/path?track=${t.id}`}
              className="flex flex-col rounded-lg border bg-card p-3.5 no-underline transition-colors hover:bg-surface"
            >
              <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                track {t.id}
              </span>
              <span className="mt-1 font-mono text-[15px] text-foreground">{t.title}</span>
              <span className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{t.who}</span>
              <span className="mt-3 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                {t.slugs.length} labs · {formatMinutes(minutesFor(t.slugs))} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Setup ---- */}
      <section className="mt-9">
        <h2 className="font-mono text-[12px] uppercase tracking-wide text-muted-foreground">Setup</h2>
        <Code lang="bash" title="two commands">{`bun install
bun dev          # http://localhost:3000`}</Code>
        <div className="flex items-start gap-2.5 rounded-md border border-l-2 border-l-orange-500 bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-muted-foreground">
          <span
            className={`mt-1 size-1.5 shrink-0 rounded-full ${hasKey ? 'bg-emerald-500' : 'bg-yellow-500'}`}
            aria-hidden
          />
          <span>
            {hasKey ? (
              <>
                <strong className="font-medium text-foreground">Gateway key detected.</strong> All {STEPS.length} labs
                are live, including the {keySteps.length} that generate UI for real.
              </>
            ) : (
              <>
                <strong className="font-medium text-foreground">
                  Labs {ranges(offlineSteps.map((s) => s.n))} need nothing else.
                </strong>{' '}
                The {keySteps.length} live-generation labs ({ranges(keySteps.map((s) => s.n))}) need a key: copy{' '}
                <code>.env.example</code> to <code>.env</code> and add an <code>AI_GATEWAY_API_KEY</code> from the
                Vercel dashboard.
              </>
            )}
          </span>
        </div>
      </section>

      {/* ---- The whole library ---- */}
      <section className="mt-10">
        <h2 className="font-mono text-[12px] uppercase tracking-wide text-muted-foreground">
          The whole library, in four steps
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
          There is no fifth concept. Everything else in this playground is detail on one of these four.
        </p>

        <Code lang="typescript" title="1 · catalog — what may exist">{`import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

export const catalog = defineCatalog(schema, {
  components: {
    Card:   { description: 'A bordered surface.', props: z.object({ title: z.string() }), slots: ['default'] },
    Metric: { description: 'A big number with a caption.',
              props: z.object({ label: z.string(), value: z.string() }), slots: [] },
  },
  actions: { submit: { description: 'Submit the form.', params: z.object({}) } },
});

catalog.prompt();   // ...and this same file IS the AI system prompt`}</Code>

        <Code lang="tsx" title="2 · registry — what it renders as">{`import { defineRegistry } from '@json-render/react';

export const { registry } = defineRegistry(catalog, {
  components: {
    Card:   ({ props, children }) => <div className="card"><h3>{props.title}</h3>{children}</div>,
    Metric: ({ props }) => <div><span>{props.label}</span><b>{props.value}</b></div>,
  },
  actions: { submit: async () => save() },   // async is required
});`}</Code>

        <Code lang="json" title="3 · spec — a FLAT map, children are keys">{`{
  "root": "card",
  "elements": {
    "card": { "type": "Card", "props": { "title": "Q3" }, "children": ["m1"] },
    "m1":   { "type": "Metric",
              "props": { "label": "Revenue", "value": { "$state": "/revenue" } },
              "children": [] }
  }
}`}</Code>

        <Code lang="tsx" title="4 · render">{`<JSONUIProvider registry={registry} store={createStateStore({ revenue: '€48,200' })}>
  <Renderer spec={spec} registry={registry} fallback={Unknown} />
</JSONUIProvider>`}</Code>
      </section>

      {/* ---- Read this first ---- */}
      <section className="mt-10">
        <h2 className="font-mono text-[12px] uppercase tracking-wide text-muted-foreground">Four facts that save a day</h2>
        <Facts
          rows={[
          { k: 'children are keys', v: 'Not nested objects. The tree is assembled by pointer-chasing from root — which is what makes streaming a one-line patch per element.' },
          { k: 'spec.state is ignored', v: <>
                <code key="a">&lt;Renderer&gt;</code> never reads it, despite the AI prompt telling the model to fill
                it. You seed the store yourself, or a generated UI renders blank.
              </>, },
          { k: 'props arrive resolved', v: <>
                Every <code key="b">$state</code> / <code key="c">$cond</code> / <code key="d">$template</code> is
                evaluated before your component runs. Your components are ordinary React.
              </> },
          { k: 'failures are silent', v: 'A missing path and an unknown function resolve to undefined. A malformed condition is worse than useless: depending on the shape it degrades to a plain truthiness check, or stays visible forever. Wrong UI, no error. Budget for this.' },
        ]}
        />
      </section>

      {/* ---- Non-lab pages ---- */}
      <section className="mt-10">
        <h2 className="font-mono text-[12px] uppercase tracking-wide text-muted-foreground">Besides the labs</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="flex flex-col rounded-md border bg-surface px-3 py-2 no-underline transition-colors hover:bg-surface-hover"
            >
              <span className="font-mono text-[13.5px] text-foreground">{p.title}</span>
              <span className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{p.blurb}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Steps ---- */}
      <section className="mt-10">
        <h2 className="font-mono text-[12px] uppercase tracking-wide text-muted-foreground">
          Labs · {STEPS.length} in {GROUPS.length} groups
        </h2>
        <div className="mt-3 flex flex-col gap-6">
          {GROUPS.map((g) => (
            <div key={g}>
              <div className="mb-1.5 text-[12px] font-medium text-foreground">{g}</div>
              <div className="overflow-hidden rounded-lg border">
                {STEPS.filter((s) => s.group === g).map((s, i) => (
                  <Link
                    key={s.slug}
                    href={`/steps/${s.slug}`}
                    className={`flex items-baseline gap-3 bg-surface px-3 py-2 transition-colors hover:bg-surface-hover ${
                      i > 0 ? 'border-t' : ''
                    }`}
                  >
                    <span className="w-5 shrink-0 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                      {String(s.n).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[14px] text-foreground sm:w-[34%] sm:flex-none sm:shrink-0">
                      {s.title}
                    </span>
                    <span className="hidden min-w-0 flex-1 text-[13.5px] leading-snug text-muted-foreground sm:block">
                      {s.does}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {s.minutes}m
                    </span>
                    {s.needsKey && !hasKey && (
                      <span
                        title="Needs AI_GATEWAY_API_KEY"
                        className="shrink-0 rounded-sm border border-yellow-200 bg-yellow-50 px-1 py-px font-mono text-[10px] uppercase text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300"
                      >
                        key
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** [1,2,3,7,8] → "1–3 and 7–8". Keeps the setup copy honest when steps move. */
function ranges(nums: number[]): string {
  const sorted = [...nums].sort((a, b) => a - b);
  const out: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (const n of sorted.slice(1)) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    out.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = n;
    prev = n;
  }
  if (sorted.length > 0) out.push(start === prev ? `${start}` : `${start}–${prev}`);
  if (out.length === 0) return '';
  if (out.length === 1) return out[0];
  return `${out.slice(0, -1).join(', ')} and ${out[out.length - 1]}`;
}
