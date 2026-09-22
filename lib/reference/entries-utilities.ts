import type { ReferenceEntry } from './types';

const DEMO_SPEC = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: 'Hi', subtitle: null }, children: ['t', 'ghost'] },
    t: { type: 'Text', props: { value: 'body', tone: null, size: null, visible: true }, children: [] },
  },
};

const BROKEN_SPEC_TEXT = JSON.stringify(DEMO_SPEC, null, 2);

/**
 * Core utilities, plus the three catalog methods. Every name below was checked
 * against the export list of node_modules/@json-render/core/dist/index.d.ts
 * (and index.mjs), with two exceptions noted in their entries:
 *   - flatToTree ships in @json-render/react, not core
 *   - createStoreAdapter ships on the "@json-render/core/store-utils" subpath
 */
export const UTILITY_ENTRIES: ReferenceEntry[] = [
  {
    id: 'util-definecatalog',
    category: 'Core utilities',
    name: 'defineCatalog',
    signature: `import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";

export const catalog = defineCatalog(schema, {
  components: { Card: { props: z.object({ title: z.string().nullable() }),
                        slots: ["default"], description: "…", example: { title: "Invoice" } } },
  actions:    { submit: { params: z.object({}), description: "…" } },
});`,
    lang: 'typescript',
    summary: 'Bind a schema to your component and action definitions. The result is both a compile-time contract and a runtime prompt.',
    details: [
      'Component entries take `props` (a Zod schema), `slots`, `description` and `example`. Only `props` is required by the type.',
      '`description` is documentation for the model, which never sees your React. `example` seeds the prompt\'s example props, and is auto-generated from the Zod schema when omitted.',
      'The returned object exposes `componentNames`, `actionNames`, `prompt()`, `jsonSchema()`, `validate()`, `zodSchema()` and the `_specType` helper.',
      'Prefer `.nullable()` over `.optional()`: structured output is happier emitting an explicit null than omitting a key.',
      '`defineRegistry(catalog, …)` then REQUIRES an implementation for every component, and requires `actions` when the catalog declares any.',
    ],
    related: ['util-defineregistry', 'util-defineschema', 'util-catalogprompt', 'util-catalogvalidate'],
    step: 'build-catalog',
    tags: ['defineCatalog', 'catalog'],
  },
  {
    id: 'util-defineregistry',
    category: 'Core utilities',
    name: 'defineRegistry',
    signature: `import { defineRegistry } from "@json-render/react";

const { registry, handlers, executeAction } = defineRegistry(catalog, {
  components: { Card: ({ props, children }) => <div>{props.title}{children}</div> },
  actions:    { submit: async (params, setState, state) => { … } },
});`,
    lang: 'tsx',
    summary: 'The compile-time join between catalog and code. Returns a registry, an ActionProvider-shaped handlers factory, and an imperative executeAction.',
    details: [
      'Exported by @json-render/react, not core.',
      'When the catalog declares actions, the `actions` field is REQUIRED by the type (`CatalogHasActions`). A catalog with `actions: {}` may omit it.',
      'Action handlers must be async: `ActionFn` returns `Promise<void>`, because the dispatcher awaits before choosing onSuccess or onError.',
      '`handlers(getSetState, getState)` takes GETTERS, so handlers always read the latest state — pass refs, not values.',
      '`executeAction(name, params, setState, state?)` fires an action outside the React tree, e.g. during initial load.',
    ],
    related: ['util-definecatalog', 'prov-jsonuiprovider', 'prov-createrenderer'],
    step: 'build-component',
    tags: ['defineRegistry', 'registry'],
  },
  {
    id: 'util-defineschema',
    category: 'Core utilities',
    name: 'defineSchema',
    signature: `const schema = defineSchema(
  (s) => ({ spec: s.object({ root: s.string(), elements: s.record(…) }),
            catalog: s.object({ components: s.map({ props: s.zod(), … }) }) }),
  { defaultRules: ["…"], builtInActions: [{ name: "setState", description: "…" }], promptTemplate },
);`,
    lang: 'typescript',
    summary: 'Describe what a spec looks like and what a catalog must provide. You almost never call this — @json-render/react exports one.',
    details: [
      'Builder primitives: string, number, boolean, array, object, record, any, zod, ref, propsOf, map, optional.',
      '`s.ref("catalog.components")` types an element\'s `type` as the union of your component names; `s.propsOf("catalog.components")` types its props.',
      '`defaultRules` are prompt rules baked into the schema and injected BEFORE any `customRules`. The React schema ships twelve of them.',
      '`builtInActions` is what makes the model aware of setState / pushState / removeState / validateForm without any handler. Note `push` and `pop` are implemented but NOT listed here.',
      '`schema.createCatalog(catalog)` is the same thing as `defineCatalog(schema, catalog)`.',
    ],
    related: ['util-definecatalog', 'util-catalogprompt', 'act-pushpop'],
    step: 'build-catalog',
    tags: ['defineSchema', 'schema'],
  },
  {
    id: 'util-catalogprompt',
    category: 'Core utilities',
    name: 'catalog.prompt()',
    signature: `catalog.prompt({
  system?: string;
  customRules?: string[];
  mode?: "standalone" | "inline";      // "generate" / "chat" are deprecated aliases
  editModes?: Array<"patch" | "merge" | "diff">;   // default ["patch"]
  directives?: DirectiveDefinition[];
}): string`,
    lang: 'typescript',
    summary: 'Serialize the catalog into the system prompt the model sees. This is the runtime half of a catalog.',
    details: [
      'It walks every component\'s Zod schema, description, slots and example. Your descriptions ARE the docs the model reads.',
      '`mode: "standalone"` tells the model to output only JSONL patches; `"inline"` lets it interleave prose, for chat.',
      '`editModes` documents the refinement formats: RFC 6902 patch, RFC 7396 merge, or unified diff.',
      'Pass the same `directives` array you pass at runtime, or the model never learns your custom `$`-keys exist.',
      'Every component you add grows this string, and you pay for it on every request. Run it and look at the size.',
    ],
    run: { label: 'PromptOptions', input: JSON.stringify({ mode: 'standalone', editModes: ['patch'] }, null, 2), fn: 'catalogPrompt' },
    related: ['util-definecatalog', 'util-builduserprompt', 'util-catalogjsonschema'],
    step: 'catalog',
    tags: ['prompt', 'catalog', 'tokens'],
  },
  {
    id: 'util-catalogvalidate',
    category: 'Core utilities',
    name: 'catalog.validate()',
    signature: `catalog.validate(spec: unknown): {
  success: boolean;
  data?: InferSpec<…>;
  error?: z.ZodError;
}`,
    lang: 'typescript',
    summary: 'Zod-parse a spec against the catalog. This is the check that knows your component names and prop types.',
    details: [
      'On success the result is `{ success: true, data }` — the `error` key is absent, not undefined-valued.',
      'On failure it is `{ success: false, error }`, a real `ZodError` with an `issues` array.',
      'It checks TYPES and PROPS. `validateSpec` checks STRUCTURE (dangling keys, misplaced fields) and knows nothing about your catalog. Run both.',
      'It validates against the schema\'s spec shape, which requires `children` on every element — so it is stricter than the renderer.',
      'It does not validate action params or `on` bindings.',
    ],
    run: { label: 'spec', input: BROKEN_SPEC_TEXT, fn: 'catalogValidate' },
    related: ['util-validatespec', 'util-definecatalog', 'el-type'],
    step: 'build-check',
    tags: ['validate', 'zod', 'catalog'],
  },
  {
    id: 'util-catalogjsonschema',
    category: 'Core utilities',
    name: 'catalog.jsonSchema()',
    signature: `catalog.jsonSchema({ strict?: boolean }): object`,
    lang: 'typescript',
    summary: 'Export the spec shape as JSON Schema, for providers that take a structured-output schema. It exists in 0.20.0.',
    details: [
      'Returns a plain object with `type`, `properties`, `required` and `additionalProperties` at the top level.',
      '`strict: true` produces the LLM-structured-output subset: `additionalProperties: false` everywhere, every property listed in `required`, optionals expressed as nullable types.',
      'Documented limitation: record types (dynamic-key maps) CANNOT be represented in strict mode. `elements` comes out as an opaque `{ type: "object", properties: {}, additionalProperties: false }`.',
      'That is why the prompt still matters — `catalog.prompt()` describes the structure the JSON Schema cannot.',
      'For json-render\'s own JSONL streaming you do not need this at all.',
    ],
    run: { label: 'JsonSchemaOptions', input: JSON.stringify({ strict: true }, null, 2), fn: 'catalogJsonSchema' },
    related: ['util-catalogprompt', 'util-catalogvalidate'],
    step: 'catalog',
    tags: ['jsonSchema', 'structured output'],
  },
  {
    id: 'util-validatespec',
    category: 'Core utilities',
    name: 'validateSpec',
    signature: `validateSpec(spec: Spec, options?: { checkOrphans?: boolean }): {
  valid: boolean;
  issues: Array<{ severity: "error" | "warning"; message: string; elementKey?: string; code: SpecIssueCode }>;
}`,
    lang: 'typescript',
    summary: 'Structural validation. Catches the thirteen ways an AI-generated spec is broken without being invalid JSON.',
    details: [
      'All thirteen codes: missing_root, root_not_found, empty_spec, missing_child, repeat_without_children, repeat_item_outside_scope, repeat_state_mismatch, invalid_visible, visible_in_props, on_in_props, repeat_in_props, watch_in_props, orphaned_element.',
      '`missing_root` and `empty_spec` RETURN EARLY — you get one issue and nothing else is checked.',
      '`valid` is false only when there is an ERROR. `orphaned_element` is the one warning, and it is off unless you pass `checkOrphans: true`.',
      '`repeat_state_mismatch` only fires when `spec.state` is present, because that is the only array it can look at.',
      'It knows nothing about your catalog: an unknown component `type` passes clean. Pair it with `catalog.validate`.',
    ],
    run: { label: 'spec', input: BROKEN_SPEC_TEXT, fn: 'validateSpec' },
    related: ['util-autofixspec', 'util-formatspecissues', 'util-catalogvalidate', 'el-children'],
    step: 'repair',
    tags: ['validateSpec', 'issues', 'repair'],
  },
  {
    id: 'util-autofixspec',
    category: 'Core utilities',
    name: 'autoFixSpec',
    signature: `autoFixSpec(spec: Spec, options?: { lossy?: boolean }): {
  spec: Spec;
  fixes: string[];
  fixDetails: Array<{ message: string; lossy: boolean }>;
}`,
    lang: 'typescript',
    summary: 'Repair what can be repaired mechanically. Splits its fixes into lossless relocations and lossy pruning.',
    details: [
      'LOSSLESS (always applied): move `visible`, `on`, `repeat` and `watch` out of `props` onto the element. Nothing is lost.',
      'LOSSY (only when `lossy !== false`, which is the default): drop dangling keys from `children` and from every named slot.',
      'One deliberate exception: a dangling child list on an element that HAS a repeat is left alone when pruning would empty it — the template is assumed to still be streaming.',
      'In a repair loop, pass `lossy: false` while retries remain so the model regenerates the missing element, and only accept the lossy version as a last resort. That is the library\'s own advice, in the type docs.',
      '`fixes` is just `fixDetails.map(f => f.message)` — use `fixDetails` if you care which kind you got.',
      'It never invents elements. A pruned branch stays gone.',
    ],
    run: { label: 'spec', input: JSON.stringify({ root: 'r', elements: { r: { type: 'Screen', props: { visible: true }, children: ['a', 'missing'] }, a: { type: 'Text', props: { value: 'hi' }, children: [] } } }, null, 2), fn: 'autoFixSpec' },
    related: ['util-validatespec', 'util-formatspecissues', 'el-props'],
    step: 'repair',
    tags: ['autoFixSpec', 'repair', 'lossy'],
  },
  {
    id: 'util-formatspecissues',
    category: 'Core utilities',
    name: 'formatSpecIssues',
    signature: `formatSpecIssues(issues: SpecIssue[]): string`,
    lang: 'typescript',
    summary: 'Turn issues into the paragraph you paste back into a repair prompt.',
    details: [
      'It FILTERS OUT warnings. Only errors make it into the string.',
      'No errors → the EMPTY STRING. Test for that before sending a repair turn, or you will re-prompt with nothing.',
      'The output is a header line, "The generated UI spec has the following errors:", then one `- message` per error.',
      'Messages already name the element key and say what to do, which is why they read like instructions.',
    ],
    run: { label: 'spec (issues are computed from it)', input: BROKEN_SPEC_TEXT, fn: 'formatSpecIssues' },
    related: ['util-validatespec', 'util-autofixspec', 'util-builduserprompt'],
    step: 'repair',
    tags: ['formatSpecIssues', 'repair', 'prompt'],
  },
  {
    id: 'util-isnonemptyspec',
    category: 'Core utilities',
    name: 'isNonEmptySpec',
    signature: `function isNonEmptySpec(spec: unknown): spec is Spec`,
    lang: 'typescript',
    summary: 'A type guard for "is there anything here yet". Exactly three conditions.',
    details: [
      'True when `root` is a string, `elements` is a non-null object, and it has at least one key.',
      'It does NOT check that root exists in elements — `{ root: "x", elements: { y: … } }` passes.',
      'An empty root string passes, because `typeof "" === "string"`.',
      'Used by `buildEditUserPrompt` to decide between a fresh generation and a refinement.',
    ],
    run: { label: 'value', input: JSON.stringify({ root: 'main', elements: {} }, null, 2), fn: 'isNonEmptySpec' },
    related: ['util-builduserprompt', 'util-validatespec'],
    step: 'repair',
    tags: ['isNonEmptySpec', 'guard'],
  },
  {
    id: 'util-deepmergespec',
    category: 'Core utilities',
    name: 'deepMergeSpec',
    signature: `deepMergeSpec(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown>`,
    lang: 'typescript',
    summary: 'RFC 7396 JSON Merge Patch. Null deletes, arrays replace, objects recurse. Neither input is mutated.',
    details: [
      '`null` in the patch DELETES the key from the result. That is the whole reason merge patches cannot set a value to null.',
      'Arrays REPLACE, they do not concatenate. `{ tags: ["a"] }` over `{ tags: ["x","y"] }` gives `["a"]`.',
      'Plain objects recurse; everything else replaces.',
      'This is what the `"merge"` edit mode compiles to — the model emits one object with `__json_edit: true`.',
    ],
    run: {
      label: 'base',
      input: JSON.stringify({ root: 'r', elements: { r: { type: 'Screen', props: { title: 'Old', subtitle: 'keep me' } } } }, null, 2),
      labelB: 'patch',
      input2: JSON.stringify({ elements: { r: { props: { title: 'New', subtitle: null } } } }, null, 2),
      fn: 'deepMergeSpec',
    },
    related: ['util-difftopatches', 'util-applyspecstreampatch', 'util-builduserprompt'],
    step: 'refine',
    tags: ['deepMergeSpec', 'RFC 7396', 'merge'],
  },
  {
    id: 'util-difftopatches',
    category: 'Core utilities',
    name: 'diffToPatches',
    signature: `diffToPatches(oldObj, newObj, basePath?: string): JsonPatch[]`,
    lang: 'typescript',
    summary: 'Produce the RFC 6902 operations that turn one object into another.',
    details: [
      'New keys → `add`, changed values → `replace`, removed keys → `remove`.',
      'Arrays are compared SHALLOWLY and replaced atomically. Changing one item emits a `replace` of the whole array, never per-index ops.',
      'Plain objects recurse, so a deep change gives you a deep path.',
      '`basePath` prefixes every emitted path — pass `"/elements"` to diff a sub-tree in place.',
      'Useful for turning "the user edited the spec in an editor" into a patch stream you can log or replay.',
    ],
    run: {
      label: 'from',
      input: JSON.stringify({ root: 'r', elements: { r: { type: 'Screen', props: { title: 'Old' } }, gone: { type: 'Text', props: {} } } }, null, 2),
      labelB: 'to',
      input2: JSON.stringify({ root: 'r', elements: { r: { type: 'Screen', props: { title: 'New' } }, added: { type: 'Badge', props: { label: 'hi' } } } }, null, 2),
      fn: 'diffToPatches',
    },
    related: ['util-deepmergespec', 'util-applyspecstreampatch', 'util-compilespecstream'],
    step: 'refine',
    tags: ['diffToPatches', 'RFC 6902', 'patch'],
  },
  {
    id: 'util-nestedtoflat',
    category: 'Core utilities',
    name: 'nestedToFlat',
    signature: `nestedToFlat(nested: Record<string, unknown>): Spec`,
    lang: 'typescript',
    summary: 'Turn a tree with inline children objects into the flat keyed spec the renderer wants.',
    details: [
      'Keys are auto-generated in walk order: `el-0`, `el-1`, … The root is always `el-0`.',
      'A `state` field on the ROOT node is hoisted to `spec.state`.',
      'Leaves get `children: []` — the function normalises that for you.',
      'Because keys are positional, re-running it after an edit renumbers everything. Do not use the output as a patch target.',
      'Use it when another system (a CMS, a form builder, an older model) speaks nested trees.',
    ],
    run: {
      label: 'nested tree',
      input: JSON.stringify(
        { type: 'Card', props: { title: 'Hello' }, state: { count: 0 }, children: [{ type: 'Text', props: { value: 'World' } }, { type: 'Badge', props: { label: 'new' } }] },
        null,
        2,
      ),
      fn: 'nestedToFlat',
    },
    related: ['util-flattotree', 'el-elements'],
    step: 'formats',
    tags: ['nestedToFlat', 'conversion'],
  },
  {
    id: 'util-flattotree',
    category: 'Core utilities',
    name: 'flatToTree',
    signature: `import { flatToTree } from "@json-render/react";

flatToTree(elements: FlatElement[]): Spec
// FlatElement = UIElement & { key: string; parentKey?: string | null }`,
    lang: 'typescript',
    summary: 'Turn a flat LIST of elements with key/parentKey — database rows, basically — into a keyed Spec.',
    details: [
      'It ships in @json-render/react, not core, which is easy to miss when you are importing the other converters.',
      'The element whose `parentKey` is null (or absent) becomes the root.',
      'Parent-child links become `children` arrays in list order; keys are YOURS, unlike `nestedToFlat`.',
      'This is the shape a relational table gives you, so it is the bridge from a CMS or a form-definition table to a spec.',
    ],
    run: {
      label: 'FlatElement[]',
      input: JSON.stringify(
        [
          { key: 'screen', type: 'Screen', props: { title: 'From rows' }, parentKey: null },
          { key: 'a', type: 'Text', props: { value: 'first' }, parentKey: 'screen' },
          { key: 'b', type: 'Badge', props: { label: 'second' }, parentKey: 'screen' },
        ],
        null,
        2,
      ),
      fn: 'flatToTree',
    },
    related: ['util-nestedtoflat', 'el-elements', 'util-compilespecstream'],
    step: 'formats',
    tags: ['flatToTree', 'conversion', 'rows'],
  },
  {
    id: 'util-compilespecstream',
    category: 'Core utilities',
    name: 'compileSpecStream',
    signature: `compileSpecStream<T>(stream: string, initial?: T): T`,
    lang: 'typescript',
    summary: 'Apply a whole JSONL patch stream in one call. The batch version of the streaming compiler.',
    details: [
      'Each LINE is one RFC 6902 operation. Lines that do not parse as a patch are skipped silently.',
      '`initial` lets you resume from an existing object; omit it and you start from `{}`.',
      'It mutates and returns one object, so the result is not a fresh reference per line.',
      'Use it for replaying a captured stream, in tests, or on the server.',
    ],
    run: {
      label: 'JSONL stream',
      input: `{"op":"add","path":"/root","value":"screen"}
{"op":"add","path":"/elements","value":{}}
{"op":"add","path":"/elements/screen","value":{"type":"Screen","props":{"title":"Streamed"},"children":[]}}
this line is prose and is skipped
{"op":"replace","path":"/elements/screen/props/title","value":"Streamed, then edited"}`,
      fn: 'compileSpecStream',
    },
    related: ['util-createspecstreamcompiler', 'util-parsespecstreamline', 'util-applyspecstreampatch'],
    step: 'streaming',
    tags: ['compileSpecStream', 'JSONL', 'streaming'],
  },
  {
    id: 'util-createspecstreamcompiler',
    category: 'Core utilities',
    name: 'createSpecStreamCompiler',
    signature: `createSpecStreamCompiler<T>(initial?: Partial<T>): {
  push(chunk: string): { result: T; newPatches: SpecStreamLine[] };
  getResult(): T;
  getPatches(): SpecStreamLine[];
  reset(initial?: Partial<T>): void;
}`,
    lang: 'typescript',
    summary: 'Stateful compiler for a live stream. It buffers partial lines, so network chunk boundaries do not matter.',
    details: [
      'It DOES accept an initial spec: `createSpecStreamCompiler({ root: "seed" })` starts from that object, verified by calling `getResult()` before any push.',
      '`push` returns the current result plus only the patches applied by THAT chunk, so you can re-render only when something changed.',
      'A chunk ending mid-line is held in the buffer until the rest arrives — that is the whole point over `compileSpecStream`.',
      '`getPatches()` is the full history; `reset(initial)` starts over.',
      'The result object identity is stable, so React needs a spread: `setSpec({ ...result })`.',
    ],
    run: {
      label: 'chunk (pushed into a compiler seeded with { root: "seed" })',
      input: `{"op":"add","path":"/elements","value":{}}
{"op":"add","path":"/elements/seed","value":{"type":"Text","props":{"value":"live"},"children":[]}}
{"op":"add","path":"/half`,
      fn: 'createSpecStreamCompiler',
    },
    related: ['util-compilespecstream', 'util-createmixedstreamparser', 'hook-useuistream'],
    step: 'streaming',
    tags: ['createSpecStreamCompiler', 'streaming', 'buffer'],
  },
  {
    id: 'util-parsespecstreamline',
    category: 'Core utilities',
    name: 'parseSpecStreamLine',
    signature: `parseSpecStreamLine(line: string): JsonPatch | null`,
    lang: 'typescript',
    summary: 'Classify one line: a patch operation, or null. This is the function that decides prose from JSONL.',
    details: [
      'The line is trimmed, and must START WITH `{` — that cheap test is what keeps prose out.',
      'It must parse as JSON AND have a truthy `op` and a defined `path`. `{"no":"op"}` returns null.',
      'It never throws: a JSON parse error becomes null.',
      'A patch with `op: ""` fails the truthiness check, which is the one edge worth knowing.',
    ],
    run: {
      label: 'one line per row (each is classified separately)',
      input: `{"op":"add","path":"/root","value":"screen"}
Here is your dashboard.
{"op":"remove","path":"/elements/old"}
{"no":"op"}
   `,
      fn: 'parseSpecStreamLine',
    },
    related: ['util-createmixedstreamparser', 'util-compilespecstream'],
    step: 'streaming',
    tags: ['parseSpecStreamLine', 'JSONL'],
  },
  {
    id: 'util-applyspecstreampatch',
    category: 'Core utilities',
    name: 'applySpecStreamPatch / applySpecPatch',
    signature: `applySpecStreamPatch<T extends Record<string, unknown>>(obj: T, patch: JsonPatch): T
applySpecPatch(spec: Spec, patch: JsonPatch): Spec   // typed wrapper, same behaviour`,
    lang: 'typescript',
    summary: 'Apply one RFC 6902 operation, in place. All six ops are supported.',
    details: [
      'Supported: add, remove, replace, move, copy, test — the complete RFC 6902 set, verified in the switch statement.',
      '`add` follows RFC semantics: on an array it INSERTS before the index, and `"/arr/-"` appends. `replace` overwrites at the path.',
      '`move` and `copy` are no-ops when `from` is missing; neither throws.',
      '`test` is the only op that THROWS: `Test operation failed: value at "<path>" does not match`, using a deep comparison.',
      'It MUTATES. For React state, spread the result: `setSpec({ ...applySpecPatch(spec, patch) })`.',
    ],
    run: {
      label: 'target object',
      input: JSON.stringify({ arr: [1, 2, 3], keep: 'me' }, null, 2),
      labelB: 'patches (one per line)',
      input2: `{"op":"add","path":"/arr/-","value":4}
{"op":"add","path":"/arr/0","value":0}
{"op":"copy","path":"/copied","from":"/keep"}
{"op":"remove","path":"/arr/1"}`,
      fn: 'applySpecStreamPatch',
    },
    related: ['util-parsespecstreamline', 'util-difftopatches', 'util-compilespecstream'],
    step: 'streaming',
    tags: ['applySpecStreamPatch', 'RFC 6902'],
  },
  {
    id: 'util-createmixedstreamparser',
    category: 'Core utilities',
    name: 'createMixedStreamParser',
    signature: `createMixedStreamParser(callbacks: {
  onPatch: (patch: JsonPatch) => void;
  onText: (text: string) => void;
}): { push(chunk: string): void; flush(): void }`,
    lang: 'typescript',
    summary: 'Split a chat stream into prose and patches, line by line. The engine behind useChatUI.',
    details: [
      'Each complete line goes through `parseSpecStreamLine`: a patch calls `onPatch`, anything else calls `onText`.',
      'It buffers, so a line split across two network chunks is still classified once.',
      'You MUST call `flush()` when the stream ends, or the final unterminated line is lost.',
      'For the AI SDK there is a higher-level path: `createJsonRenderTransform` / `pipeJsonRender` on the server, which also understands ```spec fences.',
    ],
    run: {
      label: 'mixed stream',
      input: `Here is the dashboard you asked for.
{"op":"add","path":"/root","value":"screen"}
{"op":"add","path":"/elements","value":{}}
Let me know if you want a chart instead.`,
      fn: 'createMixedStreamParser',
    },
    related: ['util-parsespecstreamline', 'hook-usechatui', 'util-pipejsonrender'],
    step: 'chat',
    tags: ['createMixedStreamParser', 'chat', 'streaming'],
  },
  {
    id: 'util-pipejsonrender',
    category: 'Core utilities',
    name: 'pipeJsonRender / createJsonRenderTransform',
    signature: `import { pipeJsonRender } from "@json-render/core";

writer.merge(pipeJsonRender(result.toUIMessageStream()));
// equivalent to: stream.pipeThrough(createJsonRenderTransform())`,
    lang: 'typescript',
    summary: 'Server-side: classify an AI SDK UI message stream into prose and spec data parts.',
    details: [
      'Two classification modes. FENCE mode is preferred: lines between ```spec and ``` are parsed as JSONL, and the fence markers are swallowed.',
      'HEURISTIC mode is the backward-compatible fallback: outside a fence, lines starting with `{` are buffered and tested with `parseSpecStreamLine`.',
      'Patches are emitted as parts of type `"data-spec"` (the constant `SPEC_DATA_PART_TYPE`); everything else is flushed as text.',
      'Non-text chunks — tool events, step markers — pass through untouched.',
      '`pipeJsonRender` is the convenience wrapper that saves you a `pipeThrough` and a type cast. Both need a server, so there is no live demo here.',
    ],
    related: ['util-createmixedstreamparser', 'hook-usejsonrendermessage', 'hook-usechatui'],
    step: 'chat',
    tags: ['pipeJsonRender', 'AI SDK', 'server'],
  },
  {
    id: 'util-builduserprompt',
    category: 'Core utilities',
    name: 'buildUserPrompt',
    signature: `buildUserPrompt({
  prompt: string;
  currentSpec?: Spec | null;
  state?: Record<string, unknown> | null;
  maxPromptLength?: number;
  editModes?: Array<"patch" | "merge" | "diff">;   // default ["patch"]
  format?: "json" | "yaml";                        // default "json"
  serializer?: (spec: Spec) => string;
}): string`,
    lang: 'typescript',
    summary: 'Assemble the user turn: truncation, the current spec for refinement, and the live state as context.',
    details: [
      'With no `currentSpec` it appends a reminder to emit `/root` first and interleave `/elements` and `/state` patches so the UI fills in progressively.',
      'With a non-empty `currentSpec` it switches to refinement: the serialized spec under "CURRENT UI STATE (already loaded, DO NOT recreate existing elements)", then the request, then "Output ONLY the JSON Patch lines needed for the change."',
      '"Non-empty" is decided by `isNonEmptySpec`, so `{ root: "x", elements: {} }` is treated as a fresh generation.',
      '`state` is appended under "AVAILABLE STATE" as pretty JSON — it is context for the model, and it is tokens you pay for.',
      '`maxPromptLength` truncates the USER TEXT only, before anything is wrapped around it.',
      '`format: "yaml"` requires you to pass a `serializer`; JSON uses `JSON.stringify`.',
    ],
    run: {
      label: 'UserPromptOptions',
      input: JSON.stringify(
        { prompt: 'add a dark mode toggle', currentSpec: { root: 'screen', elements: { screen: { type: 'Screen', props: { title: 'Dashboard' }, children: [] } } }, state: { theme: 'light' } },
        null,
        2,
      ),
      fn: 'buildUserPrompt',
    },
    related: ['util-catalogprompt', 'util-isnonemptyspec', 'util-formatspecissues'],
    step: 'refine',
    tags: ['buildUserPrompt', 'prompt', 'refine'],
  },
  {
    id: 'util-createstatestore',
    category: 'Core utilities',
    name: 'createStateStore',
    signature: `createStateStore(initialState?: StateModel): StateStore

interface StateStore {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  update(updates: Record<string, unknown>): void;
  getSnapshot(): StateModel;
  getServerSnapshot?(): StateModel;
  subscribe(listener: () => void): () => void;
}`,
    lang: 'typescript',
    summary: 'The built-in in-memory store. Framework-agnostic, so it also works in tests and outside React.',
    details: [
      'Equality is by REFERENCE (`===`). Setting a path to the same primitive does not notify; mutating an array in place and setting it back does not notify either.',
      '`update` applies several paths and notifies ONCE, and skips paths whose value did not actually change.',
      'Writes use structural sharing: only objects along the path are cloned, so untouched branches keep their references.',
      'Missing intermediate objects are created on write, and a numeric segment creates an ARRAY.',
      'It is what `StateProvider` builds when you do not pass a `store`, and you can drive it from outside React by calling `set` directly.',
    ],
    run: {
      label: 'initial state',
      input: JSON.stringify({ user: { name: 'Ada' }, count: 1 }, null, 2),
      labelB: 'writes (path → value, applied in order)',
      input2: JSON.stringify({ '/count': 1, '/user/city': 'London', '/rows/0/id': 'a' }, null, 2),
      fn: 'createStateStore',
    },
    related: ['util-createstoreadapter', 'prov-stateprovider', 'hook-usestatestore'],
    step: 'stores',
    tags: ['createStateStore', 'store', 'JSON Pointer'],
  },
  {
    id: 'util-createstoreadapter',
    category: 'Core utilities',
    name: 'createStoreAdapter',
    signature: `import { createStoreAdapter } from "@json-render/core/store-utils";

createStoreAdapter({
  getSnapshot: () => StateModel;
  setSnapshot: (next: StateModel) => void;
  subscribe: (listener: () => void) => () => void;
}): StateStore`,
    lang: 'typescript',
    summary: 'Wrap Redux, Zustand, XState or anything else in a StateStore, by supplying three callbacks.',
    details: [
      'It lives on the `@json-render/core/store-utils` SUBPATH, not the package root. Importing it from "@json-render/core" fails.',
      'You supply snapshot-in, snapshot-out and subscribe. It builds `get`, `set`, `update`, `getServerSnapshot` and the no-op detection for you.',
      'The same subpath also exports `immutableSetByPath` and `flattenToPointers`.',
      'Pass the result as `store` on `StateProvider` / `JSONUIProvider`, which puts them in controlled mode.',
      '`flattenToPointers({ user: { name: "Ada" } })` gives `{ "/user/name": "Ada" }` — handy for feeding `update`.',
    ],
    related: ['util-createstatestore', 'prov-stateprovider'],
    step: 'stores',
    tags: ['createStoreAdapter', 'redux', 'zustand'],
  },
  {
    id: 'util-definedirective',
    category: 'Core utilities',
    name: 'defineDirective',
    signature: `defineDirective({
  name: "$format",
  description?: string,
  schema: z.ZodType,
  resolve: (value, ctx: PropResolutionContext) => unknown,
})`,
    lang: 'typescript',
    summary: 'Define a custom $-key. An identity function with one runtime rule: it refuses to shadow a built-in.',
    details: [
      'It THROWS at definition time on a collision: `Directive name "$state" conflicts with a built-in prop expression key`.',
      'The `schema` is NOT a runtime guard — `resolvePropValue` calls `resolve` without parsing. Its only job is `catalog.prompt({ directives })`, which prints the key under CUSTOM DYNAMIC VALUES. Validate inside `resolve` if you need to.',
      'It also throws on a name that does not start with `$`: `Directive name must start with "$"`.',
      '`findDirective` scans the whole registry, so an object carrying two registered directive keys throws `Ambiguous directive` at render time rather than picking one.',
      '`resolve` gets the raw object and the resolution context. Call `resolvePropValue(value.x, ctx)` on sub-values to compose with `$state`, `$item` and the rest.',
      'Directives are looked up LAST, after every built-in, so a built-in always wins.',
      'Register at runtime with `JSONUIProvider directives={[…]}`, and pass the same array into `prompt()`.',
    ],
    related: ['expr-directive', 'expr-computed', 'prov-jsonuiprovider', 'util-catalogprompt'],
    step: 'directives',
    tags: ['defineDirective', 'directive'],
  },
  {
    id: 'util-registeractionobserver',
    category: 'Core utilities',
    name: 'registerActionObserver',
    signature: `registerActionObserver(observer: {
  onDispatch?: (evt: { id: string; name: string; params: Record<string, unknown>; at: number }) => void;
  onSettle?:   (evt: { id: string; name: string; ok: boolean; at: number; durationMs: number; error?: unknown }) => void;
}): () => void`,
    lang: 'typescript',
    summary: 'Subscribe to every action dispatch and settle. Returns an unsubscribe function.',
    details: [
      'Every dispatch gets an id from `nextActionDispatchId()`, and the matching settle event carries the SAME id.',
      'Built-in actions are observed too — they are wrapped in the same try/finally as custom handlers.',
      '`onSettle` reports `ok`, `durationMs` and the thrown `error`, so a failing handler is visible without touching the handler.',
      'This is the hook a devtools panel or an action timeline is built on. The companions `markDevtoolsActive` / `isDevtoolsActive` / `subscribeDevtoolsActive` are exported too.',
      'It is a module-level registry, not a React context: register once, outside the tree.',
    ],
    related: ['prov-actionprovider', 'act-binding', 'hook-useactions'],
    step: 'actions',
    tags: ['registerActionObserver', 'devtools', 'observability'],
  },
  {
    id: 'util-resolvepropvalue',
    category: 'Core utilities',
    name: 'resolvePropValue',
    signature: `resolvePropValue(value: unknown, ctx: PropResolutionContext): unknown

interface PropResolutionContext {
  stateModel: StateModel;
  repeatItem?: unknown;
  repeatIndex?: number;
  repeatBasePath?: string;
  functions?: Record<string, ComputedFunction>;
  directives?: DirectiveRegistry;
}`,
    lang: 'typescript',
    summary: 'The whole expression engine in one function. Everything props can do goes through here.',
    details: [
      'Check order: null/undefined, $state, $item, $index, $bindState, $bindItem, $cond, $computed, $template, array, object (directive, then walk), literal.',
      'A recognised expression must match EXACTLY — `$cond` without `$else` is not a `$cond`, it is an object.',
      'Arrays are mapped and plain objects are walked, so expressions nest to any depth.',
      'Sibling functions: `resolveElementProps` (every prop), `resolveBindings` (write paths), `resolveActionParam` ($item → path).',
      'Nothing here throws on a miss. Every failure is an `undefined`, an empty string, or a passthrough.',
    ],
    run: {
      label: 'expression',
      input: JSON.stringify({ $template: '${/user/name} has ${count} items, missing=[${/nope}]' }, null, 2),
      labelB: 'PropResolutionContext',
      input2: JSON.stringify({ stateModel: { user: { name: 'Ada' }, count: 3 } }, null, 2),
      fn: 'resolvePropValue',
    },
    related: ['expr-state', 'expr-template', 'expr-cond', 'ctx-bindings'],
    step: 'expressions',
    tags: ['resolvePropValue', 'expressions'],
  },
  {
    id: 'util-evaluatevisibility',
    category: 'Core utilities',
    name: 'evaluateVisibility',
    signature: `evaluateVisibility(condition: VisibilityCondition | undefined, ctx: VisibilityContext): boolean

interface VisibilityContext {
  stateModel: StateModel;
  repeatItem?: unknown;
  repeatIndex?: number;
}`,
    lang: 'typescript',
    summary: 'The whole condition grammar in one function. Used for visible, $cond, and ValidationConfig.enabled.',
    details: [
      'undefined → true, boolean → itself, array → every(), $and → every(), $or → some(), otherwise a single condition.',
      'The array branch calls the SINGLE-condition evaluator, which does not understand `$and` / `$or`. Nesting one in a plain array silently reads as true.',
      'A null or a string condition THROWS — the code reaches `"$index" in cond` on a non-object.',
      'Scope keys are checked in the order $index, $item, then $state, so an object with two of them uses the first that matches.',
      '`conditionUsesItemScope` and `splitRepeatVisibility` are exported alongside it, and are what the renderer uses to split a repeat filter from a container condition.',
    ],
    run: {
      label: 'condition',
      input: JSON.stringify({ $and: [{ $state: '/admin' }, { $or: [{ $state: '/count', gte: 3 }, { $state: '/override' }] }] }, null, 2),
      labelB: 'VisibilityContext',
      input2: JSON.stringify({ stateModel: { admin: true, count: 1, override: true } }, null, 2),
      fn: 'evaluateVisibility',
    },
    related: ['cond-truthy', 'cond-and', 'cond-or', 'el-visible'],
    step: 'conditions',
    tags: ['evaluateVisibility', 'conditions'],
  },
];
