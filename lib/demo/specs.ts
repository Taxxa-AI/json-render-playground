import type { Spec } from '@json-render/core';

/**
 * Every spec on this site is a plain JSON object. Nothing here is generated,
 * imported from a model, or produced by a build step — they are hand-written,
 * which is exactly the point of step 4.
 */

/** Step 1 — the shape. Children-by-key, a named slot, an unknown type to break. */
export const SHAPE_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: {
      type: 'Screen',
      props: { title: 'Q3 close', subtitle: 'Three items need attention' },
      children: ['card'],
    },
    card: {
      type: 'Card',
      props: { title: 'VAT return', subtitle: 'Period 2026-07 → 2026-09' },
      children: ['row', 'body'],
      slots: { footer: ['submit'] },
    },
    row: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
      children: ['badge', 'due'],
    },
    badge: { type: 'Badge', props: { label: 'Draft', tone: 'warning' }, children: [] },
    due: { type: 'Text', props: { value: 'Due 12 Nov', tone: null, size: 'sm' }, children: [] },
    body: {
      type: 'Text',
      props: {
        value: 'Reverse-charge entries were reclassified after the last sync. Review before filing.',
        tone: null,
        size: null,
      },
      children: [],
    },
    submit: { type: 'Button', props: { label: 'Review', variant: 'primary' }, children: [] },
  },
};

/** Step 3 — registry: children vs named slots, and the fallback. */
export const REGISTRY_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['card', 'ghost'] },
    card: {
      type: 'Card',
      props: { title: 'Default slot vs named slot', subtitle: null },
      // `children` IS the default slot. There is no slots.default.
      children: ['a', 'b'],
      // Named slots are a separate map, and the component receives them as `slots.footer`.
      slots: { footer: ['actions'] },
    },
    a: { type: 'Text', props: { value: 'These two paragraphs came through `children`.', tone: null, size: null }, children: [] },
    b: { type: 'Text', props: { value: 'The buttons below came through `slots.footer`.', tone: null, size: 'sm' }, children: [] },
    actions: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
      children: ['ok', 'cancel'],
    },
    ok: { type: 'Button', props: { label: 'Approve', variant: 'primary' }, children: [] },
    cancel: { type: 'Button', props: { label: 'Cancel', variant: 'ghost' }, children: [] },
    ghost: { type: 'Sparkline', props: {}, children: [] },
  },
};

/** Step 4 — a "fixed" spec: the sort of thing a compiler in your codebase emits. */
export const FIXED_SPEC: Spec = {
  root: 'form',
  elements: {
    form: { type: 'Screen', props: { title: 'Client onboarding', subtitle: 'Section 1 of 3' }, children: ['identity', 'tax'] },
    identity: {
      type: 'Card',
      props: { title: 'Identity', subtitle: null },
      children: ['name', 'email'],
    },
    name: {
      type: 'TextInput',
      props: { label: 'Legal name', value: { $bindState: '/client/name' }, placeholder: 'Acme Oy', help: null, required: true, checks: null },
      children: [],
    },
    email: {
      type: 'TextInput',
      props: { label: 'Billing email', value: { $bindState: '/client/email' }, placeholder: null, help: 'Invoices go here.', required: true, checks: null },
      children: [],
    },
    tax: {
      type: 'Card',
      props: { title: 'Tax', subtitle: null },
      children: ['country', 'vat'],
    },
    country: {
      type: 'Select',
      props: {
        label: 'Country of registration',
        value: { $bindState: '/client/country' },
        options: [
          { label: 'Finland', value: 'fi' },
          { label: 'Sweden', value: 'se' },
          { label: 'Norway', value: 'no' },
        ],
      },
      children: [],
    },
    vat: {
      type: 'TextInput',
      props: { label: 'VAT number', value: { $bindState: '/client/vat' }, placeholder: 'FI12345678', help: null, required: false, checks: null },
      children: [],
    },
  },
};

export const FIXED_SEED = { client: { name: '', email: '', country: 'fi', vat: '' } };

