'use client';

import type { ActionDispatchInfo, ActionSettleInfo, Spec } from '@json-render/core';
import { registerActionObserver } from '@json-render/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SpecPlayground } from '../playground/spec-playground';
import { stagesFromTasks, type Stage, type StageMeta } from '@/lib/labs/types';
import { Panel, Pill } from '../playground/ui';
import type { Task } from './task-list';
import { deepFind } from '@/lib/demo/spec-query';
import { demoHandlers, handlerEnv } from '@/lib/demo/action-handlers';
import { DEMO_ACTION_DECL, DEMO_REGISTRY_ACTIONS, HANDLER_ENTRIES } from '@/lib/demo/source.generated';
import type { WiringBlock } from '../playground/wiring-pane';

/**
 * The action lifecycle, one idea at a time.
 *
 * This used to be a single spec carrying every feature at once — four
 * built-ins, a confirm dialog, two follow-up branches, an array binding and a
 * cascading watcher — with nine tasks stacked against it. Everything was true
 * and nothing was findable: you could not tell which card taught which field.
 *
 * Now it is SEVEN LESSONS behind a tab strip, five about `on` and two about
 * `watch`. Each one owns the smallest spec that shows its field, the JSON
 * shape beside it, only the toggles it needs, and only the notes that explain
 * what you just watched happen. The dispatch timeline is the one thing that
 * stays: it is the through-line between them.
 *
 * `registerActionObserver` (core/dist/index.mjs, `registerActionObserver`) is
 * the devtools hook behind that timeline: every dispatch and every settle
 * passes through it, with timings and outcomes. It is global (not
 * per-provider) and works from any framework adapter — ActionProvider calls
 * `notifyActionDispatch` / `notifyActionSettle` around every `execute`,
 * including the built-ins that never reach your handlers map.
 */

/* ------------------------------------------------------------- counting --- */

export interface Counts {
  /** Dispatches by action name. From the observer, so built-ins are in here too. */
  n: Record<string, number>;
  /** Rejections carrying ActionProvider's `new Error("Action cancelled")`. */
  cancelled: number;
  /**
   * Handler rejections that escaped entirely — an `on` binding with no
   * `onError`. Nothing in the renderer catches those, so they land on window.
   */
  unhandled: number;
  /** A watcher dispatch inside the first 1.5s of a lesson would disprove the claim. */
  firedOnMount: boolean;
}

const ZERO: Counts = { n: {}, cancelled: 0, unhandled: 0, firedOnMount: false };

/** Dispatches seen for one action name. */
const n = (c: Counts, name: string) => c.n[name] ?? 0;

/* ------------------------------------------------------- lesson 1 · on ---- */

const ON_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: {
      type: 'Screen',
      props: { title: 'One event, one action', subtitle: 'The whole of json-render behaviour, in three lines' },
      children: ['who', 'card'],
    },
    who: {
      type: 'TextInput',
      props: {
        label: 'Your name',
        value: { $bindState: '/who' },
        placeholder: 'Ada',
        help: 'Task 2 sends this value to the handler.',
        required: null,
        checks: null,
      },
      children: [],
    },
    card: {
      type: 'Card',
      props: { title: 'Plain dispatch', subtitle: 'No confirm, no follow-up' },
      children: ['plain'],
    },
    plain: {
      type: 'Button',
      props: { label: 'notify', variant: 'secondary' },
      // The component emits "press". The element maps it. The runtime dispatches.
      on: { press: { action: 'notify', params: { message: 'plain dispatch' } } },
      children: [],
    },
  },
};

const ON_SEED = { who: 'Ada' };

/** Task 2 solved: the param is an expression, resolved at dispatch time. */
const ON_BOUND_SPEC: Spec = {
  root: 'screen',
  elements: {
    ...ON_SPEC.elements,
    plain: {
      type: 'Button',
      props: { label: 'notify', variant: 'secondary' },
      on: { press: { action: 'notify', params: { message: { $template: 'Hello ${/who}' } } } },
      children: [],
    },
  },
};

/**
 * Task 3 solved: the flag sits on the binding and the runtime never acts on it.
 * All the renderer does is report it back to the component as
 * `on('press').shouldPreventDefault` — and this Button calls `emit('press')`,
 * the shorthand that never asks.
 */
const ON_PREVENT_SPEC: Spec = {
  root: 'screen',
  elements: {
    ...ON_SPEC.elements,
    plain: {
      type: 'Button',
      props: { label: 'notify', variant: 'secondary' },
      on: { press: { action: 'notify', params: { message: 'plain dispatch' }, preventDefault: true } },
      children: [],
    },
  },
};

/* ------------------------------------------------- lesson 2 · built-ins --- */

const BUILTIN_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: {
      type: 'Screen',
      props: { title: 'Four actions nobody implemented', subtitle: 'setState · pushState · removeState · validateForm' },
      children: ['form', 'list', 'verdict'],
    },
    form: {
      type: 'Card',
      props: { title: 'Add a task', subtitle: 'pushState mints the id and empties the input' },
      children: ['draft', 'row'],
    },
    draft: {
      type: 'TextInput',
      props: {
        label: 'New task',
        value: { $bindState: '/draft' },
        placeholder: 'Reconcile the bank feed',
        help: 'Two characters is too short — that is task 3.',
        required: true,
        checks: [{ type: 'minLength', args: { min: 3 }, message: 'At least 3 characters' }],
      },
      children: [],
    },
    row: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: true },
      children: ['add', 'check', 'clear'],
    },
    add: {
      type: 'Button',
      props: { label: 'add (pushState)', variant: 'primary' },
      on: {
        press: {
          action: 'pushState',
          params: {
            statePath: '/tasks',
            // "$id" is not a string the handler sees — pushState expands it.
            value: { id: '$id', title: { $state: '/draft' } },
            // …and empties the input in the same dispatch.
            clearStatePath: '/draft',
          },
        },
      },
      children: [],
    },
    check: {
      type: 'Button',
      props: { label: 'validateForm', variant: 'secondary' },
      on: { press: { action: 'validateForm', params: { statePath: '/result' } } },
      children: [],
    },
    clear: {
      type: 'Button',
      props: { label: 'setState: empty the list', variant: 'ghost' },
      on: { press: { action: 'setState', params: { statePath: '/tasks', value: [] } } },
      children: [],
    },
    list: {
      type: 'Card',
      props: { title: { $item: 'title' }, subtitle: null },
      repeat: { statePath: '/tasks', key: 'id' },
      children: ['del'],
    },
    del: {
      type: 'Button',
      props: { label: 'removeState', variant: 'ghost' },
      on: { press: { action: 'removeState', params: { statePath: '/tasks', index: { $index: true } } } },
      children: [],
    },
    verdict: {
      type: 'Alert',
      props: {
        title: 'validateForm wrote /result',
        message: { $template: 'valid: ${/result/valid}' },
        tone: 'info',
      },
      visible: { $state: '/result' },
      children: [],
    },
  },
};

const BUILTIN_SEED = { draft: '', tasks: [{ id: 't1', title: 'Reconcile the bank feed' }], result: null };

/* --------------------------------------------------- lesson 3 · confirm --- */

const CONFIRM_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: {
      type: 'Screen',
      props: { title: 'A dialog the spec asked for', subtitle: 'ActionProvider renders it; your handler never hears about it' },
      children: ['custom', 'builtin', 'list', 'status'],
    },
    custom: {
      type: 'Card',
      props: { title: 'custom action + confirm', subtitle: 'The dialog opens' },
      children: ['danger'],
    },
    danger: {
      type: 'Button',
      props: { label: 'Delete everything', variant: 'danger' },
      on: {
        press: {
          action: 'deleteAll',
          // Declared IN THE SPEC, not in your handler.
          confirm: {
            title: 'Delete every record?',
            message: 'This cannot be undone. The spec asked for this dialog, not the handler.',
            confirmLabel: 'Delete',
            cancelLabel: 'Keep them',
            variant: 'danger',
          },
          onSuccess: { set: { '/status': 'deleted' } },
        },
      },
      children: [],
    },
    builtin: {
      type: 'Card',
      props: { title: 'built-in + confirm', subtitle: 'The dialog never opens' },
      children: ['wipe'],
    },
    wipe: {
      type: 'Button',
      props: { label: 'Drop the first row', variant: 'danger' },
      on: {
        press: {
          action: 'removeState',
          params: { statePath: '/rows', index: 0 },
          // Ignored. removeState returns before ActionProvider reaches the confirm branch.
          confirm: { title: 'Drop it?', message: 'You will never see this.', variant: 'danger' },
        },
      },
      children: [],
    },
    list: {
      type: 'Card',
      props: { title: 'rows', subtitle: null },
      children: ['rowRepeat'],
    },
    rowRepeat: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: true },
      repeat: { statePath: '/rows', key: 'id' },
      children: ['rowBadge'],
    },
    rowBadge: {
      type: 'Badge',
      props: { label: { $item: 'label' }, tone: 'neutral' },
      children: [],
    },
    status: {
      type: 'Alert',
      props: { title: 'status', message: { $state: '/status' }, tone: 'info' },
      visible: { $state: '/status' },
      children: [],
    },
  },
};

