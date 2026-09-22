'use client';

import { type Components, useBoundProp } from '@json-render/react';
import { catalog } from './catalog';

/**
 * THE IMPLEMENTATIONS. Ordinary React, one function per catalog entry.
 *
 * `Components<typeof catalog>` is the enforcement: the map must have exactly
 * the catalog's component names, and each function's `props` is the output
 * type of that entry's Zod schema. Rename a catalog key and this file breaks.
 */
export const components: Components<typeof catalog> = {
  Page: ({ props, children }) => (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h1 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{props.title}</h1>
      {props.subtitle ? <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">{props.subtitle}</p> : null}
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  ),

  Stack: ({ props, children }) => (
    <div
      className={[
        'flex min-w-0',
        props.direction === 'row' ? 'flex-row items-center' : 'flex-col',
        props.gap === 'sm' ? 'gap-1.5' : props.gap === 'lg' ? 'gap-5' : 'gap-3',
      ].join(' ')}
    >
      {children}
    </div>
  ),

  Heading: ({ props }) => {
    const Tag = (['h2', 'h3', 'h4'] as const)[Number(props.level) - 1] ?? 'h3';
    return (
      <Tag
        className={[
          'font-semibold tracking-tight text-zinc-900 dark:text-zinc-100',
          props.level === '1' ? 'text-[16px]' : props.level === '2' ? 'text-[14px]' : 'text-[13px]',
        ].join(' ')}
      >
        {props.text}
      </Tag>
    );
  },

  Text: ({ props }) => (
    <p
      className={[
        'text-[13px] leading-relaxed',
        props.tone === 'muted'
          ? 'text-zinc-500 dark:text-zinc-400'
          : props.tone === 'danger'
            ? 'text-red-600 dark:text-red-400'
            : 'text-zinc-800 dark:text-zinc-200',
      ].join(' ')}
    >
      {props.value ?? ''}
    </p>
  ),

  // The renderer resolved `{ $bindState: "/draft/note" }` to TWO things: the
  // value, already in props.value, and the write-back path, in bindings.value.
  TextField: ({ props, bindings }) => {
    const [value, setValue] = useBoundProp<string>(props.value ?? '', bindings?.value);
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {props.label}
        </span>
        <input
          value={value ?? ''}
          placeholder={props.placeholder ?? undefined}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[13px] text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>
    );
  },

  Toggle: ({ props, bindings }) => {
    const [checked, setChecked] = useBoundProp<boolean>(props.checked ?? false, bindings?.checked);
    return (
      <label className="flex w-fit items-center gap-2 text-[13px] text-zinc-800 dark:text-zinc-200">
        <input
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(e) => setChecked(e.target.checked)}
          className="size-3.5 accent-zinc-900 dark:accent-zinc-100"
        />
        {props.label}
      </label>
    );
  },
};
