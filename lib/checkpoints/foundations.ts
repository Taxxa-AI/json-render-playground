import type { Spec } from '@json-render/core';
import type { Quiz } from './types';

/**
 * Foundations — the three nouns.
 *
 * Verified with scratchpad/verify-checkpoints.ts (F1–F8) and
 * verify-checkpoints-2.ts (F9–F13) against @json-render/core 0.20.0:
 * `validateSpec`, `autoFixSpec`, `catalog.validate`, `catalog.prompt`,
 * and @json-render/react `Renderer`.
 */
export const foundationsQuiz: Quiz = {
  group: 'Foundations',
  slug: 'foundations',
  intro: 'Spec, catalog, registry — and the four ways a beginner breaks each one.',
  questions: [
    {
      kind: 'choice',
      id: 'f-children-keys',
      prompt: 'An element has "children": ["m1", "m2"]. What are "m1" and "m2"?',
      options: [
        'Keys into the same spec.elements map',
        'Nested element objects, inlined for brevity',
        'Component type names from the catalog',
        'JSON Pointer paths into spec.state',
      ],
      answer: 0,
      explain:
        'The spec is flat. Children are keys, and the renderer assembles the tree by pointer-chasing from root. That is exactly why streaming works: one element is one patch, and it can arrive before or after its parent.',
      step: 'shape',
      ref: 'el-children',
    },
    {
      kind: 'spot',
      id: 'f-missing-child',
      prompt: 'Which issue does validateSpec report for this spec?',
      // Verified: validateSpec(...).issues.map(i => i.code) === ['missing_child'] (F2).
      spec: {
        root: 'card',
        elements: {
          card: { type: 'Card', props: { title: 'Invoice', subtitle: null }, children: ['total', 'lines'] },
          total: { type: 'Metric', props: { label: 'Total', value: '€480', delta: null, tone: null }, children: [] },
        },
      } as Spec,
      options: ['missing_child', 'orphaned_element', 'root_not_found', 'no issue — it renders wrong silently'],
      answer: 0,
      explain:
        'Every key in a children array must resolve to a defined element. "lines" does not, so validateSpec reports missing_child as an error. At runtime that branch simply does not render and the console warns — no throw.',
      step: 'shape',
      ref: 'util-validatespec',
    },
    {
      kind: 'spot',
      id: 'f-orphan',
      prompt: 'Element "stray" is never referenced. What does validateSpec report — with checkOrphans: true?',
      // Verified: with checkOrphans it yields one 'orphaned_element' of severity
      // 'warning', and result.valid stays TRUE (F3b). Without the option: [] (F3).
      checkOrphans: true,
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: 'Dashboard', subtitle: null }, children: ['note'] },
          note: { type: 'Text', props: { value: 'All good.', tone: null, size: null }, children: [] },
          stray: { type: 'Badge', props: { label: 'Orphan', tone: 'danger' }, children: [] },
        },
      } as Spec,
      options: [
        'A warning — and the spec is still valid',
        'An error — valid is false',
        'Nothing; orphans are only reported at runtime',
        'missing_child, because nothing points at it',
      ],
      answer: 0,
      explain:
        'Orphan checking is off by default because an unreachable element is harmless — it just never renders. Turn it on and you get severity "warning", and valid stays true, because validateSpec only fails on errors.',
      step: 'shape',
      ref: 'util-validatespec',
    },
    {
      kind: 'predict',
      id: 'f-slots-default',
      prompt:
        'Card declares slots ["default", "footer"]. This spec puts its text in slots.default. Where does "Paid in full" appear?',
      // Verified by rendering: the renderer passes slots.default through as
      // slots.default and warns; the demo Card reads `children` and
      // `slots.footer` only, so the text renders nowhere.
      spec: {
        root: 'card',
        elements: {
          card: {
            type: 'Card',
            props: { title: 'Invoice', subtitle: null },
            children: [],
            slots: { default: ['paid'] },
          },
          paid: { type: 'Text', props: { value: 'Paid in full', tone: 'success', size: null }, children: [] },
        },
      } as Spec,
      options: [
        'Nowhere — the card body is empty',
        'In the card body, same as children',
        'In the card footer',
        'It throws: "default" is not a valid slot name',
      ],
      answer: 0,
      explain:
        'There is no slots.default. The default slot IS the children array, and a component receives it as the React `children` prop. Put content in slots.default and the renderer hands it to the component as slots.default, which nothing reads — so it silently disappears. The console warns; the page does not.',
      step: 'registry',
      ref: 'el-slots',
    },
    {
      kind: 'predict',
      id: 'f-fallback',
      prompt: 'The catalog has no "Table" component. What renders in its place?',
      spec: {
        root: 'stack',
        elements: {
          stack: { type: 'Stack', props: { direction: 'column', gap: 'md', align: null, wrap: null }, children: ['t', 'note'] },
          t: { type: 'Table', props: { rows: 3 }, children: [] },
          note: { type: 'Text', props: { value: 'Everything below still renders.', tone: null, size: null }, children: [] },
        },
      } as Spec,
      options: [
        'The fallback component passed to <Renderer>',
        'Nothing, and the rest of the tree is skipped too',
        'A thrown error caught by the nearest error boundary',
        'The first component in the catalog',
      ],
      answer: 0,
      explain:
        'An unknown type falls back to <Renderer fallback>. Omit fallback and the element renders null with a console warning — so an unknown component is invisible, not fatal. Siblings are unaffected.',
      step: 'registry',
      ref: 'prov-renderer',
    },
    {
      kind: 'choice',
      id: 'f-spec-state',
      prompt: 'A generated spec includes a top-level "state" object. What does <Renderer> do with it?',
      options: [
        'Nothing — it never reads spec.state',
        'Seeds the store with it on mount',
        'Merges it into the store, letting existing values win',
        'Validates it against the catalog and then seeds the store',
      ],
      answer: 0,
      explain:
        'This is the single most expensive surprise in the library. The AI prompt instructs the model to fill spec.state, and the renderer ignores it completely — you seed the store yourself from spec.state, or a perfectly valid generated UI renders as an empty shell.',
      step: 'state',
      ref: 'el-state',
    },
    {
      kind: 'choice',
      id: 'f-description',
      prompt: 'What does the model actually see when you call catalog.prompt()?',
      options: [
        'Each component name, its description, and its props formatted from the Zod schema',
        'The React source of every registry component',
        'The TypeScript types inferred from your registry',
        'Only the component names — the model infers props from examples',
      ],
      answer: 0,
      explain:
        'catalog.prompt() walks the catalog and serialises names, descriptions, slots, examples and Zod-formatted props. The model never sees your React. That is why a description is documentation for a reader who cannot read your source, and why a vague one produces vague UI.',
      step: 'catalog',
      ref: 'util-catalogprompt',
    },
    {
      kind: 'choice',
      id: 'f-nullable',
      prompt: 'Why does the demo catalog prefer z.string().nullable() over z.string().optional() for optional props?',
      options: [
        'Structured output is more reliable emitting an explicit null than omitting a key',
        'optional() is not supported by defineCatalog',
        'nullable() makes the prop required in TypeScript',
        'optional() breaks JSON Patch streaming',
      ],
      answer: 0,
      explain:
        'Both compile. But strict JSON Schema for structured output lists every property in required and expresses optionality as a nullable type, so a model asked for an explicit null is on a much better-trodden path than one asked to leave a key out. A nullable field also survives a JSON round-trip unchanged.',
      step: 'catalog',
      ref: 'util-definecatalog',
    },
    {
      kind: 'choice',
      id: 'f-catalog-validate',
      prompt:
        'catalog.validate(spec) returns success: true for an element of type "Badge" whose props are { label: 42, bogus: true }. Why?',
      // Verified (F6/F6b): buildZodType maps propsOf → z.record(z.string(), z.unknown())
      // whenever the catalog has more than one component. Unknown `type` still fails.
      options: [
        'With more than one component in the catalog, props are typed as an open record — only `type` is checked',
        'Zod coerces 42 to "42" before validating',
        'validate() only runs in development builds',
        'Extra props are stripped, and label is optional',
      ],
      answer: 0,
      explain:
        'The schema declares props as propsOf("catalog.components"). With one component that resolves to that component\'s Zod schema; with several, there is no way to pick one per element, so it becomes a record of unknown. Element `type` is still checked against the catalog enum. Treat catalog.validate as a shape check, not a props check.',
      step: 'catalog',
      ref: 'util-catalogvalidate',
    },
    {
      kind: 'spot',
      id: 'f-visible-in-props',
      prompt: 'The author wanted this badge hidden until /paid is true. Which issue does validateSpec report?',
      // Verified: ['visible_in_props'] (F4).
      spec: {
        root: 'row',
        elements: {
          row: { type: 'Stack', props: { direction: 'row', gap: 'sm', align: null, wrap: null }, children: ['b'] },
          b: { type: 'Badge', props: { label: 'Paid', tone: 'success', visible: { $state: '/paid' } }, children: [] },
        },
      } as unknown as Spec,
      options: ['visible_in_props', 'invalid_visible', 'no issue — it renders wrong silently', 'missing_child'],
      answer: 0,
      explain:
        'visible, on, repeat and watch are element-level fields, siblings of type and props. Inside props they are inert: they reach your component as an unknown prop and nothing hides anything. validateSpec has a dedicated code for each, and autoFixSpec moves all four back out losslessly.',
      step: 'shape',
      ref: 'el-visible',
    },
    {
      kind: 'choice',
      id: 'f-registry-join',
      prompt: 'You add a component to the catalog and nothing else. What happens?',
      options: [
        'defineRegistry stops compiling until you implement it',
        'It renders as the fallback until you implement it',
        'Nothing — the registry is looked up by name at runtime',
        'catalog.prompt() throws on the next call',
      ],
      answer: 0,
      explain:
        'defineRegistry(catalog, …) is the compile-time join between the two. Components is typed as a map over the catalog\'s component names, with props inferred from each Zod schema, so a new catalog entry is a type error until the implementation lands.',
      step: 'registry',
      ref: 'util-defineregistry',
    },
  ],
};
