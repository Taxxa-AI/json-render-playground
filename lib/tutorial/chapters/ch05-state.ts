import type { Chapter } from '../types';

export const ch05: Chapter = {
  slug: 'state',
  n: 5,
  title: 'State & binding',
  goal: 'Add two controls and learn the difference between reading state and writing it.',
  minutes: 12,
  why: [
    'The state model is one JSON object addressed by JSON Pointer. `/draft/note` is nesting, not a key containing a slash. There is no store per component and no selector API — one model, one set of paths.',
    'Reading is `{ $state: "/path" }`. Writing needs `{ $bindState: "/path" }`, which resolves to the same value AND puts the resolved path into a `bindings` map the renderer hands your component. `useBoundProp(props.value, bindings?.value)` turns that pair into the `[value, setValue]` you already know.',
    'So a literal prop is read-only, and that is the single most common "my input will not type" bug. `value: "hello"` renders "hello" and every keystroke is dropped, because there is nowhere to write to. Nothing warns you.',
    'Three files change: the catalog gains two entries, the components file gains two implementations, and the spec gains two elements.',
  ],
  files: [
    {
      path: 'lib/catalog.ts',
      lang: 'ts',
      notes: [
        {
          lines: [53, 56],
          title: 'TextField, and a description aimed at the model',
          body: 'The description names the expression the model should reach for. Descriptions that say what a component IS are half a description; the useful half says how to wire it.',
        },
        {
          lines: [57, 61],
          title: 'value is nullable, not required',
          body: 'An input that has never been filled in has no value. Making it `.nullable()` means the spec can say `null` instead of inventing an empty string, and your component handles one case either way.',
        },
        {
          lines: [62, 64],
          title: 'A LITERAL example, on purpose',
          body: 'The example shows `value: \'\'`, not a `$bindState` object. Examples are sample PROPS, and putting an expression here would teach the model that the empty string and the binding are interchangeable. The description carries the binding advice instead.',
        },
        {
          lines: [65, 74],
          title: 'Toggle',
          body: 'Same shape, boolean instead of string. `checked` is nullable because a filter that has never been touched is genuinely unset, and your component coerces it once with `Boolean(...)`.',
        },
      ],
    },
    {
      path: 'lib/components.tsx',
      lang: 'tsx',
      notes: [
        {
          lines: [3, 3],
          title: 'useBoundProp joins the import',
          body: 'It is a value now, not just a type, so the import mixes `type Components` with the runtime hook. One line, two kinds of import — `import { type X, y }` keeps it to one statement.',
        },
        {
          lines: [62, 64],
          title: 'One expression, two outputs',
          body: '`{ $bindState: "/draft/note" }` gives your component the VALUE in `props.value` and the PATH in `bindings.value`. `$state` gives you only the first, which is why it cannot be written.',
        },
        {
          lines: [65, 66],
          title: 'useBoundProp(value, path)',
          body: 'Not a state path string and not a selector: the already-resolved value, and the binding entry for that prop name. When `bindings?.value` is undefined the setter is a silent no-op — which is precisely the "my input will not type" failure, seen from the inside.',
        },
        {
          lines: [67, 71],
          title: 'A label element, not aria plumbing',
          body: 'Wrapping the input in its label is the cheapest correct association. The catalog made `label` required, so there is always something to show.',
        },
        {
          lines: [72, 77],
          title: 'A controlled input',
          body: '`value ?? \'\'` keeps React in controlled mode even when the bound path is missing. `placeholder ?? undefined` is deliberate too: passing `null` to a DOM attribute renders nothing, but `undefined` omits it, which is what you want.',
        },
        {
          lines: [78, 81],
          title: 'Hooks here must be unconditional',
          body: 'The registry INVOKES your function inside its own render rather than mounting it as an element, so the hooks you call become part of that component\'s hook order. An early `return null` before `useBoundProp` would change the order between renders and React would throw.',
        },
        {
          lines: [82, 83],
          title: 'The same pattern, typed boolean',
          body: '`useBoundProp<boolean>` with `bindings?.checked`. The generic is the prop type, not the state type — they are the same thing here because the binding points at exactly this value.',
        },
        {
          lines: [84, 96],
          title: 'Boolean(checked), once',
          body: '`checked` is `boolean | null`. React treats `null` as uncontrolled and logs a warning the first time it flips to a real boolean, so coerce at the boundary and never think about it again.',
        },
      ],
    },
    {
      path: 'lib/spec.ts',
      lang: 'ts',
      notes: [
        {
          lines: [6, 8],
          title: 'Read versus read-write',
          body: 'The whole chapter in three lines. `$state` reads. `$bindState` reads and returns a write path. Everything else follows from that.',
        },
        {
          lines: [16, 16],
          title: 'Two more children',
          body: 'Order in this array is render order. There is no z-index, no slot priority — the array is the layout.',
        },
        {
          lines: [23, 27],
          title: 'The filter Toggle',
          body: '`{ $bindState: "/unpaidOnly" }` on `checked`. The path does not exist in the seed until you add it, and an unseeded boolean path reads as `undefined` — which coerces to unchecked, then becomes a real boolean on first click.',
        },
        {
          lines: [28, 36],
          title: 'A nested pointer',
          body: '`/draft/note` addresses `{ draft: { note: … } }`. The store creates intermediate objects on write, so binding to a path whose parent is missing works — but seeding `draft: { note: \'\' }` keeps the first render controlled.',
        },
        {
          lines: [37, 41],
          title: 'The echo, reading the same path',
          body: 'Two elements on one path: one writes, one reads. This is how a spec shares state between components, and it is why there is no prop-drilling story in json-render.',
        },
      ],
    },
  ],
  mistakes: [
    {
      wrong: '{ "type": "TextField", "props": { "label": "Note", "value": "hello" } }',
      lang: 'json',
      why: 'A literal is read-only. The field shows "hello", `bindings` is undefined, `setValue` is a no-op, and typing does nothing. No error, no warning.',
    },
    {
      wrong: '{ "value": { "$state": "/draft/note" } }',
      lang: 'json',
      why: 'Reads correctly and still cannot be written. `$state` does not populate `bindings`. For any control the user edits, use `$bindState`.',
    },
    {
      wrong: 'const [value, setValue] = useBoundProp<string>(props.value, "/draft/note");',
      lang: 'tsx',
      why: 'Hard-coding the path defeats the point: the same component in a list would write every row to the same place. Pass `bindings?.value` and let the renderer resolve it.',
    },
    {
      wrong: '{ "value": { "$bindState": "draft/note" } }',
      lang: 'json',
      why: 'JSON Pointer paths start with `/`. Without it the lookup misses, the field reads blank, and the write lands under a path you will not find in the devtools.',
    },
    {
      wrong: 'Toggle: ({ props }) => <input type="checkbox" checked={props.checked} />',
      lang: 'tsx',
      why: 'Two bugs. Without `bindings` it can never write, and `checked` is `boolean | null`, so React logs the controlled/uncontrolled warning the first time it is null.',
    },
  ],
  tryIt: {
    instruction: 'Type in the Draft note field and watch the muted line below it follow. Then, in the spec editor, change the note field\'s `$bindState` to `$state` and try typing again.',
    check: 'With `$state` the field is frozen; with `$bindState` it types. Same value, different capability.',
  },
  refs: ['expr-bindstate', 'hook-useboundprop'],
  steps: ['state', 'expressions', 'hooks'],
};
