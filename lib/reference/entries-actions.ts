import type { ReferenceEntry } from './types';

/**
 * Action bindings and the built-in actions. Verified against the
 * `ActionProvider` implementation in
 * node_modules/@json-render/react/dist/index.mjs (lines 429-620) and the
 * built-in action list in dist/chunk-SDI5YI5X.mjs.
 */
export const ACTION_ENTRIES: ReferenceEntry[] = [
  {
    id: 'act-binding',
    category: 'Actions',
    name: 'ActionBinding',
    signature: `interface ActionBinding {
  action: string;
  params?: Record<string, DynamicValue>;
  confirm?: ActionConfirm;
  onSuccess?: ActionOnSuccess;
  onError?: ActionOnError;
  preventDefault?: boolean;
}`,
    lang: 'typescript',
    summary: 'The object an event or a watcher maps to. Everything a spec can say about "do something" lives here.',
    details: [
      'Resolution order: `resolveAction(binding, state)` resolves params, then the provider dispatches.',
      'The six built-ins (`setState`, `pushState`, `removeState`, `push`, `pop`, `validateForm`) are intercepted before handler lookup and RETURN EARLY.',
      'Only a custom handler goes through `executeAction`, which is what runs `confirm`, `onSuccess` and `onError`.',
      'An unknown action name logs `No handler registered for action: <name>` and resolves without doing anything.',
      'Every dispatch is announced to `registerActionObserver` observers, built-in or not, with a matching settle event.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['row', 'out'] },
          row: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
            children: ['ok', 'ghost'],
          },
          ok: {
            type: 'Button',
            props: { label: 'built-in: setState', variant: 'primary' },
            children: [],
            on: { press: { action: 'setState', params: { statePath: '/log', value: 'setState ran' } } },
          },
          ghost: {
            type: 'Button',
            props: { label: 'unregistered action', variant: 'secondary' },
            children: [],
            on: { press: { action: 'thisDoesNotExist', params: { statePath: '/log', value: 'never' } } },
          },
          out: { type: 'Text', props: { value: { $template: '/log = ${/log}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { log: '(nothing yet)' },
      note: 'The second button dispatches an action nobody registered. Watch the browser console: one warning, no state change, no error.',
    },
    related: ['act-params', 'act-setstate', 'el-on', 'util-registeractionobserver'],
    step: 'actions',
    tags: ['action', 'binding', 'dispatch'],
  },
  {
    id: 'act-params',
    category: 'Actions',
    name: 'binding.params',
    signature: `{ "action": "notify", "params": { "message": { "$state": "/draft" }, "level": "info" } }`,
    summary: 'Values passed to the handler. Each value may be a literal or { "$state": "/path" }.',
    details: [
      '`resolveAction` walks params with `resolveDynamicValue`, which understands `{ "$state": … }` and nothing else.',
      'Inside a repeat, the RENDERER resolves params with `resolveActionParam` instead: there `{ "$item": "id" }` becomes the absolute state PATH (`/todos/0/id`), and `{ "$index": true }` becomes the number.',
      'That asymmetry is deliberate — action params usually want a path to write to, props want a value to show.',
      'Params are not validated against the catalog at runtime. `catalog.validate(spec)` checks the spec shape, not the params of each binding.',
      'The Zod schema for params allows string, number, boolean, null and `{ $state }` — nested objects are not part of the declared grammar.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['in', 'go', 'out'] },
          in: { type: 'TextInput', props: { label: 'draft', value: { $bindState: '/draft' }, placeholder: 'type something', help: null, required: null, checks: null }, children: [] },
          go: {
            type: 'Button',
            props: { label: 'copy draft → /saved', variant: 'primary' },
            children: [],
            on: { press: { action: 'setState', params: { statePath: '/saved', value: { $state: '/draft' } } } },
          },
          out: { type: 'Text', props: { value: { $template: 'saved: ${/saved}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { draft: '', saved: '' },
    },
    related: ['act-binding', 'expr-item', 'act-setstate'],
    step: 'actions',
    tags: ['params', '$state'],
  },
  {
    id: 'act-confirm',
    category: 'Actions',
    name: 'binding.confirm',
    signature: `{
  "action": "deleteInvoice",
  "confirm": { "title": "Delete?", "message": "This cannot be undone.",
               "confirmLabel": "Delete", "cancelLabel": "Keep", "variant": "danger" }
}`,
    summary: 'Show a confirmation dialog before running the handler. Only works for CUSTOM actions.',
    details: [
      'The provider stores a `pendingConfirmation` and returns a promise; `confirm()` resolves it, `cancel()` rejects with `Error("Action cancelled")`.',
      'The built-in actions return BEFORE this check, so `confirm` on `setState`, `pushState`, `removeState`, `push`, `pop` or `validateForm` is silently ignored.',
      '`ConfirmDialog` is exported and rendered by `JSONUIProvider`; `variant: "danger"` is the only styling hook.',
      'The rejection is an unhandled promise rejection unless your caller catches it — `useAction().execute()` returns that promise.',
    ],
    failure: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['b', 'out'] },
          b: {
            type: 'Button',
            props: { label: 'Delete everything (confirm: ignored)', variant: 'danger' },
            children: [],
            on: {
              press: {
                action: 'setState',
                params: { statePath: '/data', value: 'GONE' },
                confirm: { title: 'Are you sure?', message: 'This should stop you. It will not.', variant: 'danger' },
              },
            },
          },
          out: { type: 'Text', props: { value: { $template: '/data = ${/data}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { data: 'important' },
      note: 'Press it. No dialog appears and the value is destroyed immediately, because setState is intercepted before the confirm branch. Guard destructive built-ins by wrapping them in your own action instead.',
    },
    related: ['act-binding', 'act-onsuccess', 'act-setstate', 'prov-actionprovider'],
    step: 'actions',
    tags: ['confirm', 'dialog', 'gotcha'],
  },
  {
    id: 'act-onsuccess',
    category: 'Actions',
    name: 'binding.onSuccess',
    signature: `{ "onSuccess": { "navigate": "/invoices" } }
{ "onSuccess": { "set": { "/toast": "Saved" } } }
{ "onSuccess": { "action": "refresh", "params": { … } } }`,
    summary: 'What to do after a custom handler resolves. One of three shapes: navigate, set, or another action.',
    details: [
      '`navigate` calls the `navigate` prop you passed to `JSONUIProvider` / `ActionProvider`. Without that prop, nothing happens.',
      '`set` is a map of JSON Pointer → literal value, written through the store.',
      '`action` chains a second binding, executed through the same provider, so it can have its own onSuccess.',
      'Runs inside `executeAction`, which built-in actions never reach — `onSuccess` on setState is dead code.',
    ],
    related: ['act-onerror', 'act-confirm', 'act-binding'],
    step: 'actions',
    tags: ['onSuccess', 'navigate', 'chain'],
  },
  {
    id: 'act-onerror',
    category: 'Actions',
    name: 'binding.onError',
    signature: `{ "onError": { "set": { "/error": "Could not save" } } }
{ "onError": { "action": "reportFailure" } }`,
    summary: 'What to do when a custom handler throws or rejects. Two shapes: set, or another action.',
    details: [
      'There is no `navigate` variant for errors — the union is `{ set }` or `{ action, params? }`.',
      'A handler that swallows its own error never triggers this. The handler must throw or return a rejected promise.',
      'Like onSuccess it lives inside `executeAction`, so it never runs for a built-in action.',
      'Nothing writes the error message into state for you; the `set` map holds literals you wrote in the spec.',
    ],
    related: ['act-onsuccess', 'act-binding', 'prov-actionprovider'],
    step: 'actions',
    tags: ['onError', 'failure'],
  },
  {
    id: 'act-preventdefault',
    category: 'Actions',
    name: 'binding.preventDefault',
    signature: `{ "action": "submit", "preventDefault": true }`,
    summary: 'A flag your component reads. The library never calls preventDefault for you.',
    details: [
      'The renderer exposes it through `on(event).shouldPreventDefault`, true if ANY binding for that event set it.',
      'Your component does the work: `const press = on("press"); if (press.shouldPreventDefault) e.preventDefault(); press.emit();`',
      'A component that uses the shorthand `emit(event)` never sees the flag — `emit` just fires.',
      'Typical use: a link or a form submit button that must not navigate or reload.',
    ],
    related: ['ctx-on', 'ctx-emit', 'el-on'],
    step: 'actions',
    tags: ['preventDefault', 'events'],
  },
  {
    id: 'act-array',
    category: 'Actions',
    name: 'multiple bindings per event',
    signature: `{ "on": { "press": [
  { "action": "setState",  "params": { "statePath": "/busy", "value": true } },
  { "action": "submit" }
] } }`,
    summary: 'An event may map to an array of bindings. They run in order.',
    details: [
      'The renderer normalises to an array: `Array.isArray(binding) ? binding : [binding]`.',
      'For `on`, the bindings are dispatched together when the event fires.',
      'For `watch`, they are awaited in sequence — but the sequence is cut short. The first binding that changes state tears down the effect running the loop, so every binding after it is dropped, silently. Use one binding per `watch` entry.',
      'There is no early exit: a failing binding does not stop the ones after it in an `on` array.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['b', 'out'] },
          b: {
            type: 'Button',
            props: { label: 'two writes, one press', variant: 'primary' },
            children: [],
            on: {
              press: [
                { action: 'setState', params: { statePath: '/first', value: 'A' } },
                { action: 'setState', params: { statePath: '/second', value: 'B' } },
              ],
            },
          },
          out: { type: 'Text', props: { value: { $template: 'first=${/first} second=${/second}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { first: '-', second: '-' },
    },
    related: ['el-on', 'el-watch', 'act-binding'],
    step: 'actions',
    tags: ['array', 'events'],
  },
  {
    id: 'act-setstate',
    category: 'Actions',
    name: 'setState (built-in)',
    signature: `{ "action": "setState", "params": { "statePath": "/tab", "value": "billing" } }`,
    summary: 'Write one value into the state model. No handler required.',
    details: [
      'Params: `statePath` (JSON Pointer) and `value`. A falsy `statePath` makes it a no-op.',
      '`value` is resolved by `resolveAction` beforehand, so `{ "$state": "/other" }` copies a value across.',
      'Missing intermediate objects are created; a numeric segment creates an array.',
      'The store compares by reference — writing the same primitive twice notifies subscribers once.',
      'Intercepted before handler lookup, so `confirm`, `onSuccess` and `onError` are ignored.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['row', 'out'] },
          row: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
            children: ['a', 'b', 'deep'],
          },
          a: { type: 'Button', props: { label: 'tab = home', variant: 'secondary' }, children: [], on: { press: { action: 'setState', params: { statePath: '/tab', value: 'home' } } } },
          b: { type: 'Button', props: { label: 'tab = billing', variant: 'secondary' }, children: [], on: { press: { action: 'setState', params: { statePath: '/tab', value: 'billing' } } } },
          deep: { type: 'Button', props: { label: 'create /a/b/c', variant: 'ghost' }, children: [], on: { press: { action: 'setState', params: { statePath: '/a/b/c', value: 'made from nothing' } } } },
          out: { type: 'Text', props: { value: { $template: 'tab=${/tab} · deep=${/a/b/c}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { tab: 'home' },
    },
    related: ['act-pushstate', 'act-removestate', 'act-confirm', 'el-on'],
    step: 'actions',
    tags: ['setState', 'built-in', 'state'],
  },
  {
    id: 'act-pushstate',
    category: 'Actions',
    name: 'pushState (built-in)',
    signature: `{ "action": "pushState", "params": {
  "statePath": "/todos",
  "value": { "id": "$id", "title": { "$state": "/draft" }, "done": false },
  "clearStatePath": "/draft"
} }`,
    summary: 'Append an item to an array in state, with a sentinel for generated ids and an optional field reset.',
    details: [
      'The value is walked by `deepResolveValue`: the STRING `"$id"` and the object `{ "$id": … }` both become a generated id.',
      'The generated id is `` `${Date.now()}-${counter}` `` — unique within the page session, not a UUID, and not stable across reloads.',
      'A single-key object `{ "$state": "/path" }` inside the value resolves to that value; nested objects and arrays are walked recursively.',
      'A missing array is treated as `[]`, so the first push creates it.',
      '`clearStatePath` is written with the EMPTY STRING, not null — handy for clearing a text input, wrong for a number or a boolean.',
      'Built-in: confirm / onSuccess / onError are ignored.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['in', 'add', 'list'] },
          in: { type: 'TextInput', props: { label: 'New todo', value: { $bindState: '/draft' }, placeholder: 'e.g. File VAT', help: null, required: null, checks: null }, children: [] },
          add: {
            type: 'Button',
            props: { label: 'Add', variant: 'primary' },
            children: [],
            on: {
              press: {
                action: 'pushState',
                params: { statePath: '/todos', value: { id: '$id', title: { $state: '/draft' } }, clearStatePath: '/draft' },
              },
            },
          },
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['row'],
            repeat: { statePath: '/todos', key: 'id' },
          },
          row: { type: 'Badge', props: { label: { $item: 'title' }, tone: 'neutral' }, children: [] },
        },
      },
      seed: { draft: '', todos: [] },
      note: 'Type, press Add. The input clears because clearStatePath wrote "" back to /draft, and the new row gets a generated id.',
    },
    related: ['act-removestate', 'act-setstate', 'el-repeat'],
    step: 'actions',
    tags: ['pushState', 'built-in', '$id', 'array'],
  },
  {
    id: 'act-removestate',
    category: 'Actions',
    name: 'removeState (built-in)',
    signature: `{ "action": "removeState", "params": { "statePath": "/todos", "index": { "$index": true } } }`,
    summary: 'Remove one item from an array in state, by index.',
    details: [
      'Implemented as `arr.filter((_, i) => i !== index)`, so the array is replaced with a new reference.',
      'Both `statePath` and `index` must be defined, otherwise nothing happens.',
      'Inside a repeat, `{ "$index": true }` in params resolves to the current row index — this is the idiomatic delete button.',
      'There is no remove-by-id. Either keep indices or write your own handler.',
      'Built-in: confirm / onSuccess / onError are ignored, so a "delete" button cannot use the spec-level confirm dialog.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['list'] },
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['row'],
            repeat: { statePath: '/todos', key: 'id' },
          },
          row: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
            children: ['label', 'del'],
          },
          label: { type: 'Text', props: { value: { $item: 'title' }, tone: null, size: null }, children: [] },
          del: {
            type: 'Button',
            props: { label: 'remove', variant: 'ghost' },
            children: [],
            on: { press: { action: 'removeState', params: { statePath: '/todos', index: { $index: true } } } },
          },
        },
      },
      seed: { todos: [{ id: 'a', title: 'File VAT' }, { id: 'b', title: 'Reconcile bank' }, { id: 'c', title: 'Chase invoice' }] },
    },
    related: ['act-pushstate', 'expr-index', 'el-repeat'],
    step: 'actions',
    tags: ['removeState', 'built-in', 'array'],
  },
  {
    id: 'act-validateform',
    category: 'Actions',
    name: 'validateForm (built-in)',
    signature: `{ "action": "validateForm", "params": { "statePath": "/formValidation" } }`,
    summary: 'Run every registered field validation and write the result into state.',
    details: [
      'Calls `validateAll()` on the ValidationProvider, which iterates the fields REGISTERED via `useFieldValidation`.',
      'A control that never calls `useFieldValidation` is invisible to it. There is no scan of the spec.',
      '`statePath` defaults to `/formValidation`.',
      'The written shape is `{ valid: boolean, errors: Record<string, string[]> }`, keyed by the field path each control registered.',
      'With no ValidationProvider in the tree it logs a warning and returns — the action appears to succeed.',
      'Built-in: confirm / onSuccess / onError are ignored, so "validate then submit" needs two bindings in an array.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['email', 'go', 'out'] },
          email: {
            type: 'TextInput',
            props: {
              label: 'Email',
              value: { $bindState: '/form/email' },
              placeholder: 'you@co.com',
              help: null,
              required: true,
              checks: [
                { type: 'required', args: null, message: 'Email is required' },
                { type: 'email', args: null, message: 'That is not an email address' },
              ],
            },
            children: [],
          },
          go: {
            type: 'Button',
            props: { label: 'Validate', variant: 'primary' },
            children: [],
            on: { press: { action: 'validateForm', params: { statePath: '/result' } } },
          },
          out: { type: 'Text', props: { value: { $template: 'result: ${/result}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { form: { email: '' }, result: '(not run)' },
      note: 'Press Validate with the field empty. The result object is written to /result — and String() flattens it to [object Object], which is exactly what the state pane under this example is for.',
    },
    related: ['val-result', 'hook-usefieldvalidation', 'prov-validationprovider', 'val-required'],
    step: 'validation',
    tags: ['validateForm', 'built-in', 'validation'],
  },
  {
    id: 'act-pushpop',
    category: 'Actions',
    name: 'push / pop (built-in, undocumented)',
    signature: `{ "action": "push", "params": { "screen": "detail" } }
{ "action": "pop" }`,
    summary: 'A two-action navigation stack the runtime implements but the prompt never mentions.',
    details: [
      'Verified in `ActionProvider` (node_modules/@json-render/react/dist/index.mjs): `push` and `pop` are handled beside setState and friends.',
      '`push` reads `/currentScreen`, appends it to `/navStack` (or appends `""` when it is empty), then sets `/currentScreen` to `params.screen`.',
      '`pop` takes the last entry off `/navStack` and restores it to `/currentScreen`; an empty entry sets `/currentScreen` to undefined.',
      'Both paths are HARD-CODED: `/navStack` and `/currentScreen`. You cannot rename them.',
      'They are NOT in the schema\'s `builtInActions` list, so `catalog.prompt()` never tells the model they exist. Treat them as an internal convention, not an API.',
      'Nothing renders a screen for you — you still switch on `/currentScreen` with `visible`.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['nav', 'home', 'detail', 'dump'] },
          nav: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
            children: ['go', 'back'],
          },
          go: { type: 'Button', props: { label: 'push "detail"', variant: 'primary' }, children: [], on: { press: { action: 'push', params: { screen: 'detail' } } } },
          back: { type: 'Button', props: { label: 'pop', variant: 'ghost' }, children: [], on: { press: { action: 'pop' } } },
          home: { type: 'Alert', props: { title: 'Home screen', message: null, tone: 'info' }, children: [], visible: { $state: '/currentScreen', eq: 'home' } },
          detail: { type: 'Alert', props: { title: 'Detail screen', message: null, tone: 'success' }, children: [], visible: { $state: '/currentScreen', eq: 'detail' } },
          dump: { type: 'Text', props: { value: { $template: 'currentScreen=${/currentScreen}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { currentScreen: 'home', navStack: [] },
      note: 'Push, then pop, and watch /navStack in the state pane. Neither action is in any prompt the library generates.',
    },
    related: ['act-setstate', 'act-onsuccess', 'el-visible'],
    step: 'limitations',
    tags: ['push', 'pop', 'navigation', 'undocumented'],
  },
];
