import type { Chapter } from '../types';

export const ch08: Chapter = {
  slug: 'validation',
  n: 8,
  title: 'Validation',
  goal: 'Put checks in the spec, run them in the component, and learn what validateForm will not do for you.',
  minutes: 14,
  why: [
    'Validation is data. A field carries a `checks` array; each check names a function, carries its args and its own message. The function itself is either built in (`minLength`, `email`, `pattern`, `matches`, …) or one you registered on the provider as `validationFunctions`.',
    'Nothing runs automatically. `useFieldValidation(path, config)` registers the field and gives you `validate()`, `touch()` and `errors` — your component decides when to call them. The `validateOn` field in the config is advisory: the library stores it and compares it, and never acts on it.',
    'Validation is keyed by STATE PATH, not by element key. An unbound field has no path and therefore cannot take part in a form-wide validate. That is not a limitation so much as a definition: there is nothing to validate if there is nothing being written.',
    'And the big one: `validateForm` REPORTS, it does not BLOCK. It runs every registered field, writes `{ valid, errors }` to a state path, and returns. If it is first in an array of bindings, the second binding still runs. Enforcement is yours — read the result, or check inside your handler.',
  ],
  files: [
    {
      path: 'lib/catalog.ts',
      lang: 'ts',
      notes: [
        {
          lines: [82, 83],
          title: "Validation is a prop",
          body: "Not a separate registry, not a hook config \u2014 an ordinary prop on the component, which means a model can emit it and a compiler can derive it.",
        },
        {
          lines: [84, 92],
          title: "The check shape",
          body: "`type` names a function, `args` feeds it, `message` is shown when it fails. `args` is a nullable record rather than a typed union because every check takes different arguments; the runtime resolves `{ $state: \"/path\" }` inside it, so a rule can compare two fields.",
        },
        {
          lines: [93, 100],
          title: "An example with a real check",
          body: "Putting one worked check in the example is what teaches a model the `{ type, args, message }` shape. Without it, expect `checks: [\"required\"]`.",
        },
      ],
    },
    {
      path: 'lib/components.tsx',
      lang: 'tsx',
      notes: [
        {
          lines: [3, 5],
          title: "Three new imports",
          body: "`ValidationConfig` types the object you hand the hook. `useFieldValidation` is the hook. `useMemo` keeps the config stable \u2014 see below for why that matters.",
        },
        {
          lines: [103, 107],
          title: "Path, not element key",
          body: "Validation is registered under a STATE PATH. A field with no binding has no path, so `useFieldValidation(\"\")` registers nothing and `validateForm` will never see it. Checks without a binding are decoration.",
        },
        {
          lines: [108, 111],
          title: "Why useMemo",
          body: "The hook registers the field in an effect that depends on `config`. A fresh object every render re-runs that effect on every keystroke. It cannot loop \u2014 the library compares configs by deep equality and bails \u2014 but memoising is free.",
        },
        {
          lines: [112, 115],
          title: "Mapping checks to the config",
          body: "`args: c.args ?? undefined` because the catalog says `null` and the library wants the key absent. One line of translation at the boundary beats a nullable type spreading inward.",
        },
        {
          lines: [116, 122],
          title: "validateOn does nothing on its own",
          body: "The library stores it and compares it and never acts on it. It is a note to your component, which is the thing that decides when to call `validate()`.",
        },
        {
          lines: [123, 125],
          title: "What the hook gives back",
          body: "`errors` (string messages), `validate()`, `touch()`, `clear()`, `isValid` and the raw `state`. None of them run by themselves.",
        },
        {
          lines: [135, 138],
          title: "Validate on blur",
          body: "`touch()` marks the field as visited, `validate()` runs the checks and stores the result. Doing this on `change` instead means an error appears on the first character typed, which reads as hostile.",
        },
        {
          lines: [139, 145],
          title: "Errors drive the border",
          body: "The visual state comes from `errors.length`, not from a separate `isDirty` flag. One source of truth.",
        },
        {
          lines: [146, 150],
          title: "Show the first error only",
          body: "`errors` is every failing check. Showing them all stacks three lines under a field the user has not finished typing in; showing the first is almost always enough.",
        },
      ],
    },
    {
      path: 'lib/spec.ts',
      lang: 'ts',
      notes: [
        {
          lines: [6, 8],
          title: "Two things are named, not written",
          body: "Events name actions. Checks name validation functions. In both cases the spec carries the name and the provider carries the code.",
        },
        {
          lines: [16, 16],
          title: "Two more children",
          body: "`saveRow` holds the submit button, `invalidHint` reads the result that `validateForm` writes.",
        },
        {
          lines: [74, 76],
          title: "Built-in and custom, side by side",
          body: "`minLength` ships with the library. `notPlaceholder` is registered on the provider. A `type` matching neither is logged once and counted as PASSING \u2014 so a typo here does not fail the field, it silently stops validating it.",
        },
        {
          lines: [77, 80],
          title: "args, and null for none",
          body: "`{ min: 4 }` reaches the built-in as its arguments. `args: null` on the second check is explicit rather than omitted, keeping the JSON shape identical across every check.",
        },
        {
          lines: [160, 165],
          title: "A row for the submit",
          body: "Outside the repeat, so there is exactly one save button for the whole list.",
        },
        {
          lines: [166, 169],
          title: "An array of bindings",
          body: "`press` accepts one binding or an array. An array runs in order, each awaited before the next \u2014 which reads like a guard and is not one.",
        },
        {
          lines: [170, 177],
          title: "validateForm does not block",
          body: "It runs every registered field, writes `{ valid, errors }` to `statePath` (defaulting to `/formValidation`), and returns. The `setState` on the next line runs whether or not anything was valid. Enforcement belongs in your handler.",
        },
        {
          lines: [178, 181],
          title: "The button itself",
          body: "Nothing special. All the behaviour is in the binding array above it.",
        },
        {
          lines: [182, 187],
          title: "Reading the result back",
          body: "`/formValidation/valid` is the boolean `validateForm` wrote. `eq: false` rather than a bare truthiness check, because before the first submit the path is undefined \u2014 and `undefined` is not `false`, so the hint stays hidden until somebody actually submits.",
        },
      ],
    },
    {
      path: 'app/page.tsx',
      lang: 'tsx',
      notes: [
        {
          lines: [46, 49],
          title: "The provider, prop by prop",
          body: "Three so far: contexts for components, the store, the action handlers.",
        },
        {
          lines: [50, 54],
          title: "validationFunctions",
          body: "A map of plain predicates, `(value, args) => boolean`, looked up by the `type` string in a field\u2019s checks. Synchronous \u2014 an async predicate returns a Promise, which is always truthy, so the check always passes.",
        },
        {
          lines: [55, 59],
          title: "Unchanged below",
          body: "The renderer and the fallback are exactly as they were. Validation added a provider prop and a component hook, and touched nothing else.",
        },
      ],
    },
  ],
  mistakes: [
    {
      wrong: '"on": { "press": [ { "action": "validateForm" }, { "action": "submit" } ] }',
      lang: 'json',
      why: 'Reads like a guard and is not one. `validateForm` writes its result and returns; `submit` runs regardless. Read `/formValidation/valid` in the submit handler, or do the check there.',
    },
    {
      wrong: '{ "checks": [ { "type": "minLenght", "args": { "min": 4 }, "message": "Too short." } ] }',
      lang: 'json',
      why: 'A typo in `type` is not an error. An unknown validation function is logged once and counted as PASSING, so the field is permanently valid and nothing ever fires.',
    },
    {
      wrong: 'const { errors } = useFieldValidation(path, { checks: props.checks, validateOn: "blur" });',
      lang: 'tsx',
      why: 'A fresh config object every render. It cannot loop — the library de-duplicates by deep equality — but the registering effect re-runs on every keystroke. Memoise on `props.checks`.',
    },
    {
      wrong: '{ "type": "TextField", "props": { "label": "Note", "value": "", "checks": [ … ] } }',
      lang: 'json',
      why: 'No binding, so no state path, so `useFieldValidation("")` registers nothing and `validateForm` will never see this field. Checks need `$bindState` or `$bindItem` to mean anything.',
    },
    {
      wrong: 'validationFunctions={{ notPlaceholder: async (value) => { … } }}',
      lang: 'tsx',
      why: 'A validation function is a synchronous predicate: `(value, args) => boolean`. An async one returns a Promise, which is always truthy, so the check always passes.',
    },
  ],
  tryIt: {
    instruction: 'Clear a note field and tab out — the error appears under it. Now press "Save all notes" with a field still invalid.',
    check: 'The flash says it saved. Validation reported the problem and did not stop anything.',
  },
  refs: ['val-usefieldvalidation', 'act-binding'],
  steps: ['validation', 'build-check'],
};
