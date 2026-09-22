import type { Spec } from '@json-render/core';
import type { Quiz } from './types';

/**
 * Behaviour — actions, watchers, validation.
 *
 * Verified against @json-render/react 0.20.0 ActionProvider (dist/index.mjs
 * lines ~402–600: deepResolveValue, the setState/pushState/removeState/push/
 * pop/validateForm branches, and the confirm branch that sits AFTER them) and
 * @json-render/core `resolveAction`, `runValidation`, `check`
 * (scratchpad/verify-checkpoints.ts B1–B3, V1–V11).
 */
export const behaviourQuiz: Quiz = {
  group: 'Behaviour',
  slug: 'behaviour',
  intro: 'How a spec triggers code it cannot contain — and what validation will not do for you.',
  questions: [
    {
      kind: 'choice',
      id: 'b-emit',
      prompt: 'A Button component calls emit("press"). Where does the renderer look for what to run?',
      options: [
        'element.on.press — the on field on the element, not in props',
        'props.onPress on the same element',
        'The action named "press" in the catalog',
        'The handlers map on JSONUIProvider, keyed by "press"',
      ],
      answer: 0,
      explain:
        'Components emit event NAMES they chose; the element\'s on field maps a name to an action binding. Nothing is bound by default, so emit on an unbound event is a harmless no-op — which is why a generated button that "does nothing" is usually an on field that landed inside props.',
      step: 'actions',
      ref: 'el-on',
    },
    {
      kind: 'predict',
      id: 'b-builtins',
      prompt:
        'No handler named setState is registered anywhere. Reveal, then press the buttons — what happens?',
      // Verified: ActionProvider intercepts setState/pushState/removeState/push/
      // pop/validateForm before ever looking at `handlers`. Built-in action list
      // in the prompt is setState, pushState, removeState, validateForm
      // (react/dist/chunk-SDI5YI5X.mjs builtInActions).
      spec: {
        root: 'screen',
        elements: {
          screen: {
            type: 'Screen',
            props: { title: 'Tabs', subtitle: 'Nothing here has a handler.' },
            children: ['row', 'a', 'b'],
          },
          row: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: null, wrap: null },
            children: ['ba', 'bb'],
          },
          ba: {
            type: 'Button',
            props: { label: 'Overview', variant: 'secondary' },
            children: [],
            on: { press: { action: 'setState', params: { statePath: '/tab', value: 'a' } } },
          },
          bb: {
            type: 'Button',
            props: { label: 'Invoices', variant: 'secondary' },
            children: [],
            on: { press: { action: 'setState', params: { statePath: '/tab', value: 'b' } } },
          },
          a: {
            type: 'Text',
            props: { value: 'Overview panel', tone: 'info', size: null },
            children: [],
            visible: { $state: '/tab', eq: 'a' },
          },
          b: {
            type: 'Text',
            props: { value: 'Invoices panel', tone: 'success', size: null },
            children: [],
            visible: { $state: '/tab', eq: 'b' },
          },
        },
      } as unknown as Spec,
      seed: { tab: 'a' },
      options: [
        'The tabs work — setState is a built-in the runtime handles itself',
        'Nothing — "No handler registered for action: setState" is warned',
        'It throws, because setState is not in the catalog',
        'The buttons work once, then stop when the state model is replaced',
      ],
      answer: 0,
      explain:
        'Four actions are always available and need no handler and no catalog entry: setState, pushState, removeState and validateForm. The prompt tells the model about them automatically. (The React runtime also intercepts push and pop for screen navigation, though those are not advertised in the prompt.)',
      step: 'actions',
      ref: 'act-setstate',
    },
    {
      kind: 'choice',
      id: 'b-id',
      prompt: 'A pushState binding has params.value = { id: "$id", text: { "$state": "/draft" } }. What is written?',
      // Verified: ActionProvider.deepResolveValue turns the literal string "$id"
      // (and { $id: … }) into `${Date.now()}-${counter}`; it is called for
      // pushState only.
      options: [
        'A generated unique id, and the current value at /draft',
        'The literal string "$id", and the current value at /draft',
        'undefined for both — "$id" is not a valid expression',
        'A generated id, and the literal string "/draft"',
      ],
      answer: 0,
      explain:
        '"$id" is a sentinel the ActionProvider replaces with a fresh unique id while deep-resolving a pushState value. It is not a prop expression: it works in pushState params, not in props, and setState does not deep-resolve its value the same way.',
      step: 'actions',
      ref: 'act-pushstate',
    },
    {
      kind: 'choice',
      id: 'b-clearstatepath',
      prompt: 'pushState is given clearStatePath: "/draft". After the push, what is at /draft?',
      // Verified: `set(clearStatePath, "")` in the pushState branch.
      options: ['The empty string ""', 'undefined', 'null', 'Its previous value — clearStatePath only affects arrays'],
      answer: 0,
      explain:
        'It is set to the empty string, which is exactly what a text input wants: "" renders as an empty box, while undefined makes a controlled input complain. This is the whole add-to-list idiom — append the draft, blank the field, in one binding.',
      step: 'actions',
      ref: 'act-pushstate',
    },
    {
      kind: 'choice',
      id: 'b-array-bindings',
      prompt: 'on.press is an ARRAY of two action bindings. How do they run?',
      // Verified: the emit callback iterates actionBindings and awaits each
      // execute(...) in order.
      options: [
        'In order, each awaited before the next starts',
        'In parallel, and the event resolves when all settle',
        'Only the first — the array form is for fallbacks',
        'In order, but a rejection in the first still runs the second',
      ],
      answer: 0,
      explain:
        'Every event slot accepts one binding or an array of them, and the renderer awaits each in sequence. Sequential matters: "save, then navigate" is expressible, and a throw in the first stops the rest.',
      step: 'actions',
      ref: 'act-array',
    },
    {
      kind: 'choice',
      id: 'b-confirm-builtin',
      prompt: 'A binding is { action: "removeState", params: {…}, confirm: { title: "Delete?", message: "…" } }. What does the user see?',
      // Verified: the removeState branch returns BEFORE the `if (resolved.confirm)`
      // branch in ActionProvider.execute.
      options: [
        'No dialog — the item is removed immediately',
        'The dialog, then the removal',
        'The dialog, but confirming does nothing',
        'A console error: built-ins cannot be confirmed',
      ],
      answer: 0,
      explain:
        'Built-in actions are intercepted and returned from before the confirm branch is reached, so confirm on setState, pushState, removeState or validateForm is silently ignored. If a destructive action must be confirmed, route it through a handler of your own.',
      step: 'actions',
      ref: 'act-confirm',
    },
    {
      kind: 'choice',
      id: 'b-onsuccess',
      prompt: 'Which of these is NOT a valid onSuccess / onError value?',
      // Verified from ActionOnSuccess / ActionOnError in core's types:
      // onSuccess = {navigate} | {set} | {action, params?}; onError drops navigate.
      options: [
        '{ "navigate": "/invoices" } on onError',
        '{ "set": { "/toast": "Saved" } } on onSuccess',
        '{ "action": "refresh", "params": { "id": { "$state": "/current" } } } on onSuccess',
        '{ "set": { "/error": "Could not save" } } on onError',
      ],
      answer: 0,
      explain:
        'onSuccess accepts { navigate }, { set } or { action, params }. onError accepts only { set } or { action, params } — there is no navigate on the failure branch, because navigating away from a failed form is never what you want. Both take exactly one shape, not a merged object.',
      step: 'actions',
      ref: 'act-onsuccess',
    },
    {
      kind: 'choice',
      id: 'b-watch',
      prompt: 'An element has watch: { "/country": { action: "loadCities" } }. When does loadCities run?',
      // Verified: the watch effect stores the first snapshot and returns when
      // prevWatchValues.current === null, then compares by reference per path.
      options: [
        'Only when the value at /country changes — never on mount',
        'On mount and on every change',
        'On every render where /country is defined',
        'Only when /country changes AND the element is hidden',
      ],
      answer: 0,
      explain:
        'The first pass records a baseline and fires nothing; after that each watched path is compared by reference and only the changed ones dispatch. So watch is a change listener, not an initialiser — if you need data on load, fetch it before you render. It is also the only reactive primitive a spec has: no mount hook, no interval.',
      step: 'actions',
      ref: 'el-watch',
    },
    {
      kind: 'spot',
      id: 'b-on-in-props',
      prompt: 'The Save button does nothing. Which issue does validateSpec report?',
      // Verified: ['on_in_props'] (F11 pattern; code list in spec-validator).
      spec: {
        root: 'card',
        elements: {
          card: { type: 'Card', props: { title: 'Settings', subtitle: null }, children: ['save'] },
          save: {
            type: 'Button',
            props: { label: 'Save', variant: 'primary', on: { press: { action: 'submit' } } },
            children: [],
          },
        },
      } as unknown as Spec,
      options: ['on_in_props', 'missing_child', 'invalid_visible', 'no issue — it renders wrong silently'],
      answer: 0,
      explain:
        'on belongs on the element, beside type and props. Inside props it reaches the component as an unknown prop and nothing is ever bound, so emit("press") is a no-op. This is the single most common generation error, which is why validateSpec has a code for it and autoFixSpec relocates it losslessly.',
      step: 'actions',
      ref: 'el-on',
    },
    {
      kind: 'choice',
      id: 'b-checks-prop',
      prompt: 'json-render has no "validation" field on an element. So how does a field get validated?',
      options: [
        'checks travels as an ordinary prop, and the component registers it with useFieldValidation',
        'The catalog declares checks per component, and the renderer applies them',
        'validateForm reads the Zod schema from the catalog',
        'A ValidationProvider walks the spec and validates every element with a value prop',
      ],
      answer: 0,
      explain:
        'Validation belongs to the control that owns the value, not to the tree. Your component takes a checks prop, passes it to useFieldValidation with the bound path, and that registration is what makes the field visible to validateAll. A control that never calls the hook is invisible to validateForm — and reports clean.',
      step: 'validation',
      ref: 'val-usefieldvalidation',
    },
    {
      kind: 'choice',
      id: 'b-validateform',
      prompt: 'A submit button binds validateForm and then your save handler. The form is invalid. What happens?',
      // Verified: the validateForm branch calls validateAll(), writes
      // { valid, errors } to params.statePath || '/formValidation', and returns.
      // It never blocks anything.
      options: [
        'Both run — validateForm writes { valid, errors } to state and blocks nothing',
        'Only validateForm runs; an invalid form short-circuits the array',
        'validateForm throws, and onError fires',
        'The button is disabled until every field is valid',
      ],
      answer: 0,
      explain:
        'validateForm REPORTS. It runs every registered field, writes { valid, errors } to params.statePath or /formValidation by default, and returns — it does not stop the next binding and it does not disable anything. To actually block, gate your handler on that state, or check inside the handler. It also warns and does nothing at all if no ValidationProvider is mounted.',
      step: 'validation',
      ref: 'act-validateform',
    },
    {
      kind: 'choice',
      id: 'b-crossfield',
      prompt: 'How does a "must match the password field" check reach the other field\'s value?',
      // Verified: check.matches('/form/password') === { type:'matches',
      // args:{ other:{ $state:'/form/password' } }, message:'Fields must match' } (V5),
      // and runValidationCheck resolves args through resolvePropValue.
      options: [
        'Through args: { other: { "$state": "/form/password" } }, resolved against the state model',
        'Through a second value prop on the same component',
        'The ValidationProvider passes every field value to every check',
        'Cross-field checks are not supported; use $computed',
      ],
      answer: 0,
      explain:
        'Check args are dynamic values, resolved against the state model before the check function runs. matches, equalTo, lessThan and greaterThan all use args.other; requiredIf uses args.field. The core helper check.matches("/form/password") builds exactly that shape for you.',
      step: 'validation',
      ref: 'val-helpers',
    },
  ],
};
