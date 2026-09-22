'use client';

import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { CodeBlock } from './code-block';
import { cn } from '@/lib/utils';

/**
 * Playground chrome. Thin wrappers over shadcn primitives so the labs stay
 * short — not a second component library.
 *
 * House rules (.claude/skills/taxxa-design):
 *   hairlines not shadows · rounded-sm dense chrome / md cards+controls / lg panels
 *   mono for titles, data and micro-labels · hover is a tint shift
 *   one orange moment per region (Button variant="action")
 */

export function Panel({
  title,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('flex min-w-0 max-w-full flex-col overflow-hidden rounded-lg border bg-card', className)}>
      {(title || right) && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-muted px-3 py-1.5">
          <span className="truncate font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{title}</span>
          {right}
        </header>
      )}
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Dense mono chrome button. Never orange. */
export function ChromeButton({
  children,
  onClick,
  disabled,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
}) {
  return (
    <Button
      type="button"
      variant="toolbar"
      size="xs"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(active && 'bg-surface-hover text-foreground')}
    >
      {children}
    </Button>
  );
}

/** The one orange moment. At most one per region. */
export function ActionButton({
  children,
  onClick,
  disabled,
  size = 'chrome',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'chrome' | 'sm';
}) {
  return (
    <Button type="button" variant="action" size={size} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

export function CopyButton({ text, label = 'copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <ChromeButton
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          },
          () => {},
        );
      }}
    >
      {done ? 'copied' : label}
    </ChromeButton>
  );
}

export function Code({
  children,
  lang,
  title,
  maxHeight = 560,
}: {
  children: string;
  lang?: string;
  title?: string;
  maxHeight?: number | string;
}) {
  return (
    <Panel title={title ?? lang ?? 'code'} right={<CopyButton text={children} />} className="my-3">
      <CodeBlock code={children} lang={lang} maxHeight={maxHeight} />
    </Panel>
  );
}

/**
 * Terse fact list — the default way to state rules here. Beats paragraphs.
 *
 * Rows are OBJECTS, not [label, value] tuples, and that is deliberate: React's
 * dev-mode JSX validation walks arrays found in *any* prop, not just children.
 * A tuple containing an element therefore trips "Each child in a list should
 * have a unique key prop" on every page that uses one. Objects are not walked.
 */
export function Facts({ rows }: { rows: Array<{ k: React.ReactNode; v: React.ReactNode }> }) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border">
      <Table>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell className="w-[36%] whitespace-normal bg-muted align-top font-mono text-[12px] text-foreground">
                {r.k}
              </TableCell>
              <TableCell className="whitespace-normal align-top text-[14px] leading-relaxed text-muted-foreground">
                {r.v}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Things that bite. Red, in the functional-hue sense.
 *
 * Takes CHILDREN, not an `items` array — and that is load-bearing. React's
 * dev-mode validation walks arrays it finds in any prop, so `items={[<>a</>]}`
 * warns "Each child in a list should have a unique key prop" on every page.
 * Static JSX children are marked static and skipped, so this shape is silent.
 */
export function Gotchas({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border">
      <div className="border-b bg-muted px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
        gotchas
      </div>
      <ul className="divide-y">{children}</ul>
    </div>
  );
}

/** One row inside <Gotchas>. */
export function Gotcha({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 px-3 py-2">
      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-red-500" aria-hidden />
      <span className="prose-doc text-[14px] leading-relaxed">{children}</span>
    </li>
  );
}

/** One sentence that has to land. Carries the region's orange. */
export function Takeaway({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-md border border-l-2 border-l-orange-500 bg-surface px-3.5 py-2.5">
      <div className="prose-doc text-[14px]">{children}</div>
    </div>
  );
}

/** Collapsed by default — reference sits below the thing you do, never above. */
export function Reference({ title = 'Reference', children }: { title?: string; children: React.ReactNode }) {
  return (
    <Accordion type="single" collapsible className="my-3 overflow-hidden rounded-lg border bg-card">
      <AccordionItem value="ref" className="border-b-0">
        <AccordionTrigger className="bg-muted px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground hover:bg-surface-hover hover:no-underline">
          {title}
        </AccordionTrigger>
        <AccordionContent className="border-t px-3.5 py-3">
          <div className="prose-doc">{children}</div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; badge?: string | number }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'rounded-sm px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide transition-colors',
            active === t.id ? 'bg-surface-hover text-foreground' : 'text-muted-foreground hover:bg-surface',
          )}
        >
          {t.label}
          {t.badge !== undefined && t.badge !== 0 && (
            <span className="ml-1 rounded-sm bg-orange-500 px-1 text-[10px] text-white">{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Selectable chip row — presets, samples, scenarios. */
export function Chip({
  children,
  active,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-sm border px-2 py-0.5 font-mono text-[11.5px] transition-colors',
        active
          ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300'
          : danger
            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
            : 'bg-surface text-muted-foreground hover:bg-surface-hover',
      )}
    >
      {children}
    </button>
  );
}

export function Pill({ tone, children }: { tone: 'ok' | 'bad' | 'warn' | 'idle'; children: React.ReactNode }) {
  const map = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    bad: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    warn: 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300',
    idle: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide',
        map[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Monospace editor surface used by every lab. */
export function Editor({
  value,
  onChange,
  height,
  readOnly,
}: {
  value: string;
  onChange?: (v: string) => void;
  height: number | string;
  readOnly?: boolean;
}) {
  return (
    <Textarea
      spellCheck={false}
      readOnly={readOnly}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      style={{ height }}
      className="resize-none rounded-none border-0 bg-transparent p-3 font-mono text-[12.5px] leading-[1.55] text-foreground shadow-none focus-visible:ring-0"
    />
  );
}