const CONFIRM_SEED = {
  status: '',
  rows: [
    { id: 'r1', label: 'first' },
    { id: 'r2', label: 'second' },
    { id: 'r3', label: 'third' },
  ],
};

/* -------------------------------------------------- lesson 4 · branches --- */

const BRANCH_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: {
      type: 'Screen',
      props: { title: 'What happens after', subtitle: 'onSuccess and onError — { set } or { action, params }' },
      children: ['draft', 'row', 'status', 'lastError'],
    },
    draft: {
      type: 'TextInput',
      props: {
        label: 'Draft',
        value: { $bindState: '/draft' },
        placeholder: 'anything',
        help: 'Passed to the save handler as a resolved param.',
        required: null,
        checks: null,
      },
      children: [],
    },
    row: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: true },
      children: ['saveSet', 'saveChain', 'saveBare'],
    },
    saveSet: {
      type: 'Button',
      props: { label: 'Save (writes state)', variant: 'primary' },
      on: {
        press: {
          action: 'save',
          params: { draft: { $state: '/draft' } },
          // The { set } form: a map of path → value, no action involved.
          onSuccess: { set: { '/status': 'saved' } },
          // "$error.message" is a literal that executeAction substitutes for
          // the real thrown message. It works in onError `set` and nowhere else.
          onError: { set: { '/status': 'save failed', '/lastError': '$error.message' } },
        },
      },
      children: [],
    },
    saveChain: {
      type: 'Button',
      props: { label: 'Save then toast', variant: 'secondary' },
      on: {
        press: {
          action: 'save',
          params: { draft: { $state: '/draft' } },
          // The { action } form: a second dispatch, after the first settles.
          onSuccess: { action: 'notify', params: { message: 'Saved.' } },
          onError: { action: 'notify', params: { message: 'Save failed.' } },
        },
      },
      children: [],
    },
    saveBare: {
      type: 'Button',
      props: { label: 'Save (no onError)', variant: 'ghost' },
      on: {
        press: {
          action: 'save',
          params: { draft: { $state: '/draft' } },
          onSuccess: { set: { '/status': 'saved, unguarded' } },
          // No onError. executeAction rethrows, so this is the ONLY one of the
          // three whose failure the timeline can see.
        },
      },
      children: [],
    },
    status: {
      type: 'Alert',
      props: { title: 'status', message: { $state: '/status' }, tone: 'info' },
      visible: { $state: '/status' },
      children: [],
    },
    lastError: {
      type: 'Alert',
      props: { title: '/lastError', message: { $state: '/lastError' }, tone: 'danger' },
      visible: { $state: '/lastError' },
      children: [],
    },
  },
};

const BRANCH_SEED = { draft: 'unsaved text', status: '', lastError: '' };

/* ----------------------------------------------------- lesson 5 · array --- */

const ARRAY_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: {
      type: 'Screen',
      props: { title: 'One press, several actions', subtitle: 'An array runs in order, each awaited before the next' },
      children: ['draft', 'card'],
    },
    draft: {
      type: 'TextInput',
      props: {
        label: 'Draft',
        value: { $bindState: '/draft' },
        placeholder: 'anything',
        help: null,
        required: null,
        checks: null,
      },
      children: [],
    },
    card: {
      type: 'Card',
      props: { title: 'One binding', subtitle: 'Turn it into two' },
      children: ['plain'],
    },
    plain: {
      type: 'Button',
      props: { label: 'notify', variant: 'secondary' },
      on: { press: { action: 'notify', params: { message: 'first' } } },
      children: [],
    },
  },
};

const ARRAY_SEED = { draft: 'unsaved text' };

/** Task 1 solved. */
const ARRAY_SOLVED_SPEC: Spec = {
  root: 'screen',
  elements: {
    ...ARRAY_SPEC.elements,
    plain: {
      type: 'Button',
      props: { label: 'notify', variant: 'secondary' },
      on: {
        press: [
          { action: 'notify', params: { message: 'first' } },
          { action: 'save', params: { draft: { $state: '/draft' } } },
        ],
      },
      children: [],
    },
  },
};

/* ----------------------------------------------------- lesson 6 · watch --- */

const CITIES_FI = [
  { label: 'Helsinki', value: 'hel' },
  { label: 'Tampere', value: 'tre' },
];
const CITIES_SE = [
  { label: 'Stockholm', value: 'sth' },
  { label: 'Malmö', value: 'mmx' },
];

/**
 * One binding per watch entry, spread across the elements that own each
 * concern — NOT an array of three on one element.
 *
 * That is not a style preference, it is the only shape that runs to completion.
 * The renderer's watch effect keeps a `cancelled` flag, its cleanup sets it,
 * and its dependencies include a context object that VisibilityProvider
 * rebuilds on every state change. So the first binding in an array that
 * actually writes state tears down its own effect, and every binding queued
 * behind it is dropped — silently, with no warning and no way to detect it
 * from the spec. Verified in a DOM: `[reset, fill, loadCities]` fires two of
 * three, every time, with or without latency.
 *
 * Chaining through the paths instead gives each binding its own effect, so
 * each one survives.
 */
const COUNTRY_CITIES = {
  $cond: { $state: '/form/country', eq: 'fi' },
  $then: CITIES_FI,
  $else: CITIES_SE,
};

const WATCH_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: {
      type: 'Screen',
      props: { title: 'A state change that dispatches', subtitle: 'Nobody pressed anything' },
      children: ['card'],
    },
    card: {
      type: 'Card',
      props: { title: 'watch · country → cities → city', subtitle: 'Country is already "fi" and /cities is empty' },
      children: ['country', 'city', 'cityHint'],
    },
    country: {
      type: 'Select',
      props: {
        label: 'Country',
        value: { $bindState: '/form/country' },
        options: [
          { label: 'Finland', value: 'fi' },
          { label: 'Sweden', value: 'se' },
        ],
      },
      /**
       * `watch` is a TOP-LEVEL field — a sibling of props/children, never
       * inside props. (`validateSpec` has a dedicated `watch_in_props` issue
       * code for getting that wrong.) One binding: refill the options. Watch
       * params go through `resolveActionParam`, which is full prop resolution,
       * so a $cond works here.
       */
      watch: {
        '/form/country': { action: 'setState', params: { statePath: '/cities', value: COUNTRY_CITIES } },
      },
      children: [],
    },
    city: {
      type: 'Select',
      props: { label: 'City', value: { $bindState: '/form/city' }, options: { $state: '/cities' } },
      // The dependent field resets itself, watching the list rather than the
      // country. A second element, so a second effect.
      watch: { '/cities': { action: 'setState', params: { statePath: '/form/city', value: '' } } },
      children: [],
    },
    cityHint: {
      type: 'Alert',
      props: {
        title: 'loadCities resolved',
        message: { $template: 'onSuccess wrote "${/form/cityHint}" — the handler itself cannot touch state.' },
        tone: 'info',
      },
      visible: { $state: '/form/cityHint' },
      // And the side effect a spec cannot express, on a third element.
      watch: {
        '/cities': {
          action: 'loadCities',
          params: { country: { $state: '/form/country' } },
          // onSuccess params are resolved by `resolveAction`, NOT by the
          // renderer — only {$state} works here. $cond/$template do not.
          onSuccess: {
            action: 'setState',
            params: { statePath: '/form/cityHint', value: { $state: '/form/country' } },
          },
        },
      },
      children: [],
    },
  },
};

/** Country is already set and /cities is empty: proof that watchers skip the first render. */
const WATCH_SEED = { form: { country: 'fi', city: '', cityHint: '' }, cities: [] };

/**
 * The same three bindings as one array on one element — the shape everybody
 * writes first, and the one that silently drops its tail. Loaded by the last
 * task so the timeline can show it stopping at two.
 */
const WATCH_ARRAY_SPEC: Spec = {
  root: 'screen',
  elements: {
    ...WATCH_SPEC.elements,
    country: {
      ...WATCH_SPEC.elements.country,
      watch: {
        '/form/country': [
          { action: 'setState', params: { statePath: '/form/city', value: '' } },
          { action: 'setState', params: { statePath: '/cities', value: COUNTRY_CITIES } },
          {
            action: 'loadCities',
            params: { country: { $state: '/form/country' } },
            onSuccess: {
              action: 'setState',
              params: { statePath: '/form/cityHint', value: { $state: '/form/country' } },
            },
          },
        ],
      },
    },
    city: { ...WATCH_SPEC.elements.city, watch: undefined },
    cityHint: { ...WATCH_SPEC.elements.cityHint, watch: undefined },
  },
};

/* ------------------------------------------------------ lesson 7 · loop --- */

/**
 * A loop that stops — because `createStateStore.set` returns early when
 * `getByPath(state, path) === value` (core/dist/chunk-7V7ZCHEJ.mjs,
 * `createStateStore`). Both watchers write a CONSTANT, so a hop eventually
 * writes a value that is already there, the store never notifies, and the
 * chain dies. Swap either constant for a $template and it never converges.
 */
