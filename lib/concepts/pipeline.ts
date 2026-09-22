import type { Concept } from './types';

/**
 * Utilities, AI pipeline and shipping concepts — the steps after "Your code".
 * Facts here are the ones the step notes already state and that the labs
 * demonstrate live (validateSpec codes, autoFixSpec lossy split, the JSONL
 * wire, spec.state mirroring, edit modes).
 */
export const PIPELINE_CONCEPTS: Concept[] = [
  // ---- Utilities ----
  {
    id: 'validate-spec-structure',
    title: 'validateSpec checks structure',
    summary:
      'validateSpec walks the flat map and reports dangling children, bad conditions and broken repeats as coded issues. It does not check component names or prop types.',
    lang: 'typescript',
    shape: `const { valid, issues } = validateSpec(spec);
// issues[i] = { code, message, severity, path? }
// errors:  missing_root · root_not_found · empty_spec · missing_child
//          invalid_visible · repeat_without_children
//          repeat_item_outside_scope · repeat_state_mismatch
//          visible_in_props · on_in_props · repeat_in_props · watch_in_props
// warning: orphaned_element  (only with { checkOrphans: true })`,
    gotcha: 'A spec can be "valid" and still render nothing useful: an unknown type or a wrong prop type is not a structural issue.',
    step: 'repair',
    ref: 'util-validatespec',
  },
  {
    id: 'autofix-lossy-vs-safe',
    title: 'autoFixSpec: safe vs lossy',
    summary:
      'autoFixSpec relocates misplaced fields (safe) and can prune references to elements that do not exist (lossy). Each fix is labelled so you can refuse the lossy ones.',
    lang: 'typescript',
    shape: `const { spec, fixDetails } = autoFixSpec(raw, { lossy: false });
// fixDetails[i] = { message, lossy }
// lossy: false  → only relocations (visible/on/repeat/watch out of props)
// lossy: true   → also prune dangling children / slot refs`,
    gotcha: 'A pruned spec looks valid while silently missing a section the user asked for. Withhold pruning until the last retry.',
    step: 'repair',
    ref: 'util-autofixspec',
  },
  {
    id: 'repair-loop',
    title: 'The repair loop',
    summary:
      'Fix losslessly, validate, and if issues remain re-prompt the model with the issue messages verbatim. Only on the final attempt allow lossy pruning.',
    lang: 'typescript',
    shape: `const last = attempt >= maxAttempts;
const { spec } = autoFixSpec(raw, { lossy: last });
const { valid, issues } = validateSpec(spec);
if (!valid && !last) return retry(formatSpecIssues(issues));`,
    step: 'repair',
    ref: 'util-formatspecissues',
  },
  {
    id: 'nested-to-flat',
    title: 'nestedToFlat',
    summary:
      'Author a readable nested tree and normalise it into the flat map before rendering. Lives in @json-render/core.',
    lang: 'typescript',
    shape: `import { nestedToFlat } from '@json-render/core';
const spec = nestedToFlat({
  type: 'Card', props: {…},
  children: [{ type: 'Text', props: {…} }],
});`,
    gotcha: 'It invents keys (el-0, el-1). They shift when you edit the tree, so never patch a spec produced this way.',
    step: 'formats',
    ref: 'util-nestedtoflat',
  },
  {
    id: 'flat-to-tree',
    title: 'flatToTree',
    summary:
      'Rows with key and parentKey — the shape of a database table of UI elements — become a spec. Lives in @json-render/react, not core.',
    lang: 'typescript',
    shape: `import { flatToTree } from '@json-render/react';
const spec = flatToTree([
  { key: 'root', parentKey: null,   type: 'Card', props: {…} },
  { key: 't1',   parentKey: 'root', type: 'Text', props: {…} },
]);`,
    step: 'formats',
    ref: 'util-flattotree',
  },
  {
    id: 'merge-and-diff',
    title: 'deepMergeSpec & diffToPatches',
    summary:
      'deepMergeSpec applies an RFC 7396 merge patch (null deletes, arrays replace). diffToPatches turns two specs into RFC 6902 operations you can inspect, store or undo.',
    lang: 'typescript',
    shape: `deepMergeSpec(base, { elements: { m1: { props: { tone: 'danger' } } } });
diffToPatches(before, after);
// → [{ op: 'replace', path: '/elements/m1/props/tone', value: 'danger' }]`,
    step: 'refine',
    ref: 'util-difftopatches',
  },

  // ---- AI ----
  {
    id: 'jsonl-patches',
    title: 'The wire is JSONL patches',
    summary:
      'The model streams one RFC 6902 operation per line, not one big JSON object. Each line is independently valid, so a truncated stream is a smaller UI, not a corrupt one.',
    shape: `{"op":"add","path":"/root","value":"screen"}
{"op":"add","path":"/elements/screen","value":{"type":"Screen","props":{…},"children":[]}}
{"op":"add","path":"/elements/screen/children/-","value":"m1"}
{"op":"replace","path":"/elements/m1/props/tone","value":"danger"}`,
    gotcha: 'Bad lines are skipped silently by the parser. Nothing validates the result — that is what validateSpec is for.',
    step: 'streaming',
    ref: 'util-createspecstreamcompiler',
  },
  {
    id: 'flat-enables-patching',
    title: 'Why flat wins',
    summary:
      'Every element has a stable address like /elements/header, so adding one is a single line that disturbs nothing. A nested tree would need paths that move whenever a sibling is inserted.',
    shape: `/elements/header              ← stable
/root/children/2/children/0   ← moves when anything above changes`,
    lang: 'text',
    step: 'streaming',
    ref: 'el-elements',
  },
  {
    id: 'state-mirroring',
    title: 'Mirror /state into your store',
    summary:
      'The stream compiler writes /state/* patches into spec.state, but the renderer never reads spec.state. Your code has to copy those patches into the live store or a streamed repeat renders zero rows.',
    lang: 'typescript',
    shape: `if (patch.path.startsWith('/state/')) {
  store.set(patch.path.slice('/state'.length), patch.value);
}`,
    gotcha: 'This is the most-missed step in every streaming integration, and it is absent from the quick-start.',
    step: 'streaming',
    ref: 'el-state',
  },
  {
    id: 'loading-prop',
    title: 'loading disables half-built UI',
    summary:
      'A half-rendered spec is interactive: a button is clickable before its handler is described. Pass loading to the Renderer and read it in your components to disable controls until the stream closes.',
    lang: 'tsx',
    shape: `<Renderer spec={spec} registry={registry} loading={isStreaming} />
// in a component:
Button: ({ props, emit, loading }) => <button disabled={loading} …/>`,
    step: 'streaming',
    ref: 'ctx-loading',
  },
  {
    id: 'text-plain-wire',
    title: 'text/plain, not SSE',
    summary:
      'useUIStream reads a plain text stream of JSONL lines. Pipe result.textStream through; it is not an SSE or UI-message stream.',
    lang: 'typescript',
    shape: `const result = streamText({ system: catalog.prompt(), prompt, model });
return new Response(result.textStream, {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});`,
    gotcha: 'Errors after the first byte cannot be HTTP errors. Emit a terminal marker line in the stream, or the client cannot tell "finished" from "died".',
    step: 'generate',
    ref: 'hook-useuistream',
  },
  {
    id: 'catalog-prompt-cost',
    title: 'The prompt ships every request',
    summary:
      'catalog.prompt() is a stable prefix of a few thousand tokens for a small catalog and far more for a real design system. Cache it, or build a narrower catalog per request.',
    lang: 'typescript',
    shape: `catalog.prompt({
  customRules: ['Never invent monetary figures.'],
});
// 13 components ≈ 4,500 tokens, ~3,000 of it fixed scaffolding`,
    gotcha: 'The stock prompt tells the model to invent sample data. Cancel that in customRules whenever the data is yours.',
    step: 'generate',
    ref: 'util-catalogprompt',
  },
  {
    id: 'mixed-stream',
    title: 'Prose and patches in one stream',
    summary:
      'createMixedStreamParser classifies each line as text or patch and routes it. Lines starting with { are buffered and parsed; anything that fails is flushed back as text.',
    lang: 'typescript',
    shape: `const parser = createMixedStreamParser({
  onText:  (line)  => appendProse(line),
  onPatch: (patch) => applySpecStreamPatch(spec, patch),
});
parser.push(chunk); parser.flush();`,
    gotcha: 'The catalog prompt ends with "output ONLY JSONL". A chat route must override that or every greeting comes back as a dashboard.',
    step: 'chat',
    ref: 'util-createmixedstreamparser',
  },
  {
    id: 'per-message-store',
    title: 'One store per message',
    summary:
      'Two generated UIs in one conversation will both bind to paths like /form/email and share a value. Give each message its own StateStore; nothing isolates them for you.',
    lang: 'tsx',
    shape: `function MessageUI({ spec }) {
  const store = useRef(createStateStore(spec.state ?? {})).current;
  return <JSONUIProvider registry={registry} store={store}>…</JSONUIProvider>;
}`,
    step: 'chat',
    ref: 'util-createstatestore',
  },
  {
    id: 'edit-modes',
    title: 'Three edit modes',
    summary:
      'Pass currentSpec to buildUserPrompt and the request becomes an edit. patch streams RFC 6902 lines; merge returns one RFC 7396 line flagged __json_edit; diff returns a unified diff with no applier shipped.',
    lang: 'typescript',
    shape: `buildUserPrompt({ prompt, currentSpec, editModes: ['patch'] });
// patch → createSpecStreamCompiler(currentSpec)
// merge → deepMergeSpec(currentSpec, edit)
// diff  → bring your own applier`,
    gotcha: 'useUIStream only understands patch mode. A merge line has no op and applies as nothing; a diff fence does not parse. No error, no change.',
    step: 'refine',
    ref: 'util-builduserprompt',
  },
  {
    id: 'diff-before-accept',
    title: 'Diff before you accept',
    summary:
      'A model asked for one edit sometimes rewrites labels nobody mentioned. diffToPatches(before, after) turns that into an op list you can read and reject.',
    lang: 'typescript',
    shape: `const ops = diffToPatches(before, after);
if (ops.some((o) => !o.path.startsWith('/elements/m2'))) askUser(ops);`,
    step: 'refine',
    ref: 'util-difftopatches',
  },

  // ---- Shipping ----
  {
    id: 'fixed-spec-compiler',
    title: 'Compile specs, do not generate them',
    summary:
      'The highest-value production use involves no model. A pure function from your domain model to a Spec is deterministic, snapshot-testable and reviewable.',
    lang: 'typescript',
    shape: `function buildSpec(fields: FieldDef[]): Spec { … }
expect(buildSpec(FIELDS)).toMatchSnapshot();`,
    step: 'patterns',
    ref: 'el-elements',
  },
  {
    id: 'derived-bindings',
    title: 'Derive bindings, never author them',
    summary:
      'When the compiler derives every $bindState path from a field id, a spec cannot point at a record it should not touch. A model choosing paths is one hallucinated pointer from writing into the wrong filing.',
    shape: `{ "value": { "$bindState": "/answers/vat_number" } }   // derived from field.id
// never: a path a model typed`,
    step: 'patterns',
    ref: 'expr-bindstate',
  },
  {
    id: 'four-risk-levels',
    title: 'Four ways to ship, by risk',
    summary:
      'Fixed specs → AI fills state → generated read-only views → generated UI with actions. Each step up needs more guarding; most teams should stop at the first or second.',
    lang: 'text',
    shape: `1 fixed specs        no model, no cost, one renderer for web + PDF
2 AI fills state     your structure, model values, controlled store
3 generated, read-only   narrow catalog, no mutating actions
4 generated + actions    server-side auth on every handler`,
    step: 'patterns',
  },
  {
    id: 'attack-surface',
    title: 'Your components are the attack surface',
    summary:
      'A spec cannot execute code; it can only name things you implemented. So the risks live in what those things do: an href accepting javascript:, a handler without authorisation, a bindable path into a real record.',
    gotcha: 'Prompt injection reaches the UI. Untrusted content in the generation context can put plausible text next to a real action button.',
    step: 'limitations',
    ref: 'act-binding',
  },
  {
    id: 'silent-failures',
    title: 'Nothing throws',
    summary:
      'A missing path, a malformed condition, an unknown function, a dangling child — all resolve to undefined, false or nothing. The UI looks plausible and is wrong. Budget for it: validate specs, guard components, pass a fallback.',
    lang: 'text',
    shape: `missing $state path      → undefined
malformed visible        → rule ignored (truthiness check, or always shown)
unknown type             → fallback or nothing
dangling child key       → branch gone
unregistered $computed   → undefined (+ console warning)`,
    step: 'limitations',
    ref: 'util-validatespec',
  },
];
