'use client';

import { useBoundProp } from '@json-render/react';
import type { Components } from '@json-render/react';
import type { demoCatalog } from './catalog';

/**
 * A SECOND implementation of the exact same catalog.
 *
 * This is the whole point of a registry. `demoComponents` in catalog.ts is a
 * contract: it says a `Metric` node in the JSON tree has
 * `{ label, value, delta, tone }`. It says nothing about what a Metric looks
 * like — that is the registry's job, and every renderer answers it differently.
 *
 * lib/demo/components.tsx answers it with shadcn. This file answers it as a
 * bare wireframe. Same catalog, same spec, same props; different output. Swap
 * the registry and the UI changes without the spec moving a character. That is
 * also, exactly, how @json-render/react-pdf renders the same spec to a PDF.
 */
export const altComponentImpls: Components<typeof demoCatalog> = {
  Screen: ({ props, children }) => (
    <div className="space-y-2 border-2 border-dashed border-current/30 p-2">
      <div className="font-mono text-[11px] uppercase tracking-widest opacity-60">screen</div>
      {props.title && <div className="font-bold uppercase">{props.title}</div>}
      {children}
    </div>
  ),

  Stack: ({ props, children }) => (
    <div className={props.direction === 'row' ? 'flex flex-row gap-2' : 'flex flex-col gap-2'}>{children}</div>
  ),

  Card: ({ props, children, slots }) => (
    <div className="border-2 border-current/40">
      <div className="border-b-2 border-current/40 px-2 py-1 font-mono text-[11px] uppercase">
        {props.title ?? 'card'}
      </div>
      <div className="space-y-2 p-2">{children}</div>
      {slots?.footer && <div className="border-t-2 border-current/40 p-2">{slots.footer}</div>}
    </div>
  ),

  Heading: ({ props }) => <div className="font-bold uppercase underline">{props.text}</div>,

  Text: ({ props }) => <p className="font-mono text-[12px]">{props.value}</p>,

  Badge: ({ props }) => <span className="border border-current px-1 font-mono text-[11px]">[{props.label}]</span>,

  // Same four props as the shadcn Metric. Completely different presentation.
  Metric: ({ props }) => (
    <div className="border border-current px-2 py-1 font-mono text-[12px]">
      {props.label}: <b>{props.value}</b>
      {props.delta ? ` (${props.delta})` : ''}
    </div>
  ),

  Alert: ({ props }) => (
    <div className="border-l-4 border-current px-2 py-1 font-mono text-[12px]">
      ! {props.title}
      {props.message ? ` — ${props.message}` : ''}
    </div>
  ),

  Button: ({ props, emit }) => (
    <button type="button" onClick={() => emit('press')} className="border-2 border-current px-2 py-0.5 font-mono text-[12px]">
      [ {props.label} ]
    </button>
  ),

  TextInput: ({ props, bindings }) => {
    const [value, setValue] = useBoundProp<string>(props.value as string, bindings?.value);
    return (
      <label className="block font-mono text-[12px]">
        {props.label}:{' '}
        <input
          className="border-b border-current bg-transparent outline-none"
          value={value ?? ''}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
    );
  },

  Checkbox: ({ props, bindings }) => {
    const [checked, setChecked] = useBoundProp<boolean>(props.checked as boolean, bindings?.checked);
    return (
      <button
        type="button"
        onClick={() => setChecked(!checked)}
        className="block font-mono text-[12px]"
      >
        [{checked ? 'x' : ' '}] {props.label}
      </button>
    );
  },

  Select: ({ props, bindings }) => {
    const [value, setValue] = useBoundProp<string>(props.value as string, bindings?.value);
    return (
      <label className="block font-mono text-[12px]">
        {props.label}:{' '}
        <select
          className="border border-current bg-transparent"
          value={value ?? ''}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="">--</option>
          {(props.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  },

  Divider: () => <div className="border-t-2 border-dashed border-current/40" />,
};