/** Step 5 — state and two-way binding. */
export const STATE_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['card', 'echo'] },
    card: {
      type: 'Card',
      props: { title: 'Bound inputs', subtitle: 'Every keystroke writes straight to the state model' },
      children: ['first', 'last', 'news'],
    },
    first: {
      type: 'TextInput',
      props: { label: 'First name', value: { $bindState: '/user/first' }, placeholder: 'Ada', help: null, required: null, checks: null },
      children: [],
    },
    last: {
      type: 'TextInput',
      props: { label: 'Last name', value: { $bindState: '/user/last' }, placeholder: 'Lovelace', help: null, required: null, checks: null },
      children: [],
    },
    news: { type: 'Checkbox', props: { label: 'Send me the monthly digest', checked: { $bindState: '/user/news' } }, children: [] },
    echo: {
      type: 'Alert',
      props: {
        title: 'Read back (one-way, via $state)',
        message: { $state: '/user/first' },
        tone: 'info',
      },
      children: [],
    },
  },
};

export const STATE_SEED = { user: { first: 'Ada', last: '', news: false } };


/** Step 7 — visibility, repeat, $item, $index, and a filtered repeat. */
export const REPEAT_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['toggle', 'gate', 'all', 'open'] },
    toggle: { type: 'Checkbox', props: { label: 'Show the secret panel', checked: { $bindState: '/showSecret' } }, children: [] },
    // `visible` is a top-level field — never inside props.
    gate: {
      type: 'Alert',
      props: { title: 'Conditionally rendered', message: 'This element has visible: { "$state": "/showSecret" }.', tone: 'success' },
      visible: { $state: '/showSecret' },
      children: [],
    },
    // A repeat container renders ONCE; its children are expanded per item.
    all: {
      type: 'Card',
      props: { title: 'All invoices (repeat)', subtitle: null },
      children: ['row'],
      repeat: { statePath: '/invoices', key: 'id' },
    },
    row: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
      children: ['idx', 'who', 'amt', 'st'],
    },
    // { "$index": true } resolves to the current zero-based repeat index.
    idx: { type: 'Text', props: { value: { $index: true }, tone: null, size: 'sm' }, children: [] },
    who: { type: 'Text', props: { value: { $item: 'client' }, tone: null, size: null }, children: [] },
    amt: { type: 'Text', props: { value: { $item: 'amount' }, tone: null, size: null }, children: [] },
    st: { type: 'Badge', props: { label: { $item: 'status' }, tone: null }, children: [] },
    // FILTERED repeat: `repeat` + an `$item` visibility condition on the SAME element.
    open: {
      type: 'Card',
      props: { title: 'Unpaid only (filtered repeat)', subtitle: null },
      children: ['orow'],
      repeat: { statePath: '/invoices', key: 'id' },
      visible: { $item: 'status', eq: 'unpaid' },
    },
    orow: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
      children: ['owho', 'oamt'],
    },
    owho: { type: 'Text', props: { value: { $item: 'client' }, tone: null, size: null }, children: [] },
    oamt: { type: 'Text', props: { value: { $item: 'amount' }, tone: 'danger', size: null }, children: [] },
  },
};

export const REPEAT_SEED = {
  showSecret: false,
  invoices: [
    { id: 'a', client: 'Acme Oy', amount: '€1,200', status: 'paid' },
    { id: 'b', client: 'Borealis AB', amount: '€3,480', status: 'unpaid' },
    { id: 'c', client: 'Cygnus AS', amount: '€760', status: 'unpaid' },
  ],
};

