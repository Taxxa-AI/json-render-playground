import type { Spec } from '@json-render/core';
import type { Quiz } from './types';

/**
 * Your code — hooks, providers, and the three extension points.
 *
 * Verified against @json-render/react 0.20.0 (JSONUIProvider composition at
 * dist/index.mjs ~1140; defineRegistry ~1183; useBoundProp) and
 * @json-render/core `defineDirective` / `findDirective` / `resolvePropValue`
 * (scratchpad/verify-checkpoints.ts Y1–Y3b, D5, D6).
 */
export const yourCodeQuiz: Quiz = {
  group: 'Your code',
  slug: 'your-code',
  intro: 'What you write in your own codebase to extend the renderer — and the contracts it enforces.',
  questions: [
    {
      kind: 'choice',
      id: 'y-hooks',
      prompt: 'Inside a registry component, when do you reach for useStateValue instead of useBoundProp?',
      options: [
        'When you need a path the spec did not bind — useBoundProp only works through the bindings map',
        'When you need to write; useBoundProp is read-only',
        'Never — useStateValue is the deprecated form of useBoundProp',
        'When the component is outside a JSONUIProvider',
      ],
      answer: 0,
      explain:
        'useBoundProp(props.value, bindings?.value) pairs an already-resolved value with the path the renderer extracted from $bindState / $bindItem, and returns a [value, setValue] pair — it is the right default. useStateValue("/some/path") subscribes to an arbitrary path the spec never mentioned, which you need for cross-cutting reads. For both read and write on an arbitrary path, useStateStore gives you get, set and update.',
      step: 'hooks',
      ref: 'hook-useboundprop',
    },
    {
      kind: 'choice',
      id: 'y-providers',
      prompt: 'JSONUIProvider is a stack of four providers. Which order does it compose them in?',
      // Verified from the JSONUIProvider source: StateProvider > VisibilityProvider
      // > ValidationProvider > ActionProvider > functions > directives, plus a
      // ConfirmationDialogManager as a sibling of children.
      options: [
        'State → Visibility → Validation → Action',
        'Action → State → Visibility → Validation',
        'Validation → State → Action → Visibility',
        'State → Action → Validation → Visibility',
      ],
      answer: 0,
      explain:
        'State is outermost because everything else reads it. Action is innermost because it needs all three: state to resolve params, and validation so the built-in validateForm can call validateAll. Invert those two and validateForm warns and does nothing. JSONUIProvider also mounts a confirmation-dialog manager beside your children — split the stack by hand and you must mount one yourself.',
      step: 'providers',
      ref: 'prov-jsonuiprovider',
    },
    {
      kind: 'choice',
      id: 'y-registry-actions',
      prompt: 'Your catalog declares actions. What does defineRegistry demand?',
      // Verified from DefineRegistryOptions<C>: CatalogHasActions<C> extends true
      // ? { actions: Actions<C> } : { actions?: Actions<C> }.
      options: [
        'An actions map — the key is required, and every catalog action must appear',
        'Nothing; actions are resolved at runtime from JSONUIProvider handlers',
        'An actions map, but only for the actions you intend to use',
        'A validationFunctions map alongside the components',
      ],
      answer: 0,
      explain:
        'The options type is conditional: a catalog with actions makes the actions key required, one with actions: {} makes it optional. So deleting the actions block from a registry whose catalog has actions is a compile error, not a runtime surprise.',
      step: 'build-catalog',
      ref: 'util-defineregistry',
    },
    {
      kind: 'choice',
      id: 'y-async',
      prompt: 'Why does an action handler have to be async? A plain () => {} does not compile.',
      // Verified from ActionFn<C, K>: (params, setState, state) => Promise<void>.
      options: [
        'The dispatcher awaits it to decide between onSuccess and onError',
        'Because handlers always perform network calls',
        'Because React 19 requires async event handlers',
        'To let the confirmation dialog resolve before the handler starts',
      ],
      answer: 0,
      explain:
        'ActionFn returns Promise<void>. An action binding may declare onSuccess and onError, and the runtime needs something to await before choosing a branch — so the async signature is the type system enforcing that the success/failure contract can be honoured.',
      step: 'build-check',
      ref: 'act-onerror',
    },
    {
      kind: 'choice',
      id: 'y-directive-vs-computed',
      prompt: 'You need locale-aware currency formatting in specs. Directive or $computed?',
      options: [
        'Either works; a directive gets its own $-key, a schema, and a line in the AI prompt',
        'Only a directive — $computed cannot take arguments',
        'Only $computed — directives cannot read state',
        'Neither; formatting must happen inside the component',
      ],
      answer: 0,
      explain:
        'Both are escape hatches into your JavaScript. $computed is one generic key with a name and args; a directive adds a real $-key with a Zod schema, an auto-described prompt entry, and a resolver that can recursively call resolvePropValue on sub-values. Use $computed for one-offs and a directive when the concept deserves to be part of the language the model writes in.',
      step: 'directives',
      ref: 'expr-directive',
    },
    {
      kind: 'choice',
      id: 'y-directive-passthrough',
      prompt: 'A prop is { "$format": "currency", "value": { "$state": "/total" } } and no $format directive is registered. What does the component receive?',
      // Verified: resolvePropValue falls through to the plain-object branch and
      // resolves each entry, so { $upper: 'hi' } came back as { $upper: 'hi' } (Y3b)
      // and { $foo: { $state:'/count' } } came back as { $foo: 3 } (D5).
      options: [
        'The object itself, with its inner expressions resolved: { $format: "currency", value: 480 }',
        'undefined',
        'The string "$format"',
        'An error — unknown $-keys are rejected',
      ],
      answer: 0,
      explain:
        'Unknown $-keys are not special. After every built-in and every registered directive has been checked, a plain object is simply walked and each value resolved — so an unregistered directive passes through as data with live sub-expressions inside it. Your component then receives an object where it expected a string, and renders nothing useful. No warning.',
      step: 'directives',
      ref: 'expr-directive',
    },
    {
      kind: 'choice',
      id: 'y-directive-collision',
      prompt: 'defineDirective({ name: "$state", … }). What happens?',
      // Verified (Y1): throws 'Directive name "$state" conflicts with a built-in
      // prop expression key'. (Y2): a name without $ throws too.
      options: [
        'It throws at definition time — built-in keys are reserved',
        'It is accepted, and shadows the built-in',
        'It is accepted, and the built-in wins at runtime',
        'It is accepted but never matches, because built-ins are checked first',
      ],
      answer: 0,
      explain:
        'defineDirective validates the name immediately: it must start with $, and it must not be one of $state, $item, $index, $bindState, $bindItem, $cond, $computed or $template. Registering two directives that both match the same object is also an error, but that one surfaces at resolve time.',
      step: 'directives',
      ref: 'util-definedirective',
    },
    {
      kind: 'predict',
      id: 'y-resolved-props',
      prompt: '/overdue is 2. What string does the Metric component see in props.value?',
      // Verified (D6 + D3b): $cond evaluates the condition, then resolves the
      // chosen branch through resolvePropValue — so a nested $template runs.
      spec: {
        root: 'm',
        elements: {
          m: {
            type: 'Metric',
            props: {
              label: 'Invoices',
              value: {
                $cond: { $state: '/overdue', gt: 0 },
                $then: { $template: '${/overdue} overdue' },
                $else: 'All clear',
              },
              delta: null,
              tone: { $cond: { $state: '/overdue', gt: 0 }, $then: 'danger', $else: 'success' },
            },
            children: [],
          },
        },
      } as unknown as Spec,
      seed: { overdue: 2 },
      options: [
        '"2 overdue" — the chosen branch is resolved recursively',
        'The $template object, unresolved — $cond only picks, it does not resolve',
        '"${/overdue} overdue" — templates only run at the top level of a prop',
        '"All clear" — gt on a non-numeric path is false',
      ],
      answer: 0,
      explain:
        'Expressions compose. $cond evaluates its condition, then runs the winning branch back through the resolver, so templates, state reads and further conditionals nest freely. This is the whole reason your components are ordinary React: by the time one runs, props contains values, never expressions.',
      step: 'build-component',
      ref: 'expr-cond',
    },
    {
      kind: 'choice',
      id: 'y-validationfunctions',
      prompt: 'What is the signature of a custom validation function, and where is it registered?',
      // Verified from ValidationFunction and JSONUIProvider validationFunctions.
      options: [
        '(value, args?) => boolean, passed as validationFunctions on JSONUIProvider',
        '(value, args?) => Promise<boolean>, declared in the catalog',
        '(state, path) => string[], passed to ValidationProvider as checks',
        '(value) => ValidationResult, returned from useFieldValidation',
      ],
      answer: 0,
      explain:
        'A check is a synchronous predicate over one value plus resolved args. It returns a boolean; the message comes from the spec, not the function. Register the map as validationFunctions on JSONUIProvider (ValidationProvider takes it as customFunctions) — and note that built-ins are looked up first, so you cannot override required.',
      step: 'build-check',
      ref: 'val-helpers',
    },
    {
      kind: 'choice',
      id: 'y-ctx-on',
      prompt: 'Your component needs to call preventDefault only when something is actually bound. Which part of the context tells you?',
      // Verified from EventHandle: { emit, shouldPreventDefault, bound }.
      options: [
        'on("press") — it returns { emit, shouldPreventDefault, bound }',
        'emit("press") — it returns false when nothing is bound',
        'bindings.press — present only when the event is bound',
        'loading — false means no binding exists',
      ],
      answer: 0,
      explain:
        'emit is the shorthand: fire and forget, a no-op when unbound. on gives you the handle — whether any binding exists, and whether any of them asked for preventDefault. Use on for anchors and form submits, emit everywhere else.',
      step: 'build-component',
      ref: 'ctx-on',
    },
    {
      kind: 'choice',
      id: 'y-split-providers',
      prompt: 'You split JSONUIProvider into its parts and put ActionProvider OUTSIDE ValidationProvider. What breaks?',
      // Verified: ActionProvider reads useOptionalValidation(); the validateForm
      // branch warns and returns when validateAll is unavailable.
      options: [
        'validateForm — it warns that no ValidationProvider is connected and does nothing',
        'Every action — ActionProvider throws without a validation context',
        'Nothing; the two are independent',
        'useFieldValidation — fields stop registering',
      ],
      answer: 0,
      explain:
        'ActionProvider reads validation through a non-throwing hook, so the tree still mounts and ordinary actions still fire. Only the built-in validateForm degrades: it warns once per dispatch and returns without writing a result — a form that submits invalid data and reports nothing.',
      step: 'providers',
      ref: 'prov-validationprovider',
    },
  ],
};