const LOOP_SPEC: Spec = {
  root: 'card',
  elements: {
    card: {
      type: 'Card',
      props: { title: 'a watcher loop that terminates', subtitle: 'type one character into /a' },
      children: ['a', 'echoA', 'echoB'],
    },
    a: {
      type: 'TextInput',
      props: { label: '/a', value: { $bindState: '/a' }, placeholder: 'type here', help: null, required: null, checks: null },
      watch: { '/a': { action: 'setState', params: { statePath: '/b', value: 'B' } } },
      children: [],
    },
    echoA: { type: 'Badge', props: { label: { $template: '/a = ${/a}' }, tone: 'info' }, children: [] },
    echoB: {
      type: 'Badge',
      props: { label: { $template: '/b = ${/b}' }, tone: 'warning' },
      watch: { '/b': { action: 'setState', params: { statePath: '/a', value: 'A' } } },
      children: [],
    },
  },
};

const LOOP_SEED = { a: '', b: '' };

/* --------------------------------------------------------- the lessons --- */

/** Toggles a lesson needs. Anything not listed stays off the bar. */
type Control = 'fail' | 'slow' | 'mount' | 'escaped';

interface Lesson {
  id: string;
  /** Tab label. Lowercase mono, like every other tab strip here. */
  label: string;
  group: 'actions' | 'watchers';
  title: string;
  /** One sentence: what this field is for. */
  blurb: React.ReactNode;
  shapeTitle: string;
  shape: string;
  spec: Spec;
  seed: Record<string, unknown>;
  controls?: Control[];
  tasks: (counts: Counts) => Task[];
}

/**
 * The stages each lesson contributes, in order.
 *
 * One stage is one FEATURE, not one interaction. Cancelling a confirm and then
 * accepting it are the two sides of `act-confirm`, so they are two PARTS of a
 * single stage rather than two stages that would read as a permutation.
 */
const LESSON_STAGES: Record<string, Array<Omit<StageMeta, 'spec' | 'seed'>>> = {
  on: [
    {
      title: 'on maps an event to an action', panes: ['spec', 'log', 'wiring'] as const,
      when:
        'A user gesture is the trigger. Reach for `watch` instead when the trigger is a value changing, whoever changed it — a watcher fires for a `setState` from another button too, which is either exactly what you want or a cascade nobody asked for. The event name is a bare contract either way: bind `press` on a component that emits `click` and the binding is dead JSON nothing reports.',
      concept: 'on-and-emit',
      ref: 'el-on',
    },
    {
      title: 'params are expressions', panes: ['spec', 'log'] as const,
      when:
        'Whenever the handler needs a value the user just produced rather than one baked in when the spec was written. The alternative is reading the store inside the handler, which is the better choice when the value is none of the spec\u2019s business — a tenant id, an auth token — so keep params for what a spec author would reasonably name. Do not reach for `$template` or `$cond` here: params go through `resolveAction`, which understands `$state` and, inside a repeat, `$item` and `$index`.',
      ref: 'act-params',
      summary:
        'An action\u2019s params resolve like any other expression, so a dispatch can carry a value the user just typed instead of a constant baked into the spec.',
    },
    {
      title: 'preventDefault is a request', panes: ['spec', 'impl', 'log'] as const,
      when:
        'Only in a component that wraps something with native behaviour — an anchor, a submit button — and only if that component takes the `on(event)` handle rather than the `emit(event)` shorthand. Anywhere else it is inert JSON that reads like a working guard, which is worse than leaving it out.',
      ref: 'act-preventdefault',
      summary:
        'The binding can ask for it and the renderer passes the request on, but nothing in the library ever calls preventDefault \u2014 the component that reads `on(event).shouldPreventDefault` is the only thing that can.',
    },
  ],
  'built-ins': [
    {
      title: 'setState writes one path', panes: ['state', 'log'] as const,
      when:
        'When writing the value IS the whole behaviour: a tab switch, a toggle, clearing a draft. Move to a custom handler the moment anything else has to happen — a confirm, a branch on failure, a call to your API — because a built-in returns before `confirm`, `onSuccess` and `onError` are ever looked at.',
      concept: 'built-in-actions',
      ref: 'act-setstate',
      summary:
        'The smallest of the four: a path and a value, written through the store by ActionProvider itself. No handler is looked up, so nothing of yours can see it or refuse it.',
    },
    {
      title: 'pushState mints an id', panes: ['state', 'log'] as const, concept: 'push-state-id', ref: 'act-pushstate',
      when:
        'Adding a row to a list the spec already owns, where the id only has to be unique on this page — `$id` is `Date.now()` plus a counter, not a UUID and not stable across a reload. Write your own handler as soon as the server mints the id or the list outlives the session, and note `clearStatePath` writes `""`, which is right for a text input and wrong for a number or a checkbox.',
    },
    {
      // 'spec': the middle step reads del.on.press.params, where { "$index": true } is.
      title: 'removeState takes an index', panes: ['state', 'log', 'spec'] as const,
      when:
        'A delete button sitting inside the repeat, where `{ "$index": true }` names the row for free. Anything else wants a handler: there is no remove-by-id, and a built-in ignores `confirm`, so "are you sure?" over a destructive delete cannot be expressed here at all.',
      ref: 'act-removestate',
      summary:
        'The index comes from the repeat scope the button sits in, which is how a row deletes itself without anything naming it.',
    },
    {
      title: 'validateForm from a binding', panes: ['state', 'log'] as const,
      when:
        'To refresh what the form SHOWS — run every registered field and put the errors where your UI can read them. Never as the thing that decides whether the submit happens: it writes its verdict and the next binding runs regardless, so the gate belongs in your own handler, which reads the written `valid` first, and on the server after that.',
      ref: 'act-validateform',
      summary:
        'The built-in writes `{ valid, errors }` to a state path and returns. Nothing is blocked and nothing thrown — the report is the whole feature.',
    },
    {
      title: 'The timeline is an observer', panes: ['log', 'wiring'] as const,
      when:
        'Diagnostics and telemetry, not behaviour. It is the only place a built-in dispatch is visible at all, since `setState` and friends never reach your handlers map — but it cannot change or block anything, and it is a module-level registry rather than a per-tree one. Register one at app start for a devtools panel or a latency metric; for logic that depends on an action, write the handler.',
      ref: 'util-registeractionobserver',
      summary:
        'A module-level subscription in core, not a provider prop: it wraps every dispatch in the same try/finally, so it reports the built-ins your handlers map never receives — with an outcome and a duration for each.',
    },
  ],
  confirm: [
    {
      // 'state': /status is the only honest signal of whether the handler ran,
      // and both parts finish by reading it.
      title: 'confirm gates the handler', panes: ['log', 'wiring', 'state'] as const,
      when:
        'A custom action that destroys something or costs money. It is a courtesy to the user and nothing more — the check that matters still belongs on the server — and cancelling REJECTS the promise, so anything calling `useAction().execute()` has to catch `Error("Action cancelled")` or it surfaces as an unhandled rejection.',
      concept: 'confirm-success-error',
      tasks: 2,
      summary:
        'One feature, both sides: cancelling resolves the binding without ever running your handler — and the timeline still reads as success — while accepting runs it and fires `onSuccess`.',
    },
    {
      title: 'Built-ins skip confirm', panes: ['log', 'spec'] as const,
      when:
        'Never expect this pairing to work. If a `removeState` or a `setState` needs confirming, the answer is a custom handler that does the write itself with `confirm` on that binding — the spec will carry the `confirm` block, `validateSpec` will pass it, and the row will still vanish without a dialog.',
      ref: 'act-confirm',
      summary:
        'A built-in action returns before the confirm branch is reached, so the same `confirm` block that guards your handler is ignored here. Destructive built-ins are not gated.',
    },
  ],
  branches: [
    {
      title: 'onSuccess runs after the handler', panes: ['log', 'state'] as const,
      when:
        'When the follow-up must only happen if the action actually succeeded — a toast, a state flag, a redirect. If the two steps are independent, an array of bindings on the event says so more plainly and reads flat; `onSuccess` is for dependence. It is dead on the six built-ins, so pairing it with `setState` writes nothing and reports nothing.',
      ref: 'act-onsuccess',
      summary:
        'The success branch is a binding like any other, so it can write state, dispatch again, or both.',
    },
    {
      // 'state': the onError `set` writes /status and /lastError, which is the
      // only place the swallowed rejection shows up at all.
      title: 'onError catches a rejection', panes: ['log', 'wiring', 'state'] as const,
      when:
        'As soon as a failure has any consequence a person should see. Letting the promise reject is only honest for fire-and-forget, because nothing in the library renders an error: the screen keeps its optimistic state and the only trace is the console. Your handler also has to actually throw — one that catches its own error and returns quietly never reaches this branch.',
      ref: 'act-onerror',
      tasks: 2,
      summary:
        'One feature, both sides: with `onError` the failure becomes a branch the spec already named; without it the rejection escapes to the window and nothing in the UI says so.',
    },
    {
      title: 'Chaining through onSuccess', panes: ['log', 'spec'] as const,
      when:
        'For a sequence where each step depends on the one before it. When they do not depend on each other, an array of bindings is the same behaviour without the nesting and stays readable past two steps. Each level branches only on its own action, so a three-deep chain needs an `onError` at each level to say where it stopped.',
      ref: 'act-binding',
      summary:
        'A branch can dispatch another action, so a sequence is expressed by nesting rather than by a list.',
    },
  ],
  array: [
    {
      // 'tree': the last step of part one checks that an array of bindings is
      // still one `on` tag on the element.
      title: 'An array of bindings', panes: ['spec', 'log', 'tree'] as const,
      when:
        'Several independent things on one press. It is sequential, not conditional — nothing in the array can stop what follows — so "validate then submit" is not what it looks like; that needs `onSuccess` or a decision inside your own handler. And it belongs to `on` alone: in a `watch` entry the first state-changing binding drops the rest.',
      concept: 'binding-array',
      ref: 'act-array',
      tasks: 2,
      summary:
        'One feature, written then run: several bindings on one event, each awaited before the next begins. Nothing in the array can stop what follows it.',
    },
  ],
  watch: [
    {
      title: 'watch reacts to state, not events', panes: ['spec', 'log', 'state'] as const, concept: 'watch',
      when:
        'When the reaction has to happen however the value changed — typed into a field, written by another action, restored from a saved store. If exactly one button can cause it, `on` is easier to follow and cannot surprise you. A watcher also lives on its element, so hiding that element with `visible` quietly turns the reaction off.',
    },
    {
      // 'tree': the last step opens each of the three elements to see that the
      // cascade is three separate watch fields.
      title: 'A watcher can wake a watcher', panes: ['log', 'state', 'tree'] as const,
      when:
        'A multi-step cascade whose steps are spec-authored: each element watches the path the step before it wrote. When every step is your own code, one handler doing them in order is easier to read and easier to stop. Nothing traces the chain for you, so keep it to two or three hops before the behaviour stops being reconstructable from the spec.',
      ref: 'el-watch',
      summary:
        'A watcher that writes state can trigger another. That is the useful case and the dangerous one, and they look identical in the spec.',
    },
    {
      title: 'One binding per watch entry', panes: ['spec', 'log'] as const,
      when:
        'Always one — a rule rather than a choice. When a watched change needs several things done, either put them in one custom handler or give each step its own entry on the element that owns the path it writes. An array here validates clean and silently drops everything after the first state-changing binding.',
      ref: 'el-watch',
      summary:
        'Put several bindings in one entry and only those up to the first state-changing one run: that write tears down the effect and the rest are dropped, with no warning and a clean validateSpec.',
    },
  ],
  loop: [
    {
      title: 'A watcher that feeds itself', panes: ['log', 'state'] as const,
      when:
        'The question to ask before shipping any watcher that writes state: can this converge? Writing a constant does, because `set` returns early on an identical value; writing anything freshly generated — a timestamp, a counter, a new array — never does, and nothing in the library counts the passes or breaks the cycle for you.',
      concept: 'watcher-loop',
      tasks: 2,
      summary:
        'One feature, twice: the cascade runs until the value stops changing. Nothing counts the passes, so a watcher that always writes something different never stops.',
    },
  ],
};