/** Step 8 — events, built-in state actions, custom actions, watchers. */
export const ACTIONS_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['tabs', 'panelA', 'panelB', 'todo'] },
    tabs: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
      children: ['tabA', 'tabB'],
    },
    tabA: {
      type: 'Button',
      props: { label: 'Overview', variant: 'secondary' },
      // `on` maps an event NAME (whatever the component emits) to an action.
      on: { press: { action: 'setState', params: { statePath: '/tab', value: 'a' } } },
      children: [],
    },
    tabB: {
      type: 'Button',
      props: { label: 'Settings', variant: 'secondary' },
      on: { press: { action: 'setState', params: { statePath: '/tab', value: 'b' } } },
      children: [],
    },
    panelA: {
      type: 'Alert',
      props: { title: 'Overview', message: 'setState wrote "a" to /tab.', tone: 'info' },
      // The $or keeps the first tab visible before /tab has ever been set.
      visible: { $or: [{ $state: '/tab', eq: 'a' }, { $state: '/tab', not: true }] },
      children: [],
    },
    panelB: {
      type: 'Alert',
      props: { title: 'Settings', message: 'setState wrote "b" to /tab.', tone: 'warning' },
      visible: { $state: '/tab', eq: 'b' },
      children: [],
    },
    todo: {
      type: 'Card',
      props: { title: 'pushState / removeState', subtitle: 'Array mutation without a single line of your code' },
      children: ['entry', 'add', 'list'],
      slots: { footer: ['custom'] },
    },
    entry: {
      type: 'TextInput',
      props: { label: 'New task', value: { $bindState: '/draft' }, placeholder: 'Reconcile bank feed', help: null, required: null, checks: null },
      children: [],
    },
    add: {
      type: 'Button',
      props: { label: 'Add', variant: 'primary' },
      on: {
        press: {
          action: 'pushState',
          params: {
            statePath: '/tasks',
            // "$id" is a sentinel the action expands into a fresh unique id.
            value: { id: '$id', title: { $state: '/draft' } },
            // Clears the input in the same dispatch.
            clearStatePath: '/draft',
          },
        },
      },
      children: [],
    },
    list: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: true },
      children: ['taskRow'],
      repeat: { statePath: '/tasks', key: 'id' },
    },
    taskRow: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
      children: ['taskTitle', 'del'],
    },
    taskTitle: { type: 'Badge', props: { label: { $item: 'title' }, tone: 'info' }, children: [] },
    del: {
      type: 'Button',
      props: { label: '×', variant: 'ghost' },
      // { "$index": true } resolves to the current repeat index.
      on: { press: { action: 'removeState', params: { statePath: '/tasks', index: { $index: true } } } },
      children: [],
    },
    custom: {
      type: 'Button',
      props: { label: 'Fire custom action', variant: 'secondary' },
      // Not a built-in. This one lands in YOUR handler — watch the log pane.
      on: { press: { action: 'notify', params: { message: 'Hello from the spec' } } },
      children: [],
    },
  },
};

export const ACTIONS_SEED = { tab: 'a', draft: '', tasks: [{ id: 't1', title: 'File VAT' }] };

/** Step 9 — validation, including a cross-field check. */
export const VALIDATION_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['card'] },
    card: {
      type: 'Card',
      props: { title: 'Sign up', subtitle: 'Blur a field to validate it; submit validates everything' },
      children: ['email', 'pw', 'pw2'],
      slots: { footer: ['submit'] },
    },
    email: {
      type: 'TextInput',
      props: {
        label: 'Email',
        value: { $bindState: '/form/email' },
        placeholder: 'you@company.com',
        help: null,
        required: true,
        checks: [
          { type: 'required', args: null, message: 'Email is required' },
          { type: 'email', args: null, message: 'That is not a valid email' },
        ],
      },
      children: [],
    },
    pw: {
      type: 'TextInput',
      props: {
        label: 'Password',
        value: { $bindState: '/form/password' },
        placeholder: null,
        help: 'At least 8 characters.',
        required: true,
        checks: [
          { type: 'required', args: null, message: 'Password is required' },
          { type: 'minLength', args: { min: 8 }, message: 'Use at least 8 characters' },
        ],
      },
      children: [],
    },
    pw2: {
      type: 'TextInput',
      props: {
        label: 'Confirm password',
        value: { $bindState: '/form/confirm' },
        placeholder: null,
        help: null,
        required: true,
        // A CROSS-FIELD check: `args.other` is a $state expression, resolved
        // against the live state model at validation time.
        checks: [{ type: 'matches', args: { other: { $state: '/form/password' } }, message: 'Passwords do not match' }],
      },
      children: [],
    },
    submit: {
      type: 'Button',
      props: { label: 'Create account', variant: 'primary' },
      // Two bindings on one event run in order.
      on: {
        press: [
          { action: 'validateForm', params: { statePath: '/result' } },
          { action: 'submit', params: {} },
        ],
      },
      children: [],
    },
  },
};

export const VALIDATION_SEED = { form: { email: '', password: '', confirm: '' } };

/** Step 12 — the "before" spec that gets refined. */
export const REFINE_BASE: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: 'Revenue', subtitle: 'FY2026' }, children: ['m1'] },
    m1: { type: 'Metric', props: { label: 'Total', value: '€48,200', delta: null, tone: null }, children: [] },
  },
};
