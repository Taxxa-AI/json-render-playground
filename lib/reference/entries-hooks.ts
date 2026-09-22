import type { ReferenceEntry } from './types';

/**
 * Every hook exported by @json-render/react 0.20.0, verified against the
 * export list at the bottom of node_modules/@json-render/react/dist/index.d.ts:
 *   useAction useActions useBoundProp useChatUI useFieldValidation useIsVisible
 *   useJsonRenderMessage useOptionalValidation useRepeatScope useStateBinding
 *   useStateStore useStateValue useUIStream useValidation useVisibility
 */
export const HOOK_ENTRIES: ReferenceEntry[] = [
  {
    id: 'hook-useboundprop',
    category: 'Hooks',
    name: 'useBoundProp',
    signature: `function useBoundProp<T>(
  propValue: T | undefined,
  bindingPath: string | undefined,
): [T | undefined, (value: T) => void];`,
    lang: 'typescript',
    summary: 'The hook every input component needs. Returns [value, setValue] where the setter writes to the bound state path.',
    details: [
      'The value is passed straight through — it is already resolved by the renderer.',
      'With no `bindingPath` the setter is a NO-OP. It does not throw and does not warn.',
      'It works for both `$bindState` and `$bindItem`, because `bindings` already holds absolute paths.',
      'This supersedes `useStateBinding`, which takes a raw path string and knows nothing about the bindings map.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['t', 'c', 's', 'out'] },
          t: { type: 'TextInput', props: { label: 'text', value: { $bindState: '/form/text' }, placeholder: null, help: null, required: null, checks: null }, children: [] },
          c: { type: 'Checkbox', props: { label: 'checkbox', checked: { $bindState: '/form/flag' } }, children: [] },
          s: {
            type: 'Select',
            props: {
              label: 'select',
              value: { $bindState: '/form/pick' },
              options: [
                { label: 'one', value: '1' },
                { label: 'two', value: '2' },
              ],
            },
            children: [],
          },
          out: { type: 'Text', props: { value: { $template: 'text="${/form/text}" flag=${/form/flag} pick=${/form/pick}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { form: { text: '', flag: false, pick: '1' } },
      note: 'Three demo components, one hook each. All three call useBoundProp with the path the renderer put in `bindings`.',
    },
    related: ['ctx-bindings', 'expr-bindstate', 'hook-usestatebinding'],
    step: 'hooks',
    tags: ['useBoundProp', 'binding'],
  },
  {
    id: 'hook-usestatevalue',
    category: 'Hooks',
    name: 'useStateValue',
    signature: `function useStateValue<T>(path: string): T | undefined;`,
    lang: 'typescript',
    summary: 'Read one value from the state model by JSON Pointer, and re-render when it changes.',
    details: [
      'Read-only. For a writable pair use `useBoundProp` or `useStateStore().set`.',
      'A missing path gives `undefined`; the generic is an assertion, not a check.',
      'It subscribes to the whole store (through `useStateStore`), so a write anywhere re-renders the component.',
      'Must be inside a `StateProvider` — `JSONUIProvider` includes one.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['in', 'a', 'b'] },
          in: { type: 'TextInput', props: { label: 'write here', value: { $bindState: '/shared' }, placeholder: null, help: null, required: null, checks: null }, children: [] },
          a: { type: 'Badge', props: { label: { $state: '/shared' }, tone: 'info' }, children: [] },
          b: { type: 'Text', props: { value: { $state: '/shared' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { shared: 'one value, three readers' },
      note: 'Every reader re-renders on every write: the hook subscribes to the whole store, not to one path.',
    },
    related: ['hook-usestatestore', 'hook-useboundprop', 'prov-stateprovider'],
    step: 'hooks',
    tags: ['useStateValue', 'read'],
  },
  {
    id: 'hook-usestatestore',
    category: 'Hooks',
    name: 'useStateStore',
    signature: `function useStateStore(): {
  state: StateModel;
  get: (path: string) => unknown;
  set: (path: string, value: unknown) => void;
  update: (updates: Record<string, unknown>) => void;
  getSnapshot: () => StateModel;
};`,
    lang: 'typescript',
    summary: 'The whole state context: the render snapshot, plus get / set / update / getSnapshot.',
    details: [
      '`state` is the React render snapshot. `getSnapshot()` is the LIVE value from the store — use it inside callbacks and effects, where `state` may be stale.',
      '`update({ "/a": 1, "/b": 2 })` writes several paths and notifies subscribers ONCE.',
      'Writes are compared by reference (`===`). Mutating an array in place and setting it back notifies nobody.',
      'Throws if there is no StateProvider above it.',
    ],
    related: ['hook-usestatevalue', 'util-createstatestore', 'prov-stateprovider'],
    step: 'hooks',
    tags: ['useStateStore', 'store'],
  },
  {
    id: 'hook-usestatebinding',
    category: 'Hooks',
    name: 'useStateBinding (deprecated)',
    signature: `/** @deprecated Use useBoundProp with $bindState expressions instead. */
function useStateBinding<T>(path: string): [T | undefined, (value: T) => void];`,
    lang: 'typescript',
    summary: 'useState-like pair over a raw state path. Deprecated in favour of useBoundProp.',
    details: [
      'Takes a path STRING, so the component hard-codes where it writes — the spec cannot redirect it.',
      'It does not understand the `bindings` map, so it works with neither `$bindState` nor `$bindItem`.',
      'Still exported and still functional in 0.20.0; the deprecation is a JSDoc tag, not a runtime warning.',
      'Reach for it only in a bespoke component that owns its own state path.',
    ],
    related: ['hook-useboundprop', 'hook-usestatestore'],
    step: 'hooks',
    tags: ['useStateBinding', 'deprecated'],
  },
  {
    id: 'hook-useaction',
    category: 'Hooks',
    name: 'useAction',
    signature: `function useAction(binding: ActionBinding): {
  execute: () => Promise<void>;
  isLoading: boolean;
};`,
    lang: 'typescript',
    summary: 'Bind one ActionBinding and get an execute function plus a loading flag for it.',
    details: [
      '`isLoading` is true while an action with the SAME NAME is in flight — it is derived from `loadingActions.has(binding.action)`, so two buttons calling the same action both light up.',
      'Built-in actions return before the loading set is touched, so `isLoading` never becomes true for setState and friends.',
      '`execute()` rejects with `Error("Action cancelled")` when the user dismisses a confirm dialog. Catch it.',
      'Most components never need this — `emit` / `on` cover the normal path.',
    ],
    related: ['hook-useactions', 'act-binding', 'ctx-emit'],
    step: 'hooks',
    tags: ['useAction', 'dispatch'],
  },
  {
    id: 'hook-useactions',
    category: 'Hooks',
    name: 'useActions',
    signature: `function useActions(): {
  handlers: Record<string, ActionHandler>;
  loadingActions: Set<string>;
  pendingConfirmation: PendingConfirmation | null;
  execute: (binding: ActionBinding) => Promise<void>;
  confirm: () => void;
  cancel: () => void;
  registerHandler: (name: string, handler: ActionHandler) => void;
};`,
    lang: 'typescript',
    summary: 'The whole action context: dispatch anything, inspect what is loading, drive the confirm dialog yourself.',
    details: [
      '`registerHandler` adds a handler at runtime, which is how a lazily-loaded feature can supply its own action.',
      '`pendingConfirmation` holds the resolved action and the promise callbacks; `confirm()` and `cancel()` settle it.',
      '`loadingActions` is keyed by action NAME, not by dispatch, so concurrent calls to the same action share one flag.',
      'Throws outside an ActionProvider.',
    ],
    related: ['hook-useaction', 'prov-actionprovider', 'act-confirm'],
    step: 'hooks',
    tags: ['useActions', 'context'],
  },
  {
    id: 'hook-useisvisible',
    category: 'Hooks',
    name: 'useIsVisible',
    signature: `function useIsVisible(condition: VisibilityCondition | undefined): boolean;`,
    lang: 'typescript',
    summary: 'Evaluate a visibility condition against the live state, from inside a component.',
    details: [
      'Thin wrapper over `useVisibility().isVisible(condition)`, which calls core `evaluateVisibility`.',
      'The context it uses is the PROVIDER\'s, so `repeatItem` / `repeatIndex` come from the enclosing RepeatScopeProvider if there is one.',
      '`undefined` returns true, matching the element rule.',
      'A malformed condition object can throw here exactly as it does in the renderer — a null condition hits `"$index" in cond`.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['t', 'a'] },
          t: { type: 'Checkbox', props: { label: 'show', checked: { $bindState: '/show' } }, children: [] },
          a: { type: 'Alert', props: { title: 'Same evaluator the hook uses', message: 'element.visible and useIsVisible both call evaluateVisibility.', tone: 'info' }, children: [], visible: { $state: '/show' } },
        },
      },
      seed: { show: true },
    },
    related: ['el-visible', 'util-evaluatevisibility', 'prov-visibilityprovider'],
    step: 'hooks',
    tags: ['useIsVisible', 'conditions'],
  },
  {
    id: 'hook-usefieldvalidation',
    category: 'Hooks',
    name: 'useFieldValidation',
    signature: `function useFieldValidation(path: string, config?: ValidationConfig): {
  state: { touched: boolean; validated: boolean; result: ValidationResult | null };
  validate: () => ValidationResult;
  touch: () => void;
  clear: () => void;
  errors: string[];
  isValid: boolean;
};`,
    lang: 'typescript',
    summary: 'Register a field with the ValidationProvider and drive its validation. Calling it is what makes validateForm see the field.',
    details: [
      'It registers in an effect: `if (path && config) registerField(path, config)`. No path, no registration.',
      'It does NOT validate on its own. Nothing reads `config.validateOn` — you call `validate()` from your own onChange / onBlur / submit.',
      '`errors` is `state.result?.errors ?? []`, so it is empty until something calls `validate()`.',
      '`isValid` defaults to TRUE before the first run — check `state.validated` before showing a success state.',
      'The demo TextInput registers under `bindings?.value`, falling back to `unbound:<label>` so unbound fields cannot collide.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['registered', 'unregistered', 'go', 'out'] },
          registered: {
            type: 'TextInput',
            props: {
              label: 'has checks → registered',
              value: { $bindState: '/form/email' },
              placeholder: 'you@co.com',
              help: 'blur to validate',
              required: null,
              checks: [{ type: 'email', args: null, message: 'Not an email' }],
            },
            children: [],
          },
          unregistered: { type: 'Checkbox', props: { label: 'Checkbox never calls useFieldValidation — invisible to validateForm', checked: { $bindState: '/form/agree' } }, children: [] },
          go: { type: 'Button', props: { label: 'validateForm', variant: 'primary' }, children: [], on: { press: { action: 'validateForm', params: { statePath: '/result' } } } },
          out: { type: 'Text', props: { value: { $template: 'valid = ${/result/valid}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { form: { email: 'nope', agree: false }, result: { valid: null } },
      note: 'Press validateForm. Only the TextInput is checked — the Checkbox never registered, so validateAll() cannot see it.',
    },
    related: ['val-usefieldvalidation', 'act-validateform', 'hook-useoptionalvalidation', 'val-result'],
    step: 'validation',
    tags: ['useFieldValidation', 'forms'],
  },
  {
    id: 'hook-useoptionalvalidation',
    category: 'Hooks',
    name: 'useOptionalValidation',
    signature: `function useOptionalValidation(): ValidationContextValue | null;
function useValidation(): ValidationContextValue; // throws when absent`,
    lang: 'typescript',
    summary: 'The non-throwing variant of useValidation. Returns null when no ValidationProvider is mounted.',
    details: [
      'Use it in a reusable component that must also work outside a form.',
      '`ActionProvider` itself uses it — that is how `validateForm` can warn instead of crashing when validation is not set up.',
      '`useValidation()` throws `useValidation must be used within a ValidationProvider`.',
      'The context exposes `fieldStates` through a GETTER over a ref, so reading it straight after `validateAll()` gives fresh values.',
    ],
    related: ['hook-usefieldvalidation', 'prov-validationprovider', 'act-validateform'],
    step: 'hooks',
    tags: ['useOptionalValidation', 'validation'],
  },
  {
    id: 'hook-userepeatscope',
    category: 'Hooks',
    name: 'useRepeatScope',
    signature: `function useRepeatScope(): {
  item: unknown;
  index: number;
  basePath: string;   // e.g. "/todos/2"
} | null;`,
    lang: 'typescript',
    summary: 'Read the current repeat row from inside a component. Null when not in a repeat.',
    details: [
      '`basePath` is the absolute state path of the row, which is what `$bindItem` uses to build write paths.',
      'Provided by `RepeatScopeProvider`, which the renderer wraps around each repeated child.',
      'Useful for a component that needs the row identity without the spec spelling it out — a drag handle, a row menu.',
      'Nested repeats overwrite the scope: the innermost one wins.',
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
            repeat: { statePath: '/rows', key: 'id' },
          },
          row: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
            children: ['i', 'label', 'edit'],
          },
          i: { type: 'Badge', props: { label: { $index: true }, tone: 'neutral' }, children: [] },
          label: { type: 'Text', props: { value: { $item: 'label' }, tone: null, size: null }, children: [] },
          edit: { type: 'TextInput', props: { label: '', value: { $bindItem: 'label' }, placeholder: null, help: null, required: null, checks: null }, children: [] },
        },
      },
      seed: { rows: [{ id: 'a', label: 'first' }, { id: 'b', label: 'second' }] },
      note: 'index, item and basePath all come from the same RepeatScopeProvider the hook reads. Edit a row: $bindItem writes to /rows/<n>/label.',
    },
    related: ['el-repeat', 'expr-item', 'expr-binditem'],
    step: 'hooks',
    tags: ['useRepeatScope', 'repeat'],
  },
  {
    id: 'hook-useuistream',
    category: 'Hooks',
    name: 'useUIStream',
    signature: `function useUIStream(options: { api: string; onComplete?; onError? }): {
  spec: Spec | null;
  isStreaming: boolean;
  error: Error | null;
  usage: { promptTokens; completionTokens; totalTokens } | null;
  rawLines: string[];
  send: (prompt: string, context?: Record<string, unknown>) => Promise<void>;
  clear: () => void;
};`,
    lang: 'typescript',
    summary: 'Generate a spec from an endpoint that streams JSONL patches, and get the partial spec on every frame.',
    details: [
      '`api` is your own route. The hook POSTs and reads the response as a stream of patch lines.',
      '`rawLines` keeps every JSONL line received — the cheapest way to see what the model actually sent.',
      '`usage` is token accounting, populated when the endpoint reports it.',
      'Pass `isStreaming` to `<Renderer loading>` so components can render skeletons.',
      'This hook needs a server route and a model key; the reference page is entirely offline, so there is no live demo here.',
    ],
    related: ['ctx-loading', 'util-compilespecstream', 'util-pipejsonrender', 'hook-usechatui'],
    step: 'generate',
    tags: ['useUIStream', 'streaming', 'AI'],
  },
  {
    id: 'hook-usechatui',
    category: 'Hooks',
    name: 'useChatUI',
    signature: `function useChatUI(options: { api: string; onComplete?; onError? }): {
  messages: Array<{ id: string; role: "user" | "assistant"; text: string; spec: Spec | null }>;
  isStreaming: boolean;
  error: Error | null;
  send: (text: string) => Promise<void>;
  clear: () => void;
};`,
    lang: 'typescript',
    summary: 'A multi-turn chat where each assistant message can carry prose and a spec at once.',
    details: [
      'It sends the full message history to `api` and splits the response with `createMixedStreamParser`.',
      'Text lines become `message.text`; JSONL patch lines build `message.spec`.',
      'Each message owns its own spec, so old messages keep rendering their UI as the conversation goes on.',
      'Needs a server route; nothing here runs without one.',
    ],
    related: ['util-createmixedstreamparser', 'hook-usejsonrendermessage', 'hook-useuistream'],
    step: 'chat',
    tags: ['useChatUI', 'chat', 'AI'],
  },
  {
    id: 'hook-usejsonrendermessage',
    category: 'Hooks',
    name: 'useJsonRenderMessage',
    signature: `function useJsonRenderMessage(parts: Array<{ type: string; text?: string; data?: unknown }>): {
  spec: Spec | null;
  text: string;
  hasSpec: boolean;
};`,
    lang: 'typescript',
    summary: 'Pull the spec and the prose out of an AI SDK message.parts array, memoized.',
    details: [
      'Combines `buildSpecFromParts` and `getTextFromParts`, both of which are exported separately.',
      'Text parts are trimmed and joined with a BLANK LINE, so separate agent steps read as paragraphs in markdown.',
      'Memoization is tuned for append-only streaming: it recomputes when the array reference changes AND either the length differs or the last element is a different object.',
      'Mid-array edits may NOT trigger a recompute. Pass a new array with a different last element to force one.',
      'It has no dependency on the AI SDK — the part type is structural.',
    ],
    related: ['hook-usechatui', 'util-createmixedstreamparser'],
    step: 'chat',
    tags: ['useJsonRenderMessage', 'AI SDK', 'parts'],
  },
];
