import type { Concept } from './types';

/**
 * Catalog, registry, components, directives, handlers — the developer side.
 *
 * Every `shape` here is copied from a call that actually runs somewhere in
 * `lib/build/**` or `components/lab/build-*`, and every claim is checked
 * against `@json-render/{core,react}@0.20.0` .d.ts or runtime behaviour.
 */
export const YOURCODE_CONCEPTS: Concept[] = [
  /* ------------------------------------------------------------- catalog */
  {
    id: 'catalog-entry',
    title: 'A catalog entry',
    summary:
      'Four fields — props, slots, description, example — that declare one component. The entry is simultaneously the prompt the model reads and the TypeScript your registry must satisfy.',
    lang: 'typescript',
    shape: `Callout: {
  description: 'A highlighted note. Use it for one sentence.',
  props: z.object({ title: z.string(), tone: z.enum(['info','danger']).nullable() }),
  slots: ['default', 'actions'],
  example: { title: 'Heads up', tone: null },
}`,
    gotcha:
      'Only `props` is required. Omitting `slots` does not stop children reaching your component at runtime — it only removes the guidance from the prompt, so no model will ever emit them.',
    step: 'build-catalog',
    ref: 'util-definecatalog',
  },
  {
    id: 'zod-props',
    title: 'Props are a Zod schema',
    summary:
      'The Zod object is serialised into the prompt as a TypeScript-looking signature, and inferred into your component props. It is never used to validate props at render time.',
    lang: 'typescript',
    shape: `props: z.object({ label: z.string(), count: z.number().nullable() })

// prompt:  - Badge: { label: string, count?: number } - …
// types:   ComponentContext<typeof catalog, 'Badge'>['props']
//            = { label: string; count: number | null }`,
    gotcha:
      'Nothing re-checks props at runtime. A model that emits `count: "four"` reaches your component untouched, so parse anything load-bearing yourself.',
    step: 'build-catalog',
    ref: 'util-definecatalog',
  },
  {
    id: 'nullable-vs-optional',
    title: 'nullable, not optional',
    summary:
      'Prefer `.nullable()`. Structured output is happier emitting an explicit null than dropping a key, and a nullable field survives a JSON round trip unchanged.',
    lang: 'typescript',
    shape: `z.string().nullable()   // value: string | null   — prompt: "name?: string"
z.string().optional()   // value: string | undefined — prompt: "name?: string"`,
    gotcha:
      'Both print as `name?: string` in the prompt. The prompt cannot tell the model which one you wrote, so pick one convention per catalog and keep to it.',
    step: 'build-catalog',
    ref: 'util-definecatalog',
  },
  {
    id: 'description-is-docs',
    title: 'The description is the docs',
    summary:
      'The model never sees your React. It sees this string, once, next to the prop signature — and that is the whole basis on which it picks one component over another.',
    lang: 'text',
    shape: `- Card: { title?: string } - A bordered surface with an optional
  title. Has a named "footer" slot for actions, separate from its
  default children. [accepts children; slots: footer]`,
    gotcha:
      'Write when to reach for it, not what it looks like. "A bordered surface" tells a model nothing that the name did not.',
    step: 'build-catalog',
    ref: 'util-definecatalog',
  },
  {
    id: 'slots-declaration',
    title: 'Declaring slots',
    summary:
      "`slots: ['default']` means the component accepts children. Any other name becomes a named slot the spec fills through the element's top-level `slots` object.",
    lang: 'typescript',
    shape: `slots: ['default', 'footer']

// prompt gains: [accepts children; slots: footer]
// spec:    { "children": ["a"], "slots": { "footer": ["b"] } }
// your fn: ({ children, slots }) => …   slots.footer, never slots.default`,
    gotcha:
      'The default slot arrives as `children`, so `slots.default` is undefined. A spec that writes `slots: { default: [...] }` gets a console warning and hands your component a slot it almost certainly ignores.',
    step: 'build-catalog',
    ref: 'util-definecatalog',
  },
  {
    id: 'example-in-prompt',
    title: 'example is not decoration',
    summary:
      'The library builds the sample JSONL at the top of the prompt from real catalog entries — the first ones in the components map — inlining their example prop values verbatim.',
    lang: 'json',
    shape: `{"op":"add","path":"/elements/main",
 "value":{"type":"Callout",
          "props":{"title":"Heads up","tone":"info"},
          "children":[]}}`,
    gotcha:
      'Include every nullable prop as an explicit null in the example. Leaving them out teaches the model that omitting keys is fine.',
    step: 'build-catalog',
    ref: 'util-definecatalog',
  },

  /* ------------------------------------------------------------ registry */
  {
    id: 'define-registry',
    title: 'defineRegistry',
    summary:
      'The compile-time join between catalog and code. It returns `registry` for the Renderer, `handlers` for a provider, and `executeAction` for imperative calls.',
    lang: 'tsx',
    shape: `const { registry, handlers, executeAction } = defineRegistry(catalog, {
  components: { Card: ({ props, children }) => <div>{children}</div> },
  // REQUIRED when the catalog declares actions.
  actions: { submit: async (params, setState, state) => save(params) },
});`,
    gotcha:
      'Add a catalog entry and this stops compiling until the component exists. That is the feature — do not silence it with a cast.',
    step: 'build-catalog',
    ref: 'util-defineregistry',
  },
  {
    id: 'component-context',
    title: 'ComponentContext',
    summary:
      'Your component receives one object, not a props spread: props, children, slots, emit, on, bindings, loading.',
    lang: 'tsx',
    shape: `const Callout = ({ props, children, slots, emit, on, bindings, loading }:
  ComponentContext<typeof catalog, 'Callout'>) => …

// ComponentContext<C, K> extends BaseComponentProps<InferComponentProps<C, K>>
// Use BaseComponentProps<P> directly for catalog-agnostic component libraries.`,
    gotcha:
      'It is a single argument. Destructuring `({ title })` gets you undefined — the prop you want is `props.title`.',
    step: 'build-component',
    ref: 'ctx-props',
  },
  {
    id: 'props-resolved',
    title: 'props arrive resolved',
    summary:
      'Every $state, $cond, $template, $item and directive has already been evaluated before your function runs. Your component is ordinary React you could unit-test without json-render at all.',
    lang: 'json',
    shape: `// spec
"props": { "value": { "$state": "/user/name" } }

// your component
props.value === "Ada"`,
    example: {
      spec: {
        root: 'text',
        elements: {
          text: {
            type: 'Text',
            props: { value: { $template: '${/user/name} has ${/user/msgs} messages' }, tone: null, size: null },
            children: [],
          },
        },
      },
      seed: { user: { name: 'Ada', msgs: 4 } },
    },
    gotcha:
      'Resolved is not validated. The catalog Zod schema feeds the prompt and TypeScript, never the runtime.',
    step: 'build-component',
    ref: 'ctx-props',
  },
  {
    id: 'use-bound-prop',
    title: 'useBoundProp',
    summary:
      'A $bindState prop arrives split in two: the value lands in props, the state path lands in bindings. useBoundProp rejoins them into a [value, setValue] pair.',
    lang: 'tsx',
    shape: `const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);

// props.value    -> "ada@co.com"   (the value)
// bindings.value -> "/form/email"  (the path to write back to)`,
    example: {
      spec: {
        root: 'input',
        elements: {
          input: {
            type: 'TextInput',
            props: {
              label: 'Email',
              value: { $bindState: '/form/email' },
              placeholder: 'you@co.com',
              help: null,
              required: null,
              checks: null,
            },
            children: [],
          },
        },
      },
      seed: { form: { email: '' } },
    },
    gotcha:
      'Without a binding path `setValue` is a silent no-op. A plain string prop instead of `{ "$bindState": … }` is the whole "my input will not type" bug.',
    step: 'build-component',
    ref: 'ctx-bindings',
  },
  {
    id: 'emit-event',
    title: 'emit and on',
    summary:
      "emit(name) fires whatever the element's `on` field bound to that name. on(name) is the same event with metadata: whether anything is bound, and whether preventDefault was requested.",
    lang: 'tsx',
    shape: `<button onClick={() => emit('press')}>{props.label}</button>

const press = on('press');
press.bound;                 // false when the spec bound nothing
press.shouldPreventDefault;  // set by the binding
press.emit();`,
    example: {
      spec: {
        root: 'btn',
        elements: {
          btn: {
            type: 'Button',
            props: { label: 'Notify me', variant: 'primary' },
            on: { press: { action: 'notify', params: { message: 'pressed' } } },
            children: [],
          },
        },
      },
    },
    gotcha:
      'emit on an unbound event is a no-op, deliberately — components never need to know whether anyone is listening.',
    step: 'build-component',
    ref: 'ctx-emit',
  },
  {
    id: 'guard-boundary',
    title: 'Guard every component',
    summary:
      'One component that throws on a malformed prop blanks the whole page. Wrap each registry entry in its own error boundary and you lose one control instead.',
    lang: 'tsx',
    shape: `const Guarded = (props) => (
  <Boundary name={name}>
    <Impl {...props} />   {/* an ELEMENT, not Impl(props) */}
  </Boundary>
);`,
    gotcha:
      'A boundary only catches its children, so rendering `Impl(props)` inline puts the throw in the boundary\'s own render and it escapes. And boundaries catch nothing during server rendering.',
    step: 'build-component',
    ref: 'util-defineregistry',
  },

  /* ---------------------------------------------------------- directives */
  {
    id: 'directive',
    title: 'defineDirective',
    summary:
      'Add your own $-prefixed key to the expression language. Only name and resolve do anything at runtime — schema and description exist so catalog.prompt() can teach the model the new key.',
    lang: 'typescript',
    shape: `const money = defineDirective({
  name: '$money',
  description: 'Format a number as currency.',
  schema: z.object({ $money: z.unknown(), currency: z.string().optional() }),
  resolve: (value, ctx) => format(resolvePropValue(value.$money, ctx)),
});

<JSONUIProvider registry={registry} directives={[money]}>`,
    gotcha:
      'defineDirective throws at registration on a name that is not $-prefixed, or that shadows one of the eight built-ins ($state, $item, $index, $bindState, $bindItem, $cond, $computed, $template). The schema is never parsed at resolve time, so your resolver gets whatever the spec said. And an object carrying two registered directive keys throws "Ambiguous directive" when it renders.',
    step: 'directives',
    ref: 'util-definedirective',
  },
  {
    id: 'directive-compose',
    title: 'Directives compose',
    summary:
      'The resolver receives the full PropResolutionContext, so calling resolvePropValue on a sub-value lets any directive nest inside any built-in and vice versa.',
    lang: 'json',
    shape: `{ "$cond": { "$state": "/paid" },
  "$then": { "$money": { "$state": "/total" }, "currency": "EUR" },
  "$else": "unpaid" }`,
    gotcha:
      'Only if you call resolvePropValue yourself. A resolver that reads `value.$money` directly gets the raw expression object, not the number.',
    step: 'directives',
    ref: 'util-definedirective',
  },
  {
    id: 'directive-vs-computed',
    title: 'Directive or $computed?',
    summary:
      '$computed is a flat call with named args and no schema — right for one-off app logic. A directive is a vocabulary item with its own key, schema and description — right for formatting, i18n and units used across a product.',
    lang: 'json',
    shape: `{ "$computed": "vatFor", "args": { "net": { "$state": "/net" } } }
{ "$money": { "$state": "/net" }, "currency": "EUR" }`,
    gotcha:
      'An unknown $computed resolves to undefined and warns. An unknown directive does neither — it falls through as a literal object with its sub-expressions already resolved, and React throws on rendering it.',
    step: 'directives',
    ref: 'util-definedirective',
  },

  /* ------------------------------------------------- checks and handlers */
  {
    id: 'validation-function',
    title: 'validationFunction',
    summary:
      '`(value, args?) => boolean`, registered by name on the provider. A spec names it in a field\'s `checks` array; the component runs it by calling useFieldValidation.',
    lang: 'tsx',
    shape: `<JSONUIProvider validationFunctions={{ iban: (v) => /^IE\\d{2}/.test(String(v)) }}>

// spec side, as an ordinary prop on the input:
"checks": [{ "type": "iban", "args": null, "message": "Not an IBAN" }]`,
    gotcha:
      'An unregistered check FAILS OPEN: the field validates clean forever, and the only signal is a console warning, "Unknown validation function: iban".',
    step: 'build-check',
    ref: 'util-defineregistry',
  },
  {
    id: 'action-handler',
    title: 'Action handlers',
    summary:
      'A spec cannot hold code, so behaviour works by naming. The provider maps action names to functions; the dispatcher looks them up at press time.',
    lang: 'tsx',
    shape: `<JSONUIProvider handlers={{ archiveInvoice: async (params) => api.archive(params.id) }}>

// spec: { "action": "archiveInvoice", "params": { "id": { "$state": "/selected" } } }
// params arrive RESOLVED: { id: "INV-2041" }`,
    gotcha:
      'Built-in actions (setState, pushState, removeState, validateForm) never reach your handlers map. To audit state mutation, wrap the StateStore instead.',
    step: 'build-check',
    ref: 'util-defineregistry',
  },
  {
    id: 'handler-async',
    title: 'Handlers must be async',
    summary:
      'ActionFn returns Promise<void>, so a plain `() => {}` fails to compile. That is deliberate: a binding can declare onSuccess and onError, and the dispatcher needs something to await before choosing.',
    lang: 'typescript',
    shape: `type ActionFn = (
  params: P | undefined,
  setState: (updater: (prev: StateModel) => StateModel) => void,
  state: StateModel,
) => Promise<void>;`,
    gotcha:
      'Resolving is success, whatever you return. To take the onError branch you must throw or reject — returning `false` or `{ ok: false }` still counts as success.',
    step: 'build-check',
    ref: 'util-defineregistry',
  },
  {
    id: 'on-success-error',
    title: 'onSuccess / onError',
    summary:
      'Two branches declared in the spec, not in your handler. Each is either a state write (`set`) or another action binding, chosen by whether your promise resolved.',
    lang: 'json',
    shape: `{
  "action": "archiveInvoice",
  "params": { "id": { "$state": "/selected" } },
  "confirm": { "title": "Archive?", "variant": "danger" },
  "onSuccess": { "set": { "/status": "archived" } },
  "onError":   { "action": "notify", "params": { "message": "Failed." } }
}`,
    example: {
      spec: {
        root: 'btn',
        elements: {
          btn: {
            type: 'Button',
            props: { label: 'Save', variant: 'primary' },
            on: {
              press: {
                action: 'submit',
                onSuccess: { set: { '/status': 'saved' } },
                onError: { action: 'notify', params: { message: 'Save failed.' } },
              },
            },
            children: [],
          },
        },
      },
      seed: { status: '' },
    },
    gotcha:
      'Built-in actions ignore confirm, onSuccess and onError entirely — they return before the dispatcher reaches those branches. Route confirmed deletes through a custom action.',
    step: 'build-check',
    ref: 'act-onsuccess',
  },
  {
    id: 'execute-action',
    title: 'executeAction',
    summary:
      'The imperative back door from defineRegistry: run a registry action by name from outside the React tree, for start-up work such as loading initial data.',
    lang: 'typescript',
    shape: `const { executeAction } = defineRegistry(catalog, { components, actions });

await executeAction('loadInvoices', { page: 1 }, setState, state);`,
    gotcha:
      'It calls the registry action directly, so there is no confirm dialog, no onSuccess/onError, and no registerActionObserver row. An unknown name only console.warns.',
    step: 'build-check',
    ref: 'act-onerror',
  },
];