/** Task id → the lesson it belongs to, so a stage can scope the lab. */
const LESSON_OF: Record<string, string> = {};

const LESSONS: Lesson[] = [
  {
    id: 'on',
    label: 'on',
    group: 'actions',
    title: 'on — the component emits, the element names the action',
    blurb: (
      <>
        A spec cannot hold code, so behaviour works by naming. <code>Button</code> emits <code>press</code>; the
        element&rsquo;s <code>on</code> map says which action that means; the runtime dispatches it.
      </>
    ),
    shapeTitle: 'one event, one action',
    shape: `{
  "type": "Button",
  "props": { "label": "notify", "variant": "secondary" },
  "on": {
    "press": { "action": "notify", "params": { "message": "plain dispatch" } }
  }
}`,
    spec: ON_SPEC,
    seed: ON_SEED,
    tasks: () => [
      {
        id: 'press',
        goal: (
          <>
            Press <strong>notify</strong> and watch one dispatch settle in the timeline, with a real duration.
          </>
        ),
        steps: [
          <>
            In <strong>rendered output</strong>, press the <strong>notify</strong> button.
          </>,
          <>
            Open the <strong>spec json</strong> tab and read the <code>plain</code> element:{' '}
            <code>{'"on": { "press": { "action": "notify", "params": { "message": "plain dispatch" } } }'}</code> — an
            event name mapped to an action, on the element itself.
          </>,
          <>
            Click the <strong>log</strong> tab: <code>action notify({'{"message":"plain dispatch"}'})</code>.
          </>,
          <>
            Read the <strong>dispatch timeline</strong> under the playground: one row, <code>ok</code>,{' '}
            <code>notify</code>, with its duration in ms.
          </>,
        ],
        check: ({ fired }) => fired.includes('notify'),
      },
      {
        id: 'param-from-state',
        goal: (
          <>
            Make the message read from state instead of being a constant — <code>{'{ "$template": "Hello ${/who}" }'}</code>
            .
          </>
        ),
        hint: 'Params on `on` go through the renderer, so anything you can write in a prop you can write here.',
        steps: [
          <>
            Open the <strong>spec json</strong> tab and find <code>plain.on.press.params.message</code>.
          </>,
          <>
            Replace the string with <code>{'{ "$template": "Hello ${/who}" }'}</code>.
          </>,
          <>
            Press <strong>notify</strong> again and read the <strong>log</strong> tab:{' '}
            <code>notify({'{"message":"Hello Ada"}'})</code> — resolved before the handler saw it.
          </>,
          <>
            Type a different name into <strong>Your name</strong> and press again. The param follows the state.
          </>,
        ],
        solution: {
          spec: ON_BOUND_SPEC,
          note: 'The param is now an expression. resolveActionParam evaluates it against the live state at dispatch time, so the handler still receives a plain string.',
        },
        check: ({ spec }) =>
          Boolean(
            deepFind(
              spec?.elements ?? {},
              (node) =>
                node.action === 'notify' &&
                typeof node.params === 'object' &&
                node.params !== null &&
                typeof (node.params as Record<string, unknown>).message === 'object',
            ),
          ),
      },
      {
        id: 'prevent-default',
        goal: (
          <>
            Add <code>{'"preventDefault": true'}</code> to the <code>plain</code> button&rsquo;s{' '}
            <code>press</code> binding, press <strong>notify</strong> again — and watch nothing change. The library
            never calls <code>preventDefault</code> for you.
          </>
        ),
        hint: 'It is a flag the renderer hands back to your component as on("press").shouldPreventDefault. This Button calls emit("press"), the shorthand that never asks for it.',
        steps: [
          <>
            Open the <strong>spec json</strong> tab and find <code>plain.on.press</code>.
          </>,
          <>
            Add <code>{'"preventDefault": true'}</code> beside <code>&quot;action&quot;</code>, inside the same
            binding object.
          </>,
          <>
            Press <strong>notify</strong>. The <strong>log</strong> tab records exactly the dispatch it did before —
            the flag changed nothing about the dispatch.
          </>,
          <>
            Open the <strong>component code</strong> tab and read <code>Button</code>:{' '}
            <code>{"onClick={() => emit('press')}"}</code>. <code>emit</code> fires and returns; it never sees the
            flag. A component that needs it takes the handle instead —{' '}
            <code>{"const press = on('press'); if (press.shouldPreventDefault) e.preventDefault(); press.emit();"}</code>{' '}
            — which is how an anchor or a form submit stops the browser doing its own thing.
          </>,
        ],
        solution: {
          spec: ON_PREVENT_SPEC,
          note: 'The binding now carries preventDefault. Nothing in json-render reads it: it is published to the component through on(event).shouldPreventDefault, true when ANY binding for that event asked, and this Button does not look.',
        },
        check: ({ spec, fired }) =>
          fired.includes('notify') && Boolean(deepFind(spec?.elements ?? {}, (node) => node.preventDefault === true)),
      },
    ],
  },
  {
    id: 'built-ins',
    label: 'built-ins',
    group: 'actions',
    title: 'The four actions you never implement',
    blurb: (
      <>
        <code>setState</code>, <code>pushState</code>, <code>removeState</code> and <code>validateForm</code> are
        handled inside <code>ActionProvider</code>. No declaration, no handler, and they are always in the generated
        prompt.
      </>
    ),
    shapeTitle: 'the four built-ins — no declaration, no handler',
    shape: `{ "action": "setState",     "params": { "statePath": "/tab", "value": "b" } }

{ "action": "pushState",    "params": { "statePath": "/tasks",
                                        "value": { "id": "$id",
                                                   "title": { "$state": "/draft" } },
                                        "clearStatePath": "/draft" } }

{ "action": "removeState",  "params": { "statePath": "/tasks",
                                        "index": { "$index": true } } }

{ "action": "validateForm", "params": { "statePath": "/result" } }`,
    spec: BUILTIN_SPEC,
    seed: BUILTIN_SEED,
    tasks: (counts) => [
      {
        id: 'set-state',
        goal: (
          <>
            Press <strong>setState: empty the list</strong>. One path, one value — and the seeded row is gone,
            with no handler anywhere in the app.
          </>
        ),
        hint: 'setState takes statePath and value and writes the value through the store. It replaces, it does not merge.',
        steps: [
          <>
            Press <strong>setState: empty the list</strong> in the row of buttons.
          </>,
          <>
            The card that was there has gone.
          </>,
          <>
            Click the <strong>state</strong> tab: <code>&quot;tasks&quot;: []</code> — the binding&rsquo;s literal{' '}
            <code>value</code>, written straight over what was there.
          </>,
          <>
            Click the <strong>log</strong> tab: a single <code>/tasks = []</code> write and no{' '}
            <code>action</code> line beside it. The dispatch never reached the handlers map this lab passed to the
            provider, because <code>ActionProvider</code> answered it itself.
          </>,
        ],
        check: ({ state }) =>
          n(counts, 'setState') >= 1 && Array.isArray(state.tasks) && state.tasks.length === 0,
      },
      {
        id: 'push',
        goal: (
          <>
            Type a task and press <strong>add</strong>. <code>pushState</code> appends it, mints its <code>id</code>{' '}
            and empties the input.
          </>
        ),
        steps: [
          <>
            Type something into <strong>New task</strong> — at least three characters.
          </>,
          <>
            Press <strong>add (pushState)</strong>.
          </>,
          <>
            The input is empty again, and a second card has appeared with your text as its title.
          </>,
          <>
            Click the <strong>state</strong> tab: the new entry has an <code>id</code> like{' '}
            <code>&quot;id-…&quot;</code>. The spec said <code>&quot;$id&quot;</code>; <code>pushState</code>{' '}
            replaced it.
          </>,
        ],
        check: ({ state }) => Array.isArray(state.tasks) && state.tasks.length >= 2 && state.draft === '',
      },
      {
        id: 'remove',
        goal: (
          <>
            Remove a row with its <strong>removeState</strong> button — the index comes from the repeat, not from
            your code.
          </>
        ),
        hint: '{ "$index": true } resolves to the position of the current repeat item.',
        steps: [
          <>
            Press <strong>removeState</strong> inside any card.
          </>,
          <>
            Open the <strong>spec json</strong> tab and read <code>del.on.press.params</code>:{' '}
            <code>{'{ "statePath": "/tasks", "index": { "$index": true } }'}</code> — one binding, reused by every
            row.
          </>,
          <>
            Read the <strong>dispatch timeline</strong>: a <code>removeState</code> row. It never reached a handler
            you wrote.
          </>,
        ],
        check: () => n(counts, 'removeState') >= 1,
      },
      {
        id: 'validate',
        goal: (
          <>
            Put two characters in <strong>New task</strong>, press <strong>validateForm</strong>, and read the
            verdict it wrote to <code>/result</code>.
          </>
        ),
        hint: 'validateForm collects every field that called useFieldValidation and writes { valid, errors } to statePath.',
        steps: [
          <>
            Type <code>ab</code> into <strong>New task</strong> — one character short of the check.
          </>,
          <>
            Press <strong>validateForm</strong>.
          </>,
          <>
            An alert appears reading <code>valid: false</code>, and the field shows its message.
          </>,
          <>
            Click the <strong>state</strong> tab and open <code>result</code>: <code>valid</code> plus an{' '}
            <code>errors</code> map keyed by binding path.
          </>,
        ],
        check: ({ state }) =>
          Boolean(state.result) && (state.result as Record<string, unknown>).valid === false,
      },
      {
        id: 'observer',
        goal: (
          <>
            Dispatch two built-ins — <strong>add (pushState)</strong> then{' '}
            <strong>setState: empty the list</strong> — and compare the two panels. The <strong>log</strong> tab
            shows neither action; the <strong>dispatch timeline</strong> timed both.
          </>
        ),
        hint: 'That timeline is registerActionObserver from @json-render/core: a module-level subscription, not a provider prop, wrapped around every dispatch including the ones ActionProvider answers itself.',
        steps: [
          <>
            Type three characters into <strong>New task</strong> and press <strong>add (pushState)</strong>, then
            press <strong>setState: empty the list</strong>.
          </>,
          <>
            Click the <strong>log</strong> tab: <code>write</code> lines only. That pane is fed by the handlers map
            this lab passes to the provider, and a built-in returns long before the lookup that would reach it.
          </>,
          <>
            Read the <strong>dispatch timeline</strong> under the playground: <code>setState</code> and{' '}
            <code>pushState</code>, each with an <code>ok</code> badge and a duration in ms. Same run, two
            different answers to &ldquo;what just happened&rdquo;.
          </>,
          <>
            Open the <strong>your app code</strong> tab and read <code>lib/demo/action-handlers.ts</code>: four
            functions, none of them a built-in. The observer is the only thing in the app that can report those.
          </>,
          <>
            <code>{'registerActionObserver({ onDispatch, onSettle })'}</code> returns an unsubscribe, and a
            dispatch and its settle share an id — which is how a row here gets its outcome after the fact rather
            than a second row.
          </>,
        ],
        check: () => n(counts, 'pushState') >= 1 && n(counts, 'setState') >= 1,
      },
    ],
  },
  {
    id: 'confirm',
    label: 'confirm',
    group: 'actions',
    title: 'confirm — a dialog that travels with the instruction',
    blurb: (
      <>
        A binding can carry a <code>confirm</code> block. <code>ActionProvider</code> renders the dialog and only
        dispatches on accept, so a generated UI can demand confirmation without you writing any dialog code.
      </>
    ),
    shapeTitle: 'confirm, on a custom action',
    shape: `{
  "action": "deleteAll",
  "confirm": {
    "title": "Delete every record?",
    "message": "This cannot be undone.",
    "confirmLabel": "Delete",
    "cancelLabel": "Keep them",
    "variant": "danger"
  },
  "onSuccess": { "set": { "/status": "deleted" } }
}

// On a BUILT-IN, the same block is silently ignored:
{ "action": "removeState", "params": { … }, "confirm": { … } }  // deletes anyway`,
    spec: CONFIRM_SPEC,
    seed: CONFIRM_SEED,
    controls: ['fail', 'slow'],
    tasks: (counts) => [
      {
        id: 'cancel',
        goal: (
          <>
            Press <strong>Delete everything</strong> and <em>cancel</em>. The timeline will claim it succeeded in
            about a millisecond, and <code>/status</code> stays empty.
          </>
        ),
        hint: 'The settle event fires when the dialog OPENS, not when you answer it.',
        steps: [
          <>
            Press <strong>Delete everything</strong>. A dialog opens, titled <strong>Delete every record?</strong> —
            nothing in the handler asked for it, the <code>confirm</code> block in the spec did.
          </>,
          <>
            Press <strong>Keep them</strong>.
          </>,
          <>
            Read the <strong>dispatch timeline</strong>: a green <code>ok</code> row for <code>deleteAll</code>, at
            about <code>1ms</code>. The handler never ran.
          </>,
          <>
            Click the <strong>state</strong> tab: <code>status</code> is still <code>&quot;&quot;</code> — the only
            honest signal that nothing happened.
          </>,
        ],
        check: () => n(counts, 'deleteAll') >= 1 && counts.cancelled >= 1,
      },
      {
        id: 'accept',
        goal: (
          <>
            Accept it this time, so the handler actually runs and <code>onSuccess</code> writes{' '}
            <code>&quot;deleted&quot;</code>.
          </>
        ),
        steps: [
          <>
            Press <strong>Delete everything</strong> again, then <strong>Delete</strong> in the dialog.
          </>,
          <>
            Wait about half a second — <strong>simulate latency</strong> is on, so the handler sleeps 450ms.
          </>,
          <>
            A blue <strong>status</strong> alert appears, and the <strong>state</strong> tab reads{' '}
            <code>&quot;status&quot;: &quot;deleted&quot;</code>.
          </>,
        ],
        check: ({ state }) => state.status === 'deleted',
      },
      {
        id: 'builtin-ignores',
        goal: (
          <>
            Press <strong>Drop the first row</strong>. It carries the same <code>confirm</code> block — and deletes
            with no dialog at all.
          </>
        ),
        hint: 'removeState returns before ActionProvider reaches the confirm branch. Route confirmed deletes through a custom action.',
        steps: [
          <>
            Count the badges in the <strong>rows</strong> card: three.
          </>,
          <>
            Press <strong>Drop the first row</strong>.
          </>,
          <>
            No dialog. <code>first</code> is gone.
          </>,
          <>
            Open the <strong>spec json</strong> tab and confirm the <code>confirm</code> block is really there on{' '}
            <code>wipe.on.press</code>. It is; it is just never read.
          </>,
        ],
        check: () => n(counts, 'removeState') >= 1,
      },
    ],
  },
  {
    id: 'branches',
    label: 'onSuccess / onError',
    group: 'actions',
    title: 'onSuccess and onError — what happens after',
    blurb: (
      <>
        Both take the same two shapes: <code>{'{ set: { "/path": value } }'}</code> writes state directly, and{' '}
        <code>{'{ action, params }'}</code> dispatches a second action once the first settles.
      </>
    ),
    shapeTitle: 'everything a binding can carry',
    shape: `{
  "action": "deleteAll",
  "params":  { "id": { "$state": "/selected" } },
  "confirm": { "title": "Delete?", "message": "…", "variant": "danger" },
  "onSuccess": { "set": { "/status": "deleted" } },   // or { action, params }
  "onError":   { "action": "notify", "params": { "message": "Failed." } },
  "preventDefault": true
}`,
    spec: BRANCH_SPEC,
    seed: BRANCH_SEED,
    controls: ['fail', 'slow', 'escaped'],
    tasks: (counts) => [
      {
        id: 'success',
        goal: (
          <>
            Press <strong>Save (writes state)</strong> with the handlers healthy, so <code>onSuccess</code> writes{' '}
            <code>&quot;saved&quot;</code> to <code>/status</code>.
          </>
        ),
        steps: [
          <>
            Leave <strong>make handlers fail</strong> unticked and press <strong>Save (writes state)</strong>.
          </>,
          <>
            Wait for the <code>save</code> row in the timeline to turn green.
          </>,
          <>
            Click the <strong>state</strong> tab: <code>&quot;status&quot;: &quot;saved&quot;</code>, written by{' '}
            <code>{'onSuccess: { "set": { "/status": "saved" } }'}</code>.
          </>,
        ],
        check: ({ state }) => state.status === 'saved',
      },
      {
        id: 'error',
        goal: (
          <>
            Tick <strong>make handlers fail</strong> and press it again. Same binding, other branch — and the
            timeline still says <code>ok</code>.
          </>
        ),
        hint: 'executeAction rethrows only when there is NO onError. With one, the rejection stops there and never reaches the code that reports the outcome.',
        steps: [
          <>
            Tick <strong>make handlers fail</strong> in the grey bar above the playground.
          </>,
          <>
            Press <strong>Save (writes state)</strong>.
          </>,
          <>
            Read the <strong>dispatch timeline</strong>: a green <code>ok</code> row. The handler threw, and the
            timeline cannot tell.
          </>,
          <>
            Read the <strong>state</strong> tab: <code>&quot;status&quot;: &quot;save failed&quot;</code>, and{' '}
            <code>lastError</code> holds <code>&quot;validation rejected the draft&quot;</code> — the real message,
            substituted for the literal <code>&quot;$error.message&quot;</code> in the <code>onError</code> set.
          </>,
          <>
            Open the <strong>your app code</strong> tab, switch it to{' '}
            <strong>+ library internals</strong>, and read the <code>catch</code> in{' '}
            <code>executeAction</code>: <code>throw error</code> sits in the <code>else</code>.
          </>,
        ],
        check: ({ state }) => state.status === 'save failed' && Boolean(state.lastError),
      },
      {
        id: 'no-onerror',
        goal: (
          <>
            Still failing, press <strong>Save (no onError)</strong>. <em>Now</em> the row turns red — and the
            rejection escapes the renderer entirely.
          </>
        ),
        hint: 'Without onError there is nothing to swallow the throw, so it propagates out of execute — and Renderer.emit does not catch either.',
        steps: [
          <>
            Keep <strong>make handlers fail</strong> ticked.
          </>,
          <>
            Press <strong>Save (no onError)</strong>.
          </>,
          <>
            The timeline row is red and reads <code>validation rejected the draft</code>. Same handler, same
            failure, different report — the only difference is the missing <code>onError</code>.
          </>,
          <>
            Check the grey bar: <strong>escaped to window:</strong> has gone up. Nothing between your handler and
            the browser caught that. In your own app it would hit the dev overlay and your error reporter.
          </>,
          <>
            A watcher would differ again: the watch effect ends in <code>.catch(console.error)</code>, so the same
            throw would be logged rather than escaping.
          </>,
        ],
        check: () => counts.unhandled >= 1,
      },
      {
        id: 'chain',
        goal: (
          <>
            Untick the failure switch and use <strong>Save then toast</strong> to get <em>two</em> entries in the
            timeline from one press.
          </>
        ),
        steps: [
          <>
            Untick <strong>make handlers fail</strong>.
          </>,
          <>
            Press <strong>Save then toast</strong>.
          </>,
          <>
            Read the timeline, newest at the top: a <code>notify</code> row above a <code>save</code> row of about
            250ms. One press, two dispatches, the second only after the first resolved.
          </>,
        ],
        check: () => n(counts, 'notify') >= 1 && n(counts, 'save') >= 1,
      },
    ],
  },
  {
    id: 'array',
    label: 'arrays',
    group: 'actions',
    title: 'An array of bindings, run in order',
    blurb: (
      <>
        Anywhere a binding is allowed, an array of bindings is allowed too. The renderer awaits each one before it
        starts the next.
      </>
    ),
    shapeTitle: 'one binding, or an array of them',
    shape: `"on": { "press": { "action": "validateForm" } }

// An ARRAY runs in order, each awaited before the next:
"on": {
  "press": [
    { "action": "notify", "params": { "message": "first" } },
    { "action": "save",   "params": { "draft": { "$state": "/draft" } } }
  ]
}`,
    spec: ARRAY_SPEC,
    seed: ARRAY_SEED,
    controls: ['slow'],
    tasks: (counts) => [
      {
        id: 'make-array',
        goal: (
          <>
            Edit the spec so one <code>press</code> runs an <strong>array</strong> of two actions.
          </>
        ),
        hint: '"press": [ { "action": "notify", … }, { "action": "save", … } ]',
        steps: [
          <>
            Open the <strong>spec json</strong> tab and find the <code>plain</code> element&rsquo;s <code>on</code>{' '}
            field.
          </>,
          <>
            Wrap the existing binding in <code>[ … ]</code>, then add a second one:{' '}
            <code>{'{ "action": "save", "params": { "draft": { "$state": "/draft" } } }'}</code>.
          </>,
          <>
            Click the <strong>tree</strong> tab: the <code>plain</code> row still carries one blue{' '}
            <strong>on</strong> tag.
          </>,
        ],
        solution: {
          spec: ARRAY_SOLVED_SPEC,
          note: 'press now holds an array of two bindings; the renderer awaits each in order before starting the next.',
        },
        check: ({ spec }) =>
          Boolean(
            deepFind(
              spec?.elements ?? {},
              (node) => 'press' in node && Array.isArray(node.press) && (node.press as unknown[]).length > 1,
            ),
          ),
      },
      {
        id: 'run-array',
        goal: (
          <>
            Press the button and read the two rows it produced, in order.
          </>
        ),
        steps: [
          <>
            Press <strong>notify</strong>.
          </>,
          <>
            Read the <strong>dispatch timeline</strong>: <code>save</code> on top, <code>notify</code> under it —
            because the array ran in order and the panel lists the newest first.
          </>,
          <>
            <code>save</code> takes about 250ms with <strong>simulate latency</strong> on; <code>notify</code>{' '}
            returns instantly. The gap between them is the await.
          </>,
        ],
        check: () => n(counts, 'notify') >= 1 && n(counts, 'save') >= 1,
      },
    ],
  },
  {
    id: 'watch',
    label: 'watch',
    group: 'watchers',
    title: 'watch — a dispatch nobody pressed',
    blurb: (
      <>
        <code>watch</code> is a top-level element field mapping state paths to bindings. When a watched value
        changes, its bindings fire. It is how a spec expresses &ldquo;when the country changes, load the cities&rdquo;
        — but only if you give each step its own entry, which the last task shows why.
      </>
    ),
    shapeTitle: 'watch — a sibling of props/children, never inside props',
    shape: `// ONE binding per entry. Chain the steps through the paths, on the
// elements that own them — see the warning under the last task.

// on "country":
"watch": { "/form/country": { "action": "setState",
  "params": { "statePath": "/cities", "value": { "$cond": … } } } }

// on "city":
"watch": { "/cities": { "action": "setState",
  "params": { "statePath": "/form/city", "value": "" } } }

// on "cityHint":
"watch": { "/cities": { "action": "loadCities",
  "params": { "country": { "$state": "/form/country" } },
  "onSuccess": { "action": "setState", "params": { … } } } }

// Fires on CHANGE only — never on the first render.`,
    spec: WATCH_SPEC,
    seed: WATCH_SEED,
    controls: ['fail', 'slow', 'mount'],
    tasks: (counts) => [
      {
        id: 'watch-mount',
        goal: (
          <>
            <code>/form/country</code> is seeded to <code>&quot;fi&quot;</code> and <code>/cities</code> is empty —
            the watchers did not run on mount. Change the country so they do.
          </>
        ),
        hint: 'The effect stores the watched values and returns when there is no previous snapshot to compare against.',
        steps: [
          <>
            Click the <strong>state</strong> tab and read the seed: <code>&quot;country&quot;: &quot;fi&quot;</code>{' '}
            and <code>&quot;cities&quot;: []</code>. Had the watcher run on mount, <code>cities</code> would be full.
          </>,
          <>
            Check the grey bar above the playground: <strong>watcher fired on mount:</strong> <code>no</code>.
          </>,
          <>
            Open the <strong>Country</strong> select and choose <strong>Sweden</strong>.
          </>,
          <>
            The <strong>City</strong> select now offers Stockholm and Malmö, and a{' '}
            <strong>loadCities resolved</strong> alert has appeared.
          </>,
          <>
            Read the <strong>dispatch timeline</strong>: four new rows. One state change, three elements reacting,
            and the pill above still reads <code>no</code>.
          </>,
        ],
        check: () => !counts.firedOnMount && n(counts, 'loadCities') >= 1,
      },
      {
        id: 'watch-cascade',
        goal: (
          <>
            Pick a city, then change the country again. <code>/form/city</code> is wiped — by an element watching{' '}
            <code>/cities</code>, not by the one you touched.
          </>
        ),
        hint: 'Each element owns the path it depends on. country → /cities, then /cities → the reset and the load.',
        steps: [
          <>
            Open the <strong>City</strong> select and pick a city.
          </>,
          <>
            Now change <strong>Country</strong> back to <strong>Finland</strong>.
          </>,
          <>
            The <strong>City</strong> select is empty again — the <code>city</code> element&rsquo;s own watcher
            wrote <code>&quot;&quot;</code> over your choice when the list changed under it.
          </>,
          <>
            Click the <strong>log</strong> tab and read it <em>bottom-up</em>: <code>/cities</code>, then{' '}
            <code>/form/city</code>, then <code>/form/cityHint</code> — three elements, one after another, each
            reacting to the write before it.
          </>,
          <>
            Open the <strong>tree</strong> tab and click each of <code>country</code>, <code>city</code> and{' '}
            <code>cityHint</code>: all three carry a <code>watch</code> field.
          </>,
        ],
        check: ({ written }) => written.filter((p) => p === '/form/city').length >= 2,
      },
      {
        id: 'watch-array-cut',
        goal: (
          <>
            Now break it on purpose: put all three bindings in <strong>one array on one element</strong>, the way
            everybody writes it first. The third one stops firing.
          </>
        ),
        hint: 'Press "solution" to load it. The first binding that really changes state tears down its own effect, and everything queued behind it is dropped.',
        steps: [
          <>
            Press <strong>solution</strong> below, then <strong>apply</strong>. The three bindings move onto{' '}
            <code>country</code> as an array and the other two <code>watch</code> fields are gone.
          </>,
          <>
            Clear the <strong>dispatch timeline</strong>, then change <strong>Country</strong>.
          </>,
          <>
            Count the rows: <strong>two</strong>, not three. <code>setState</code> for <code>/form/city</code>,{' '}
            <code>setState</code> for <code>/cities</code> — and then nothing. <code>loadCities</code> never ran,
            so no <strong>loadCities resolved</strong> alert appears.
          </>,
          <>
            Change the country again and again. It is not a race you can win: the second binding writes state, that
            write rebuilds the context the effect depends on, React tears the effect down, and the{' '}
            <code>cancelled</code> flag stops the loop at the next <code>await</code>. Same result with latency off.
          </>,
          <>
            Nothing reports this. <code>validateSpec</code> is clean, no warning is logged, and the spec reads
            correctly. Only the timeline shows it.
          </>,
        ],
        solution: {
          spec: WATCH_ARRAY_SPEC,
          note: 'The shape to avoid. A watch array runs reliably only up to and including its first state-changing binding — so keep one binding per entry and chain them through the paths.',
        },
        check: ({ spec }) =>
          Boolean(
            deepFind(
              spec?.elements ?? {},
              (node) =>
                'watch' in node &&
                Boolean(node.watch) &&
                Object.values(node.watch as Record<string, unknown>).some((b) => Array.isArray(b) && b.length > 2),
            ),
          ),
      },
    ],
  },
  {
    id: 'loop',
    label: 'loops',
    group: 'watchers',
    title: 'Watcher loops, and the one thing that stops them',
    blurb: (
      <>
        <code>/a</code> writes <code>/b</code>; <code>/b</code> writes <code>/a</code>. Nothing in the library
        detects the cycle — the only brake is the store, which ignores a write of a value that is already there.
      </>
    ),
    shapeTitle: 'one converges, one does not',
    shape: `// converges: the 3rd write is a no-op, the store never notifies
"watch": { "/a": { "action": "setState", "params": { "statePath": "/b", "value": "B" } } }
"watch": { "/b": { "action": "setState", "params": { "statePath": "/a", "value": "A" } } }

// NEVER converges: every hop produces a new string
"watch": { "/a": { "action": "setState",
  "params": { "statePath": "/b", "value": { "$template": "B\${/a}" } } } }
"watch": { "/b": { "action": "setState",
  "params": { "statePath": "/a", "value": { "$template": "A\${/b}" } } } }`,
    spec: LOOP_SPEC,
    seed: LOOP_SEED,
    tasks: (counts) => [
      {
        id: 'loop-first',
        goal: (
          <>
            Type <strong>one</strong> character into <code>/a</code> and count the dispatches: three, then silence.
          </>
        ),
        hint: 'a → /b = "B"; b → /a = "A"; a → /b = "B" again, which the store refuses.',
        steps: [
          <>
            Type a single character into the <code>/a</code> field.
          </>,
          <>
            Both badges update: <code>/a = A</code> and <code>/b = B</code>. Your character is gone — the second
            watcher overwrote it.
          </>,
          <>
            Read the <strong>dispatch timeline</strong>: exactly three <code>setState</code> rows.
          </>,
          <>
            The fourth hop would write <code>/b = &quot;B&quot;</code>, which is already there, so{' '}
            <code>set</code> returns early, nothing notifies, nothing re-renders.
          </>,
        ],
        check: () => n(counts, 'setState') >= 3,
      },
      {
        id: 'loop-second',
        goal: (
          <>
            Type another character. This time only <strong>one</strong> dispatch — the brake is the value, not the
            session.
          </>
        ),
        hint: '/b already holds "B", so the very first hop is the no-op.',
        steps: [
          <>
            Type one more character into <code>/a</code> (it now reads <code>A</code> plus whatever you type).
          </>,
          <>
            Read the timeline: a single new <code>setState</code> row, not three.
          </>,
          <>
            That is <code>/a</code>&rsquo;s watcher writing <code>/b = &quot;B&quot;</code> onto a <code>/b</code>{' '}
            that is already <code>&quot;B&quot;</code>. The chain ends there.
          </>,
        ],
        check: () => n(counts, 'setState') >= 4,
      },
    ],
  },
];

