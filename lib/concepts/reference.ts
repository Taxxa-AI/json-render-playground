import type { Concept } from './types';

/**
 * Extra concepts the reference explorer needs. Owned by the reference agent.
 *
 * These are the ideas you only meet when you read the WHOLE surface: the two
 * RFCs the wire formats come from, the vocabulary validateSpec speaks, the
 * lossy/lossless split in autoFixSpec, what actually goes into a prompt, and
 * the JSON Pointer edge cases that turn a typo into a silently visible
 * element. Spec / expression / binding / list / action / validation basics
 * live in core.ts; catalog / registry / directive basics in yourcode.ts;
 * hooks / providers / watch in runtime.ts.
 *
 * Every claim below was run against the installed 0.20.0 build.
 */
export const REFERENCE_CONCEPTS: Concept[] = [
  {
    id: 'pointer-edge-cases',
    title: 'Pointer edge cases',
    summary:
      'Paths are RFC 6901 JSON Pointers, and two of its rules bite: the empty pointer means the whole document, and a pointer that is not a string is treated as empty. That is why a misspelled condition key fails OPEN.',
    shape: `getByPath(state, "/user/name")  // "Ada"
getByPath(state, "user/name")   // "Ada"  — leading slash optional
getByPath(state, "user.name")   // undefined — dots are not pointers
getByPath(state, "")            // the WHOLE state object
getByPath(state, undefined)     // the WHOLE state object

{ "visible": { "state": "/never" } }
// cond.$state is undefined -> whole state object -> truthy -> VISIBLE`,
    lang: 'text',
    gotcha:
      'A condition with a typo\'d key is not ignored and is not false — it resolves to the entire state model, which is truthy, so the element shows. Add an operator and it flips to always-hidden instead.',
    step: 'conditions',
    ref: 'expr-state',
  },
  {
    id: 'spec-stream',
    title: 'SpecStream (the wire format)',
    summary:
      'json-render streams UI as JSONL: one RFC 6902 patch operation per line, applied in order to a growing object. A partial spec is always a valid spec, which is why the UI can render while it arrives.',
    shape: `{"op":"add","path":"/root","value":"screen"}
{"op":"add","path":"/elements","value":{}}
{"op":"add","path":"/elements/screen","value":{"type":"Screen","props":{},"children":[]}}`,
    lang: 'json',
    gotcha:
      'parseSpecStreamLine only accepts a trimmed line starting with "{" that parses AND has a truthy op and a defined path. Everything else — prose, blank lines, half-written JSON — comes back null and is skipped in silence.',
    step: 'streaming',
    ref: 'util-parsespecstreamline',
  },
  {
    id: 'rfc6902-patch',
    title: 'RFC 6902 JSON Patch',
    summary:
      'The operation format behind streaming and refinement. Six ops: add, remove, replace, move, copy, test. json-render implements all six.',
    shape: `{ "op": "add",     "path": "/elements/new", "value": { … } }
{ "op": "add",     "path": "/list/-",          "value": 4 }   // append
{ "op": "add",     "path": "/list/0",          "value": 0 }   // INSERT before 0
{ "op": "replace", "path": "/elements/main/props/title", "value": "New" }
{ "op": "remove",  "path": "/elements/old" }
{ "op": "move",    "path": "/b", "from": "/a" }
{ "op": "test",    "path": "/root", "value": "screen" }        // throws on mismatch`,
    lang: 'json',
    gotcha:
      'add and replace differ on arrays: add INSERTS (shifting everything after it) while replace overwrites. test is the only op that throws. move and copy silently do nothing when `from` is missing.',
    step: 'streaming',
    ref: 'util-applyspecstreampatch',
  },
  {
    id: 'rfc7396-merge',
    title: 'RFC 7396 merge patch',
    summary:
      'The other edit format: one object deep-merged into the spec. Smaller than a patch list for a broad edit, and much easier for a model to get right.',
    shape: `deepMergeSpec(
  { elements: { main: { props: { title: "Old", subtitle: "keep" } } } },
  { elements: { main: { props: { title: "New", subtitle: null } } } },
)
// { elements: { main: { props: { title: "New" } } } }   <- subtitle DELETED`,
    lang: 'typescript',
    gotcha:
      'null deletes the key rather than setting it to null, so a merge patch literally cannot write a null value. Arrays replace wholesale, never concatenate — the demo catalog uses .nullable() everywhere, which makes this trap easy to hit.',
    step: 'refine',
    ref: 'util-deepmergespec',
  },
  {
    id: 'issue-codes',
    title: 'The issue vocabulary',
    summary:
      'validateSpec speaks thirteen machine-readable codes. Learning them is how you turn "the page is blank" into a one-line diagnosis.',
    shape: `missing_root · root_not_found · empty_spec
missing_child · orphaned_element
repeat_without_children · repeat_item_outside_scope · repeat_state_mismatch
invalid_visible
visible_in_props · on_in_props · repeat_in_props · watch_in_props`,
    lang: 'text',
    gotcha:
      'missing_root and empty_spec return EARLY — you get that one issue and nothing else is checked, so a spec can look like it has a single problem when it has six. orphaned_element is the only warning, and it is off unless you pass checkOrphans: true.',
    step: 'repair',
    ref: 'util-validatespec',
  },
  {
    id: 'lossy-fix',
    title: 'Lossy vs lossless repair',
    summary:
      'autoFixSpec sorts its own fixes. Relocating a misplaced field loses nothing; pruning a dangling child reference deletes UI that the model meant to send.',
    shape: `autoFixSpec(spec, { lossy: false })
// lossless only: visible/on/repeat/watch moved out of props

autoFixSpec(spec)                       // lossy defaults to TRUE
// also prunes dangling keys from children and from named slots
// -> fixDetails: [{ message: "Removed reference to…", lossy: true }]`,
    lang: 'typescript',
    gotcha:
      'In a repair loop, pass lossy: false while retries remain so the model regenerates the missing element, and only accept the lossy result as a last resort. One exception is built in: a dangling child list on an element that has a repeat is left alone when pruning would empty it.',
    step: 'repair',
    ref: 'util-autofixspec',
  },
  {
    id: 'prompt-scaffolding',
    title: 'What goes into a prompt',
    summary:
      'catalog.prompt() is not just your component list. It is a system message assembled from the schema\'s default rules, the built-in actions, your descriptions and Zod schemas, and the edit-mode instructions.',
    shape: `catalog.prompt({ mode: "standalone", editModes: ["patch"], directives: [] })

// system intro
// + 12 default rules baked into @json-render/react's schema
// + built-in actions: setState, pushState, removeState, validateForm
// + one block per component: description, props, slots, example
// + one block per action
// + edit-mode instructions`,
    lang: 'typescript',
    gotcha:
      'The demo catalog\'s thirteen components produce roughly 19,000 characters. Every component you add is paid for on every request — and push/pop, which the runtime implements, are NOT in the built-in list, so the model never learns they exist.',
    step: 'catalog',
    ref: 'util-catalogprompt',
  },
  {
    id: 'structured-output-schema',
    title: 'Why JSONL, not JSON Schema',
    summary:
      'catalog.jsonSchema({ strict: true }) exists for providers that want a structured-output schema, but the spec format has a shape strict JSON Schema cannot express.',
    shape: `catalog.jsonSchema({ strict: true })
// elements is a RECORD (dynamic keys), and strict mode requires
// additionalProperties: false — so it is emitted as:
//   { type: "object", properties: {}, additionalProperties: false }`,
    lang: 'typescript',
    gotcha:
      'The schema for the interesting part of a spec is opaque, so the model relies on catalog.prompt() to know what an element looks like. That is the real reason json-render streams JSONL patches instead of asking for one structured JSON object.',
    step: 'catalog',
    ref: 'util-catalogjsonschema',
  },
  {
    id: 'nav-stack',
    title: 'The undocumented nav stack',
    summary:
      'ActionProvider implements two actions nobody documents: push and pop. They maintain /navStack and /currentScreen in your state model.',
    shape: `{ "on": { "press": { "action": "push", "params": { "screen": "detail" } } } }
{ "on": { "press": { "action": "pop" } } }

// push: /navStack <- [...navStack, currentScreen]; /currentScreen <- screen
// pop:  /currentScreen <- navStack.pop()`,
    lang: 'json',
    gotcha:
      'Both paths are hard-coded and cannot be renamed, and neither action appears in the schema\'s builtInActions list — so catalog.prompt() never mentions them and a model will not emit them. Treat them as an internal convention, not an API.',
    step: 'limitations',
    ref: 'act-pushpop',
  },
];
