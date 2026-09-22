'use client';

import type { ValidationConfig } from '@json-render/core';
import { type Components, useBoundProp, useFieldValidation } from '@json-render/react';
import { useMemo } from 'react';
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

  // `emit` is always supplied by the renderer and is a no-op when nothing is
  // bound, so a component never has to ask whether anyone is listening.
  Button: ({ props, emit }) => (
    <button
      type="button"
      onClick={() => emit('press')}
      className={[
        'w-fit rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
        props.variant === 'primary'
          ? 'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300'
          : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
      ].join(' ')}
    >
      {props.label}
    </button>
  ),

  Badge: ({ props }) => (
    <span
      className={[
        'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        props.tone === 'success'
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          : props.tone === 'warning'
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            : props.tone === 'danger'
              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
              : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
      ].join(' ')}
    >
      {props.label}
    </span>
  ),

  // The renderer resolved `{ $bindState: "/draft/note" }` to TWO things: the
  // value, already in props.value, and the write-back path, in bindings.value.
  TextField: ({ props, bindings }) => {
    const [value, setValue] = useBoundProp<string>(props.value ?? '', bindings?.value);

    // Validation is keyed by STATE PATH, not by element key. An unbound field
    // has no path, so it can never take part in a form-wide validate.
    const path = bindings?.value ?? '';

    // Memoised because the registering effect lists `config` in its
    // dependencies. The library de-duplicates by deep equality, so a fresh
    // object cannot loop — but it does re-run the effect on every keystroke.
    const config = useMemo<ValidationConfig | undefined>(
      () =>
        props.checks
          ? {
              checks: props.checks.map((c) => ({ type: c.type, message: c.message, args: c.args ?? undefined })),
              // Advisory only. Nothing in the library reads this to decide
              // when to run — the component below does, on blur.
              validateOn: 'blur',
            }
          : undefined,
      [props.checks],
    );

    const { errors, validate, touch } = useFieldValidation(path, config);

    return (
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {props.label}
        </span>
        <input
          value={value ?? ''}
          placeholder={props.placeholder ?? undefined}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            touch();
            validate();
          }}
          className={[
            'rounded-md border bg-white px-2 py-1 text-[13px] text-zinc-900 outline-none dark:bg-zinc-900 dark:text-zinc-100',
            errors.length > 0
              ? 'border-red-400 dark:border-red-800'
              : 'border-zinc-300 focus:border-zinc-500 dark:border-zinc-700',
          ].join(' ')}
        />
        {errors.length > 0 ? (
          <span className="text-[11px] text-red-600 dark:text-red-400">{errors[0]}</span>
        ) : null}
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