/* ------------------------------------------------------------ the lab ----- */

interface TimelineRow {
  id: string;
  name: string;
  at: number;
  ok?: boolean;
  durationMs?: number;
  error?: string;
}

/**
 * The host side of actions, for the `your app code` pane.
 *
 * `handlers` is the whole API: a plain map of name → async function, passed as
 * one prop. The pane opens with the provider call, so these sit directly under
 * the `handlers={…}` line that consumes them.
 */
const ACTION_WIRING: WiringBlock[] = [
  {
    label: 'lib/demo/catalog.ts · where an action comes from',
    code: DEMO_ACTION_DECL,
    lang: 'typescript',
    note: (
      <>
        Before anything can dispatch <code>notify</code>, the catalog has to say it exists. This is the whole
        declaration: a description and a Zod schema for its params, per action. Both feed{' '}
        <code>catalog.prompt()</code>, which is how a model learns the name — nothing else tells it.
      </>
    ),
  },
  {
    label: 'lib/demo/registry.tsx · defineRegistry demands an implementation',
    code: DEMO_REGISTRY_ACTIONS,
    lang: 'tsx',
    note: (
      <>
        Because the catalog declares actions, TypeScript <em>requires</em> the <code>actions</code> key here — a
        catalog with <code>actions: {'{}'}</code> may omit it. <code>defineRegistry</code> also returns a{' '}
        <code>handlers</code> factory built from these, which is the normal way to feed the provider. This
        playground passes its own <code>handlers</code> instead, so it can log every dispatch.
      </>
    ),
  },
  {
    label: 'lib/demo/action-handlers.ts',
    code: Object.values(HANDLER_ENTRIES).join('\n\n'),
    lang: 'typescript',
    note: (
      <>
        The four custom actions this lab dispatches. A handler is{' '}
        <code className="font-mono">(params) =&gt; Promise&lt;unknown&gt;</code> and nothing more — no state, no
        store, no renderer. Resolving or throwing is the entire signal, which is why <code>onSuccess</code> and{' '}
        <code>onError</code> exist.
      </>
    ),
  },
  {
    label: '@json-render/react · ActionProvider.execute',
    block: 'execute.lookup',
    internal: true,
    note: (
      <>
        What reads that map. An action name with no entry is a <code>console.warn</code> and a return, never a
        throw — which is why a misspelt action fails silently.
      </>
    ),
  },
  {
    label: '@json-render/react · ActionProvider built-ins',
    block: 'builtin.pushState',
    internal: true,
    note: (
      <>
        And what never reaches it. <code>setState</code>, <code>pushState</code>, <code>removeState</code> and{' '}
        <code>validateForm</code> each <code>return</code> before the lookup, so no handler of yours can see or
        audit them.
      </>
    ),
  },
  {
    label: '@json-render/core · executeAction',
    block: 'executeAction',
    internal: true,
    note: (
      <>
        Where <code>onSuccess</code> and <code>onError</code> are defined. Note the <code>else</code> on the catch:
        with an <code>onError</code> present the rejection is swallowed, so the timeline reports <code>ok</code>{' '}
        for an action that threw.
      </>
    ),
  },
  {
    label: '@json-render/react · ConfirmationDialogManager',
    block: 'ConfirmationDialogManager',
    internal: true,
    note: (
      <>
        Where a <code>confirm</code> block becomes a dialog. <code>JSONUIProvider</code> mounts this as a sibling
        of your children and it renders <code>ConfirmDialog</code> — hardcoded, not a prop.
      </>
    ),
  },
];

