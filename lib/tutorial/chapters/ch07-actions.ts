import type { Chapter } from '../types';

export const ch07: Chapter = {
  slug: 'actions',
  n: 7,
  title: 'Actions',
  goal: 'Make the buttons work: built-ins for state, a custom async handler for everything else.',
  minutes: 16,
  why: [
    'A spec cannot hold a function, so behaviour is done by naming. Your component calls `emit("press")`, the element\'s `on` map turns that name into an action binding, and the runtime dispatches it. Three hops, each one inspectable as data.',
    'Some actions need no declaration at all. `setState`, `pushState`, `removeState` and `validateForm` are built into the runtime: no catalog entry, no handler, no registry change. Everything else is a catalog entry plus a handler in `defineRegistry`, and the handler must be async — the dispatcher awaits it to decide between `onSuccess` and `onError`.',
    'And the trap: built-ins RETURN EARLY, before the confirmation dialog and before the success/error handling. A `confirm` on a `setState` binding is silently ignored, and so are `onSuccess` and `onError`. If you need a confirmation on a state write, wrap it in a custom action.',
    'Four files change this chapter, and the order matters: catalog first (declare `markPaid`), then the registry stops compiling, then the page wires the handlers, then the spec uses them.',
  ],
  files: [
    {
      path: 'lib/catalog.ts',
      lang: 'ts',
      notes: [
        {
          lines: [53, 56],
          title: "Button, and the event it emits",
          body: "The description names the event (`press`) and where it is bound (`on`). A model that knows a component emits an event but not what the event is called will guess, and the binding will silently never fire.",
        },
        {
          lines: [57, 64],
          title: "variant, not onClick",
          body: "A catalog prop is data. There is no place in a spec for a callback, so the only thing a Button prop can say is how it looks; what it DOES lives in the element\u2019s `on` map.",
        },
        {
          lines: [96, 100],
          title: "actions is no longer empty",
          body: "Everything below this line is the second half of the catalog. An action is a name, a params schema and a sentence \u2014 no code. Adding this entry makes `actions` required in `defineRegistry`, so the next compile error is the to-do list.",
        },
        {
          lines: [101, 104],
          title: "markPaid, and a usage rule",
          body: "\"Use it only on an invoice whose status is not already paid\" is a constraint the type system cannot express. The prompt can, so it goes here.",
        },
        {
          lines: [105, 110],
          title: "Typed params",
          body: "`params` is a Zod schema like any other, and it types the first argument of your handler. `note` is nullable because a row with no note is normal; making it required would push a coercion into the spec.",
        },
        {
          lines: [111, 111],
          title: "Closing the catalog",
          body: "Eight components and one action. That is the entire surface a spec \u2014 or a model \u2014 may use.",
        },
      ],
    },
    {
      path: 'lib/components.tsx',
      lang: 'tsx',
      notes: [
        {
          lines: [62, 64],
          title: "emit is always there",
          body: "The renderer supplies `emit` to every component, bound or not, so an unbound event is a no-op rather than a crash. Your Button never has to ask whether anyone is listening.",
        },
        {
          lines: [65, 68],
          title: "emit(\"press\"), and nothing else",
          body: "The component names an event. It does not name an action, does not know what happens, and cannot be broken by changing the binding. That indirection is the entire behaviour model.",
        },
        {
          lines: [69, 79],
          title: "variant as a class switch",
          body: "Two variants, two class strings. The Button is now complete \u2014 nothing in chapters eight to fourteen changes this component again.",
        },
      ],
    },
    {
      path: 'lib/registry.tsx',
      lang: 'tsx',
      notes: [
        {
          lines: [6, 6],
          title: "A type-only import of the domain",
          body: "The handler needs the Invoice shape to map over the array. Type-only, so the registry still has no runtime dependency on the domain module.",
        },
        {
          lines: [11, 13],
          title: "What each return value is for",
          body: "`registry` for the Renderer, `handlers` for the provider, `executeAction` for imperative dispatch outside React. You use the first two this chapter.",
        },
        {
          lines: [17, 19],
          title: "Now required",
          body: "The catalog declares `markPaid`, so `CatalogHasActions` is true and the `actions` key is mandatory. Delete it and this file stops compiling \u2014 the compile-time join, working.",
        },
        {
          lines: [20, 25],
          title: "Async is not a style choice",
          body: "`ActionFn` returns `Promise<void>`. The dispatcher awaits it to decide between `onSuccess` and `onError`, so a synchronous handler would leave it nothing to wait for. A non-async function does not type-check.",
        },
        {
          lines: [26, 27],
          title: "Typed params, from the catalog",
          body: "`params` is `{ id: string; note: string | null } | undefined`. The `undefined` is real \u2014 a binding may omit params entirely \u2014 so `params?.id`, not `params.id`.",
        },
        {
          lines: [28, 29],
          title: "Throw to fail",
          body: "This is the only route to `onError`. `return` on a bad input looks like success to the dispatcher, `onSuccess` fires, and the user is told it worked.",
        },
        {
          lines: [30, 32],
          title: "The pretend network call",
          body: "Anything awaited here keeps the action in the provider\u2019s `loadingActions` set, which `useAction` exposes as `isLoading` if you want a spinner on the button.",
        },
        {
          lines: [33, 40],
          title: "setState is a React-style updater",
          body: "`(prev) => next`, not a path write. You get the whole state model and return the whole state model; the page decides how that reaches the store. Build a NEW array \u2014 mutating `prev.invoices` in place would fail the store\u2019s reference check and notify nobody.",
        },
        {
          lines: [41, 43],
          title: "Closing the registry",
          body: "One component map, one action map. A catalog with ten actions has ten entries here and nothing else changes.",
        },
      ],
    },
    {
      path: 'lib/spec.ts',
      lang: 'ts',
      notes: [
        {
          lines: [4, 4],
          title: "The same spec, with behaviour",
          body: "The list and the filter are unchanged. Everything this chapter adds is either an `on` map or an element that one points at.",
        },
        {
          lines: [6, 8],
          title: "Three hops, all data",
          body: "Component emits a NAME. The element maps that name to an action BINDING. The runtime dispatches. Nothing in the chain is a function, which is why a spec can travel over a network.",
        },
        {
          lines: [16, 16],
          title: "Two new children",
          body: "`flash` for the result message, `addBox` for the new-invoice row.",
        },
        {
          lines: [18, 23],
          title: "visible with no operator",
          body: "Bare `{ $state: \"/flash\" }` is a truthiness check, so an empty string hides the element and any message shows it. That is the cheapest conditional in the language.",
        },
        {
          lines: [26, 26],
          title: "A blank line between groups",
          body: "Worth keeping. A spec this size is read far more often than it is written.",
        },
        {
          lines: [48, 48],
          title: "rowActions joins the row",
          body: "Each repeated row now has its own action bar, and every binding inside it resolves in that row\u2019s scope.",
        },
        {
          lines: [77, 82],
          title: "A Stack for the buttons",
          body: "Nothing special \u2014 but note it is inside the repeat, so both buttons below are rendered once per invoice.",
        },
        {
          lines: [83, 89],
          title: "A custom action, guarded by visible",
          body: "`visible` hides the button on a paid invoice. That is presentation, not enforcement: the handler still throws on bad input, because a spec can be edited and a `visible` can be malformed.",
        },
        {
          lines: [90, 93],
          title: "on: { press: binding }",
          body: "The key is the event name your component emitted. Params are resolved in the CURRENT scope before dispatch, so `{ $item: \"id\" }` here is this row\u2019s invoice id \u2014 the same resolution that props get.",
        },
        {
          lines: [94, 98],
          title: "confirm, which works here",
          body: "Because `markPaid` reaches a handler, the dispatcher pauses and `JSONUIProvider` renders its confirmation dialog. `variant: \"danger\"` is the only styling hook.",
        },
        {
          lines: [99, 101],
          title: "onSuccess and onError",
          body: "Two shapes are available: `{ set: { \"/path\": value } }` writes state, `{ action, params }` dispatches another action, and `onSuccess` additionally accepts `{ navigate }`. They fire only for handler-backed actions.",
        },
        {
          lines: [102, 105],
          title: "Closing the button",
          body: "`children: []` on a leaf, as everywhere else.",
        },
        {
          lines: [106, 110],
          title: "A built-in, and the trap",
          body: "`removeState` needs no catalog entry and no handler. It also RETURNS EARLY, before the confirmation dialog \u2014 so the `confirm` two lines down never appears and nothing warns you.",
        },
        {
          lines: [111, 119],
          title: "$index, the row position",
          body: "`removeState` wants `statePath` and `index`. `{ $index: true }` is the sentinel for \"the current repeat index\" \u2014 `true` rather than a path, because an index has no sub-path to navigate.",
        },
        {
          lines: [120, 125],
          title: "The add row",
          body: "Outside the repeat, so `$item` would be meaningless here. Everything below reads global state.",
        },
        {
          lines: [126, 130],
          title: "A bound field for the draft",
          body: "`/draft/ref` exists only to hold what the user is typing. Scratch paths like this are normal; the alternative is a component with private state the spec cannot see.",
        },
        {
          lines: [131, 136],
          title: "pushState",
          body: "The third built-in. It appends to an array and, optionally, clears an input in the same dispatch.",
        },
        {
          lines: [137, 146],
          title: "$id, and what resolves where",
          body: "The `value` object is resolved twice: first by the renderer, which turns `{ $state: \"/draft/ref\" }` into the typed text, then by `pushState`, which expands the literal string `\"$id\"` into a fresh unique id. Only `$state` and `$id` survive to that second pass.",
        },
        {
          lines: [147, 152],
          title: "clearStatePath",
          body: "Empties `/draft/ref` in the same dispatch, so the input resets the moment the row is added. Doing it as a second `setState` binding works too and is one more thing to keep in sync.",
        },
      ],
    },
    {
      path: 'app/page.tsx',
      lang: 'tsx',
      notes: [
        {
          lines: [3, 4],
          title: "Two new imports",
          body: "`SetState` is the updater type your handlers are written against. `useMemo` keeps the adapter and the handler map stable across renders.",
        },
        {
          lines: [6, 6],
          title: "handlers, from the registry",
          body: "The factory `defineRegistry` returned. It is the typed bridge between the catalog\u2019s action names and the provider\u2019s handler map.",
        },
        {
          lines: [24, 26],
          title: "Three new seed paths",
          body: "`unpaidOnly` for the filter, `draft.ref` for the new-invoice input, `flash` for the result message. Every path a spec binds should exist in the seed, even as an empty string \u2014 it keeps the first render controlled.",
        },
        {
          lines: [30, 32],
          title: "Two vocabularies, one adapter",
          body: "Handlers speak React: `(prev) => next` over the whole model. Stores speak JSON Pointer: `update({ \"/key\": value })`. This closure is the translation, and it is the only place the two meet.",
        },
        {
          lines: [33, 37],
          title: "The adapter itself",
          body: "Run the updater on the live snapshot, then write back each top-level key. `update` batches into a single notification, and compares each value by reference, so untouched keys are no-ops.",
        },
        {
          lines: [38, 40],
          title: "What this does NOT do",
          body: "Keys the updater REMOVED are not deleted, because the loop only visits keys that are present in `next`. Handlers that set a key to `undefined` rather than deleting it sidestep the whole question.",
        },
        {
          lines: [41, 44],
          title: "Getters, not values",
          body: "`handlers(() => setState, () => store.getSnapshot())`. Passing `store.getSnapshot()` directly would freeze the state your handlers see at mount time \u2014 a bug that only shows up on the second dispatch.",
        },
        {
          lines: [46, 46],
          title: "One new provider prop",
          body: "`handlers`. Built-in actions work without it; the moment a binding names `markPaid`, a missing entry logs \"No handler registered for action\" and does nothing else.",
        },
      ],
    },
  ],
  mistakes: [
    {
      wrong: 'actions: { markPaid: (params, setState) => { setState(…); } }',
      lang: 'tsx',
      why: 'Not async. `ActionFn` returns `Promise<void>`, so this does not compile — and the reason it must is that the dispatcher awaits your promise before choosing `onSuccess` or `onError`.',
    },
    {
      wrong: '{ "action": "setState", "params": { "statePath": "/flash", "value": "" },\n  "confirm": { "title": "Sure?", "message": "…" } }',
      lang: 'json',
      why: 'Built-ins return before the confirmation is reached. The dialog never appears, the write happens immediately, and nothing logs a warning. Wrap it in a custom action if you need the prompt.',
    },
    {
      wrong: '{ "props": { "on": { "press": { "action": "markPaid" } } } }',
      lang: 'json',
      why: '`on` belongs beside props, not inside. Inside props it is an unknown prop your Button ignores, so the click does nothing. `validateSpec` reports `on_in_props` and `autoFixSpec` moves it.',
    },
    {
      wrong: 'markPaid: async (params, setState) => {\n  if (!params?.id) return;\n  …\n}',
      lang: 'tsx',
      why: 'Returning early looks like SUCCESS to the dispatcher, so `onSuccess` fires and the user is told it worked. Throw instead — that is the only route to `onError`.',
    },
    {
      wrong: 'const actionHandlers = handlers(setState, store.getSnapshot());',
      lang: 'tsx',
      why: '`handlers` takes getters, not values: `handlers(() => setState, () => store.getSnapshot())`. Passing a snapshot freezes the state your handler sees at mount time.',
    },
  ],
  tryIt: {
    instruction: 'Press "Mark paid" and confirm — the badge flips and the flash line appears. Now press "Remove", which is a built-in with a confirm on it.',
    check: 'The custom action asks first; the built-in does not, even though both bindings declare `confirm`.',
  },
  refs: ['act-binding', 'util-defineregistry'],
  steps: ['actions', 'build-check'],
};