/** The three failures lib/demo/action-handlers.ts throws on demand. */
const DEMO_ERRORS = /backend refused|validation rejected the draft|city service unavailable/i;

for (const lesson of LESSONS) {
  for (const task of lesson.tasks(ZERO)) LESSON_OF[task.id] = lesson.id;
}

export function ActionLab() {
  const [lessonId, setLessonId] = useState(LESSONS[0].id);
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [counts, setCounts] = useState<Counts>(ZERO);
  const [shouldFail, setShouldFail] = useState(false);
  const [slow, setSlow] = useState(true);
  // The handlers live in lib/demo/action-handlers.ts so the lab can SHOW them.
  // These two switches reach them through that module's env object, the same
  // way refs used to — a handler still takes params and nothing else.
  handlerEnv.failing = shouldFail;
  handlerEnv.slow = slow;
  /**
   * Is the lesson still mounting?
   *
   * This used to be `Date.now() - mountedAt < 1500`, and that guess only ever
   * worked because the watch card was buried under three others — you could
   * not reach it inside the window. Behind a tab it is one click away: change
   * the country quickly and the pill flipped to "yes", which also made the
   * task's `!firedOnMount` check impossible to satisfy for the rest of the
   * lesson. It read exactly like watch being broken.
   *
   * A mount-time watcher dispatch would be issued inside the mount effect
   * flush, synchronously, before the browser can deliver any user event — so
   * closing the window on the next macrotask is exact rather than a guess, and
   * it can never produce a false "yes".
   */
  const mounting = useRef(true);

  const index = Math.max(0, LESSONS.findIndex((l) => l.id === lessonId));
  const lesson = LESSONS[index];
  const controls = lesson.controls ?? [];

  /** A lesson is a fresh start: new spec, empty timeline, zeroed counters. */
  const goto = useCallback((id: string) => {
    // Re-open the window HERE, not in the effect below: SpecPlayground remounts
    // on the render this schedules, and child effects flush before the parent's,
    // so by the time that effect runs the new lesson's watchers have already had
    // their chance to fire.
    mounting.current = true;
    setLessonId(id);
    setRows([]);
    setCounts(ZERO);
    setShouldFail(false);
  }, []);

  // Closes the window one macrotask after the lesson's effects have flushed.
  useEffect(() => {
    const t = setTimeout(() => {
      mounting.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, [lessonId]);

  // The devtools hook. Global, returns an unsubscribe.
  useEffect(() => {
    return registerActionObserver({
      onDispatch: (e: ActionDispatchInfo) => {
        setRows((prev) => [{ id: e.id, name: e.name, at: e.at }, ...prev].slice(0, 40));
        setCounts((prev) => ({
          ...prev,
          n: { ...prev.n, [e.name]: (prev.n[e.name] ?? 0) + 1 },
          // Any dispatch inside the mount window is by definition not something
          // a person did — nothing else could have triggered it.
          firedOnMount: prev.firedOnMount || mounting.current,
        }));
      },
      onSettle: (e: ActionSettleInfo) =>
        setRows((prev) =>
          prev.map((r) =>
            r.id === e.id
              ? {
                  ...r,
                  ok: e.ok,
                  durationMs: e.durationMs,
                  error: e.error ? String((e.error as Error).message ?? e.error) : undefined,
                }
              : r,
          ),
        ),
    });
  }, []);

  /**
   * Cancelling a confirm is the one dispatch outcome the observer cannot see.
   *
   * ActionProvider's confirm branch `return`s a promise that `reject`s with
   * `new Error("Action cancelled")`, and the renderer's `emit` awaits it with
   * nobody downstream to catch — so a cancel surfaces as an unhandled
   * rejection, not as a settle with ok:false. We listen for it (and swallow
   * it, so the dev overlay stays quiet) purely so the confirm lesson can tell
   * a cancel from a slow accept.
   */
  useEffect(() => {
    const onReject = (e: PromiseRejectionEvent) => {
      const message = String((e.reason as Error | undefined)?.message ?? e.reason ?? '');
      if (/action cancelled/i.test(message)) {
        e.preventDefault();
        setCounts((prev) => ({ ...prev, cancelled: prev.cancelled + 1 }));
        return;
      }
      // A handler that threw with no `onError` to catch it. Renderer.emit does
      // not catch, so this reaches window — in your own app it would hit the
      // dev overlay and then your error reporter. We swallow the ones this lab
      // throws on purpose and count them instead.
      if (!DEMO_ERRORS.test(message)) return;
      e.preventDefault();
      setCounts((prev) => ({ ...prev, unhandled: prev.unhandled + 1 }));
    };
    window.addEventListener('unhandledrejection', onReject);
    return () => window.removeEventListener('unhandledrejection', onReject);
  }, []);



  /**
   * Every task in every lesson, as one run of stages. A stage carries its own
   * lesson's spec and seed, so arriving at it loads that lesson's whole setup
   * and the lab scopes its controls and shape to the same lesson.
   */
  const stages: Stage[] = useMemo(
    () =>
      LESSONS.flatMap((l) => {
        const ts = l.tasks(counts);
        return stagesFromTasks(
          ts,
          (LESSON_STAGES[l.id] ?? []).map((m) => ({ ...m, spec: l.spec, seed: l.seed })),
        );
      }),
    [counts],
  );

  /* The lab's own chrome belongs INSIDE the playground column. Rendered as
   * siblings these sat above and below the stage rail too, pushing the rail
   * down and giving this page a shape no other lab has. */
  const toolbar = (
    <>
      {controls.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-lg border bg-surface px-3 py-2">
          {controls.includes('fail') && (
            <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                className="size-3.5 accent-red-500"
                checked={shouldFail}
                onChange={(e) => setShouldFail(e.target.checked)}
              />
              make handlers fail
            </label>
          )}
          {controls.includes('slow') && (
            <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                className="size-3.5 accent-orange-500"
                checked={slow}
                onChange={(e) => setSlow(e.target.checked)}
              />
              simulate latency
            </label>
          )}
          {controls.includes('escaped') && (
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              escaped to window:
              <Pill tone={counts.unhandled > 0 ? 'bad' : 'idle'}>{counts.unhandled}</Pill>
            </span>
          )}
          {controls.includes('mount') && (
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              watcher fired on mount:
              <Pill tone={counts.firedOnMount ? 'bad' : 'ok'}>{counts.firedOnMount ? 'yes' : 'no'}</Pill>
            </span>
          )}
        </div>
      )}

      {/* Remount on every lesson: a new spec, a clean state model, fresh tasks. */}
    </>
  );

  const below = (
      <Panel
        title="dispatch timeline · registerActionObserver"
        right={
          <button
            type="button"
            onClick={() => setRows([])}
            className="rounded border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
          >
            clear
          </button>
        }
      >
        <div className="max-h-[220px] overflow-auto p-2 font-mono text-[12px]">
          {rows.length === 0 ? (
            <div className="p-2 text-muted-foreground">
              Press something, or change a watched value. Every dispatch appears here with its outcome and duration
              — including built-in actions, which never reach your handlers map.
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="animate-in-soft flex items-center gap-2.5 rounded px-2 py-1 hover:bg-muted">
                <span
                  className={`w-12 shrink-0 rounded px-1 py-px text-center text-[10px] font-bold ${
                    r.ok === undefined
                      ? 'bg-surface-hover text-muted-foreground'
                      : r.ok
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
                  }`}
                >
                  {r.ok === undefined ? 'pending' : r.ok ? 'ok' : 'threw'}
                </span>
                <span className="w-24 shrink-0 truncate text-foreground">{r.name}</span>
                <span className="w-14 shrink-0 tabular-nums text-muted-foreground">
                  {r.durationMs !== undefined ? `${Math.round(r.durationMs)}ms` : '—'}
                </span>
                <span className="min-w-0 truncate text-red-600 dark:text-red-400">{r.error ?? ''}</span>
              </div>
            ))
          )}
        </div>
      </Panel>
  );

  return (
      <SpecPlayground
        spec={LESSONS[0].spec}
        seedState={LESSONS[0].seed}
        handlers={demoHandlers}
        extraActions={['deleteAll', 'save', 'loadCities']}
        // The playground opens on panes[0] of THIS list, not of the stage it
        // lands on, so the first entry has to be a pane stage one actually
        // shows — otherwise arriving at the lab highlights no tab at all.
        panes={['spec', 'tree', 'state', 'log', 'wiring', 'catalog', 'impl']}
        wiring={ACTION_WIRING}
        height={520}
        stages={stages}
        labSlug="actions"
        onStageChange={(stage) => goto(LESSON_OF[stage.id] ?? LESSONS[0].id)}
      toolbar={toolbar}
      below={below}
    />
  );
}