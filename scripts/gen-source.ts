/**
 * Emit lib/demo/source.generated.ts from the real demo sources.
 *
 * The labs show the catalog entry and the React implementation behind whatever
 * components the current spec uses. Those strings have to reach client
 * components, so rather than plumbing fs reads through every page we generate
 * a module at build time. It cannot drift: it IS the source.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * Slice out one `Name: …` entry from a catalog or a component map.
 *
 * Line-based on purpose. The bracket-counting version stopped at the first
 * balanced pair after the key, which for `Metric: ({ props }) => (` is the
 * arrow function's PARAMETER LIST — so every component implementation came out
 * truncated to its signature. Both files indent entries by exactly two spaces
 * and close them on a line of their own, so scanning for that terminator is
 * simpler and correct.
 */
function sliceEntry(src: string, name: string, indent = 2): string | null {
  const lines = src.split('\n');
  const pad = ' '.repeat(indent);
  const startIdx = lines.findIndex((l) => new RegExp(`^${pad}${name}:( |$)`).test(l));
  if (startIdx === -1) return null;

  // A one-liner: `  Divider: () => <hr />,`
  const first = lines[startIdx];
  if (/,\s*$/.test(first) && balanced(first.slice(first.indexOf(':') + 1))) return first;

  for (let i = startIdx + 1; i < lines.length; i++) {
    if (new RegExp(`^${pad}(\\}|\\)),?$`).test(lines[i])) return lines.slice(startIdx, i + 1).join('\n');
  }
  return null;
}

/** Are all brackets in this fragment closed? */
function balanced(s: string): boolean {
  let n = 0;
  let instr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (instr) {
      if (c === instr && s[i - 1] !== '\\') instr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') instr = c;
    else if (c === '{' || c === '(' || c === '[') n++;
    else if (c === '}' || c === ')' || c === ']') n--;
  }
  return n === 0;
}
/** Pull the leading doc comment / inline comments that sit directly above. */
function withLeadingComment(src: string, entry: string): string {
  const at = src.indexOf(entry);
  if (at === -1) return entry;
  const before = src.slice(0, at);
  const lines = before.split('\n');
  // `before` ends at the entry's own indentation, so the split leaves a
  // trailing '' that the scan below reads as a blank line and stops on. Drop
  // it, or no entry ever gets its comment.
  if (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const grabbed: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    const t = l.trim();
    if (t === '') break;
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) {
      grabbed.unshift(l);
      continue;
    }
    break;
  }
  return grabbed.length ? `${grabbed.join('\n')}\n${entry}` : entry;
}

/**
 * Slice a block out of a file by a start marker and an end marker.
 *
 * Deliberately throws. These markers point into the installed
 * @json-render dist, and the actions lab shows the result as "this is the code
 * that runs". If a version bump moves one of them, a loud build failure is
 * correct and stale text is not.
 */
function between(src: string, start: string, end: string, label: string): string {
  const a = src.indexOf(start);
  if (a === -1) throw new Error(`gen-source: start marker not found for "${label}"`);
  const b = src.indexOf(end, a + start.length);
  if (b === -1) throw new Error(`gen-source: end marker not found for "${label}"`);
  return src.slice(a, b + end.length);
}

const reactDist = read('node_modules/@json-render/react/dist/index.mjs');
const coreDist = read('node_modules/@json-render/core/dist/index.mjs');

/** The core chunk filename is content-hashed, so find it by what is in it. */
function coreChunk(marker: string): string {
  const dir = path.join(ROOT, 'node_modules/@json-render/core/dist');
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.mjs')) continue;
    const src = readFileSync(path.join(dir, f), 'utf8');
    if (src.includes(marker)) return src;
  }
  throw new Error(`gen-source: no core chunk contains "${marker}"`);
}

const storeChunk = coreChunk('function createStateStore(');
const dynamicChunk = coreChunk('function resolveDynamicValue(');

/**
 * The call path an action actually takes, sliced from the installed packages.
 *
 * The actions lab walks these per scenario: spec field → renderer → provider →
 * your handler → back. Showing the real bodies is the whole point; a paraphrase
 * would not answer "where is onSuccess defined" or "what calls my handler".
 */
const libBlocks: Record<string, string> = {
  // --- the renderer side: what turns a press, or a state change, into a dispatch
  'Renderer.emit': between(
    reactDist,
    '  const emit = useCallback4(',
    '    [onBindings, execute, fullCtx, getSnapshot]\n  );',
    'Renderer.emit',
  ),
  'Renderer.watch': between(
    reactDist,
    '  useEffect2(() => {\n    if (!watchConfig || !watchedValues) return;',
    '  }, [watchConfig, watchedValues, execute, fullCtx, getSnapshot]);',
    'Renderer.watch',
  ),
  'resolveActionParam': between(coreDist, 'function resolveActionParam(value, ctx) {', '\n}\n', 'resolveActionParam'),

  // --- ActionProvider.execute, sliced into the branches it actually takes.
  // The whole callback is ~170 lines; nobody learns anything from that wall.
  'execute.dispatch': between(
    reactDist,
    '      const resolved = resolveAction(binding, getSnapshot());',
    '        at: dispatchedAt\n      });',
    'execute.dispatch',
  ),
  'execute.settle': between(reactDist, '      } catch (err) {', '        });\n      }', 'execute.settle'),
  'execute.lookup': between(
    reactDist,
    '        const handler = handlers[resolved.action];',
    '\n          return;\n        }',
    'execute.lookup',
  ),
  'execute.confirmBranch': between(reactDist, '        if (resolved.confirm) {', '          });\n        }', 'execute.confirmBranch'),
  'execute.callHandler': between(
    reactDist,
    '        setLoadingActions((prev) => new Set(prev).add(resolved.action));\n        try {',
    '          });\n        } finally {',
    'execute.callHandler',
  ),
  'builtin.setState': between(
    reactDist,
    '        if (resolved.action === "setState" && resolved.params) {',
    '\n          return;\n        }',
    'builtin.setState',
  ),
  'builtin.pushState': between(
    reactDist,
    '        if (resolved.action === "pushState" && resolved.params) {',
    '\n          return;\n        }',
    'builtin.pushState',
  ),
  'builtin.removeState': between(
    reactDist,
    '        if (resolved.action === "removeState" && resolved.params) {',
    '\n          return;\n        }',
    'builtin.removeState',
  ),
  'deepResolveValue': between(reactDist, 'function deepResolveValue(value, get) {', '\n}\n', 'deepResolveValue'),
  'generateUniqueId': between(reactDist, 'function generateUniqueId() {', '\n}\n', 'generateUniqueId'),
  'builtin.validateForm': between(
    reactDist,
    '        if (resolved.action === "validateForm") {',
    '\n          return;\n        }',
    'builtin.validateForm',
  ),

  // --- what runs your handler, and what runs onSuccess / onError
  'resolveAction': between(coreDist, 'function resolveAction(binding, stateModel) {', '\n}\n', 'resolveAction'),
  'resolveDynamicValue': between(
    dynamicChunk,
    'function resolveDynamicValue(value, stateModel) {',
    '\n}\n',
    'resolveDynamicValue',
  ),
  'executeAction': between(coreDist, 'async function executeAction(ctx) {', '\n}\n', 'executeAction'),

  // --- the confirm dialog: who renders it, and what it is
  'ConfirmationDialogManager': between(
    reactDist,
    'function ConfirmationDialogManager() {',
    '\n}\n',
    'ConfirmationDialogManager',
  ),
  'ConfirmDialog': between(reactDist, 'function ConfirmDialog({', '\n}\n', 'ConfirmDialog'),
  'JSONUIProvider': between(reactDist, 'function JSONUIProvider({', '\n}\n', 'JSONUIProvider'),

  // --- validation: where the fourteen built-in checks live, and what registers a field
  'builtInValidationFunctions': between(
    coreDist,
    'var builtInValidationFunctions = {',
    '\n};\n',
    'builtInValidationFunctions',
  ),
  'runValidation': between(coreDist, 'function runValidation(config, ctx) {', '\n}\n', 'runValidation'),
  'runValidationCheck': between(coreDist, 'function runValidationCheck(check2, ctx) {', '\n}\n', 'runValidationCheck'),
  'useFieldValidation': between(reactDist, 'function useFieldValidation(path, config) {', '\n}\n', 'useFieldValidation'),
  'ValidationProvider.validateAll': between(
    reactDist,
    '  const validateAll = useCallback2(',
    '  );',
    'ValidationProvider.validateAll',
  ),

  // --- what decides whether an element exists at all
  'evaluateVisibility': between(coreDist, 'function evaluateVisibility(condition, ctx) {', '\n}\n', 'evaluateVisibility'),
  'evaluateCondition': between(coreDist, 'function evaluateCondition(cond, ctx) {', '\n}\n', 'evaluateCondition'),

  // --- the brake on a watcher loop
  'createStateStore': between(storeChunk, 'function createStateStore(initialState = {}) {', '\n}\n', 'createStateStore'),
};

/** Where THIS app hands its handlers to the provider. The other half of the chain. */
const playgroundSrc = read('components/playground/spec-playground.tsx');
libBlocks['SpecPlayground.provider'] = between(
  playgroundSrc,
  '              <JSONUIProvider',
  '</JSONUIProvider>',
  'SpecPlayground.provider',
).replace(/^ {14}/gm, '');

const catalogSrc = read('lib/demo/catalog.ts');
const componentsSrc = read('lib/demo/components.tsx');
const altSrc = read('lib/demo/alt-components.tsx');
const registrySrc = read('lib/demo/registry.tsx');
const guardSrc = read('lib/demo/guard.tsx');
const storeSrc = read('lib/demo/logging-store.ts');
const handlersSrc = read('lib/demo/action-handlers.ts');

// Component names come from the real module. A regex over the source text
// also matches the `actions` entries, which are not components.
const { demoComponents, demoActions } = (await import(path.join(ROOT, 'lib/demo/catalog.ts'))) as {
  demoComponents: Record<string, { example?: unknown }>;
  demoActions: Record<string, unknown>;
};
const names = Object.keys(demoComponents);

const catalogEntries: Record<string, string> = {};
const implEntries: Record<string, string> = {};
const altImplEntries: Record<string, string> = {};

for (const name of names) {
  const c = sliceEntry(catalogSrc, name);
  if (c) catalogEntries[name] = withLeadingComment(catalogSrc, c).replace(/^ {2}/gm, '');
  const impl = sliceEntry(componentsSrc, name);
  if (impl) implEntries[name] = withLeadingComment(componentsSrc, impl).replace(/^ {2}/gm, '');
  const alt = sliceEntry(altSrc, name);
  if (alt) altImplEntries[name] = withLeadingComment(altSrc, alt).replace(/^ {2}/gm, '');
}

/**
 * The catalog and registry a lab defines for itself.
 *
 * Several labs build their own instead of using the shared demo one, so the
 * notes drawer had nothing true to show for them. Captured from the top-level
 * `defineCatalog(` / `defineRegistry(` call down to its closing `});`.
 */
function sliceCall(src: string, needle: 'defineCatalog' | 'defineRegistry'): string | null {
  const lines = src.split('\n');
  // A real call, not the same words inside a sentence: these files explain
  // `defineRegistry(catalog, …)` in prose, and that matched first.
  const decl = new RegExp(`^(?:export )?(?:const|let)\\s+[\\w{}:, ]+=\\s*${needle}\\(`);
  const start = lines.findIndex((l) => decl.test(l));
  if (start === -1) return null;
  const close = lines.findIndex((l, i) => i > start && /^\}\);$/.test(l));
  if (close === -1) return null;
  const out = lines.slice(start, close + 1);
  // A handful of lines means the closer matched something else entirely.
  return out.length >= 8 ? out.join('\n') : null;
}

const LAB_FILES = [
  'components/lab/registry-inspector.tsx',
  'components/lab/expression-repl.tsx',
  'components/lab/condition-tester.tsx',
  'components/lab/hooks-lab.tsx',
  'components/lab/providers-lab.tsx',
  'components/lab/build-component-lab.tsx',
];

const labSetups: Record<string, string> = {};
for (const file of LAB_FILES) {
  const src = read(file);
  const parts = [sliceCall(src, 'defineCatalog'), sliceCall(src, 'defineRegistry')].filter(Boolean);
  if (parts.length > 0) labSetups[file] = parts.join('\n\n');
}

/**
 * The registry lab's own components, one per stage.
 *
 * That lab is about what a registry component receives, so the function doing
 * the receiving has to be readable beside its own output — and so does the
 * catalog entry that declares what it may be handed. Sliced from the real
 * file, so neither can drift from what ran.
 *
 * Each name appears three times in that file: the catalog entry, the lesson
 * registry's implementation, and the wireframe registry's. The file is cut at
 * the two `defineRegistry(` calls so each slice looks in the right third.
 */
const inspectorSrc = read('components/lab/registry-inspector.tsx');
const firstRegistry = inspectorSrc.indexOf('defineRegistry(lessonCatalog');
const secondRegistry = inspectorSrc.indexOf('defineRegistry(lessonCatalog', firstRegistry + 1);
if (firstRegistry === -1 || secondRegistry === -1) {
  throw new Error('gen-source: registry-inspector.tsx no longer has two defineRegistry calls');
}
const inspectorThirds = {
  catalog: inspectorSrc.slice(0, firstRegistry),
  lesson: inspectorSrc.slice(firstRegistry, secondRegistry),
  wireframe: inspectorSrc.slice(secondRegistry),
};

/**
 * The whole path an action takes in that lab, end to end.
 *
 * The `on` and `emit` stages were showing the component and the spec and
 * nothing in between, so "press me increments a counter" had no visible
 * mechanism: nothing on screen said where `bump` was declared, what
 * implemented it, or how it reached the provider. These are the four places,
 * sliced from the file that runs.
 */
const actionWiring = [
  '// 1. the CATALOG declares the action, so catalog.prompt() can list it',
  '//    and defineRegistry can demand an implementation.',
  'const lessonCatalog = defineCatalog(schema, {',
  '  components: { /* … */ },',
  between(inspectorSrc, '  actions: {\n    bump: { description:', '\n  },\n});', 'catalog.actions'),
  '',
  '// 2. the REGISTRY implements it. Required: because the catalog declares an',
  '//    action, TypeScript will not let defineRegistry omit one.',
  'const { registry: lessonRegistry, handlers: lessonHandlers } = defineRegistry(lessonCatalog, {',
  '  components: { /* … */ },',
  between(inspectorSrc, '  actions: {\n    // The only action this lab declares.', '\n  },\n});', 'registry.actions'),
  '',
  '// 3. defineRegistry returns `handlers`, a FACTORY: give it a way to write',
  '//    state and it returns the map the provider wants.',
  between(inspectorSrc, '  const handlers = useMemo(', '\n    [store],\n  );', 'lab.handlers').replace(/^ {2}/gm, ''),
  '',
  '// 4. the PROVIDER holds them. <Renderer> dispatches by name into this map;',
  '//    a name that is not here logs "Unknown action" and nothing happens.',
  '//    Worth knowing: ActionProvider does useState(initialHandlers), so it',
  '//    reads this prop ONCE, on mount. Hand it a new map on a later render',
  '//    and it is ignored — remount the provider (a key) when the handlers',
  '//    have to change. That is why this one is keyed on the stage.',
  between(inspectorSrc, '                <JSONUIProvider key={focus}', '</JSONUIProvider>', 'lab.provider').replace(
    /^ {16}/gm,
    '',
  ),
  '',
  '// 5. and the ELEMENT names it — that part is in the spec editor:',
  '//    "on": { "press": { "action": "bump" } }',
].join('\n');

/** The lesson components, in the order the stages meet them. */
const INSPECTOR_NAMES = [
  'PropsPrinter',
  'BoundInput',
  'CardBox',
  'SlotCard',
  'EventButton',
  'CounterButton',
  'Readout',
  'StreamCard',
  'Row',
];

const inspectorCatalog: Record<string, string> = {};
const inspectorEntries: Record<string, string> = {};
const wireframeEntries: Record<string, string> = {};

for (const name of INSPECTOR_NAMES) {
  // Deliberately loud. These strings are shown as "the code that drew the box
  // above", so a rename that silently empties one is worse than a failed build.
  const cat = sliceEntry(inspectorThirds.catalog, name, 4);
  const impl = sliceEntry(inspectorThirds.lesson, name, 4);
  const alt = sliceEntry(inspectorThirds.wireframe, name, 4);
  if (!cat || !impl || !alt) {
    throw new Error(`gen-source: registry-inspector.tsx is missing a catalog/registry/wireframe entry for "${name}"`);
  }
  inspectorCatalog[name] = withLeadingComment(inspectorThirds.catalog, cat).replace(/^ {4}/gm, '');
  inspectorEntries[name] = withLeadingComment(inspectorThirds.lesson, impl).replace(/^ {4}/gm, '');
  wireframeEntries[name] = alt.replace(/^ {4}/gm, '');
}

/**
 * A lab's own components: the catalog entry and the registry entry for each.
 *
 * Several labs define a catalog and a registry of their own, and each stage
 * shows the pair behind whatever it just rendered. Deliberately loud: these
 * strings are labelled "the code that drew the box above", so a rename that
 * silently empties one is worse than a failed build.
 */
function labComponents(file: string, names: string[], splitAt: string) {
  const src = read(file);
  const split = src.indexOf(splitAt);
  if (split === -1) throw new Error(`gen-source: ${file} has no "${splitAt}"`);

  const catalog: Record<string, string> = {};
  const impls: Record<string, string> = {};
  for (const name of names) {
    const cat = sliceEntry(src.slice(0, split), name, 4);
    const impl = sliceEntry(src.slice(split), name, 4);
    if (!cat || !impl) throw new Error(`gen-source: ${file} is missing an entry for "${name}"`);
    catalog[name] = withLeadingComment(src, cat).replace(/^ {4}/gm, '');
    impls[name] = withLeadingComment(src, impl).replace(/^ {4}/gm, '');
  }
  return { catalog, impls };
}

const cond = labComponents(
  'components/lab/condition-tester.tsx',
  ['Board', 'Toggle', 'Choice', 'Stepper', 'Note', 'Row'],
  'defineRegistry(condCatalog',
);

/**
 * The expressions lab's own components, and its `$computed` functions.
 *
 * Same contract as the registry lab: a stage shows one expression form
 * reaching one component, so the catalog entry and the function that received
 * the prop have to be readable beside the render.
 */
const exprSrc = read('components/lab/expression-repl.tsx');
const exprSplit = exprSrc.indexOf('defineRegistry(exprCatalog');
if (exprSplit === -1) throw new Error('gen-source: expression-repl.tsx has no defineRegistry(exprCatalog) call');

const EXPR_NAMES = ['Stack', 'Field', 'Sentence', 'Row', 'Switch'];
const exprCatalogEntries: Record<string, string> = {};
const exprImplEntries: Record<string, string> = {};

for (const name of EXPR_NAMES) {
  const cat = sliceEntry(exprSrc.slice(0, exprSplit), name, 4);
  const impl = sliceEntry(exprSrc.slice(exprSplit), name, 4);
  if (!cat || !impl) throw new Error(`gen-source: expression-repl.tsx is missing an entry for "${name}"`);
  exprCatalogEntries[name] = withLeadingComment(exprSrc, cat).replace(/^ {4}/gm, '');
  exprImplEntries[name] = withLeadingComment(exprSrc, impl).replace(/^ {4}/gm, '');
}

/** The `functions` map that `$computed` names resolve against. */
const exprFunctions = (() => {
  const start = exprSrc.indexOf('const FUNCTIONS: Record<string, ComputedFunction> = {');
  if (start === -1) throw new Error('gen-source: expression-repl.tsx has no FUNCTIONS map');
  const end = exprSrc.indexOf('\n};\n', start);
  if (end === -1) throw new Error('gen-source: expression-repl.tsx FUNCTIONS map is not closed');
  return exprSrc.slice(start, end + 3);
})();

/**
 * The DECLARATION half of an action, for the actions lab's wiring pane.
 *
 * That pane showed the handler and the provider — the two ends — and nothing
 * about how a name becomes an action in the first place. Without these, "why
 * does `notify` exist" has no answer anywhere on the page.
 */
const demoActionDecl = [
  between(catalogSrc, 'export const demoActions = {', '\n};\n', 'demoActions'),
  '',
  // Not `sliceCall`: this call is four lines, and that helper rejects anything
  // under eight on purpose (a short match is usually the wrong match).
  between(catalogSrc, 'export const demoCatalog = defineCatalog(', '\n});\n', 'demoCatalog'),
].join('\n');

const demoRegistryActions = sliceCall(registrySrc, 'defineRegistry') ?? '';
if (!demoRegistryActions) throw new Error('gen-source: lib/demo/registry.tsx has no defineRegistry call');

const actionNames = Object.keys(demoActions);

// The custom action handlers the actions lab dispatches. The lab shows the
// function behind every action a lesson uses, so these are sliced out the same
// way the component implementations are.
const { demoHandlers } = (await import(path.join(ROOT, 'lib/demo/action-handlers.ts'))) as {
  demoHandlers: Record<string, unknown>;
};
const handlerNames = Object.keys(demoHandlers);
const handlerEntries: Record<string, string> = {};
for (const name of handlerNames) {
  const h = sliceEntry(handlersSrc, name);
  if (h) handlerEntries[name] = withLeadingComment(handlersSrc, h).replace(/^ {2}/gm, '');
}

// Action declarations live in the same catalog file; the SourcePane shows them
// beside the components a spec binds.
for (const name of actionNames) {
  const c = sliceEntry(catalogSrc, name);
  if (c) catalogEntries[name] = withLeadingComment(catalogSrc, c).replace(/^ {2}/gm, '');
}

// Each component's `example` value, so the insert bar can drop a VALID stub
// rather than an empty props object that fails the catalog's Zod schema.
// Imported from the real catalog rather than parsed out of the source text.
const examples: Record<string, unknown> = {};
for (const [name, def] of Object.entries(demoComponents)) {
  examples[name] = def.example ?? {};
}

const out = `// GENERATED by scripts/gen-source.ts — do not edit.
// Regenerated on every \`bun dev\` and \`bun build\`.

export const CATALOG_ENTRIES: Record<string, string> = ${JSON.stringify(catalogEntries, null, 2)};

export const IMPL_ENTRIES: Record<string, string> = ${JSON.stringify(implEntries, null, 2)};

/** The same catalog entries, implemented a second way. See lib/demo/alt-components.tsx. */
export const ALT_IMPL_ENTRIES: Record<string, string> = ${JSON.stringify(altImplEntries, null, 2)};

/** The registry lab's own components: the entry, the function, the second function. */
export const INSPECTOR_CATALOG: Record<string, string> = ${JSON.stringify(inspectorCatalog, null, 2)};

/** Catalog → registry → handlers → provider → element, for the action stages. */
export const INSPECTOR_ACTION_WIRING: string = ${JSON.stringify(actionWiring)};

export const INSPECTOR_ENTRIES: Record<string, string> = ${JSON.stringify(inspectorEntries, null, 2)};

export const WIREFRAME_ENTRIES: Record<string, string> = ${JSON.stringify(wireframeEntries, null, 2)};

/** The conditions lab's own components. */
export const COND_CATALOG: Record<string, string> = ${JSON.stringify(cond.catalog, null, 2)};

export const COND_ENTRIES: Record<string, string> = ${JSON.stringify(cond.impls, null, 2)};

/** The expressions lab's own components and functions. */
export const EXPR_CATALOG: Record<string, string> = ${JSON.stringify(exprCatalogEntries, null, 2)};

export const EXPR_ENTRIES: Record<string, string> = ${JSON.stringify(exprImplEntries, null, 2)};

export const EXPR_FUNCTIONS: string = ${JSON.stringify(exprFunctions)};

/** The catalog + registry each of these labs defines for itself. */
export const LAB_SETUPS: Record<string, string> = ${JSON.stringify(labSetups, null, 2)};

export const DEMO_FILES: Record<string, string> = ${JSON.stringify(
  {
    'lib/demo/catalog.ts': catalogSrc,
    'lib/demo/components.tsx': componentsSrc,
    'lib/demo/alt-components.tsx': altSrc,
    'lib/demo/registry.tsx': registrySrc,
    'lib/demo/guard.tsx': guardSrc,
    'lib/demo/logging-store.ts': storeSrc,
    'lib/demo/action-handlers.ts': handlersSrc,
  },
  null,
  2,
)};

/**
 * The call path an action takes, sliced from the installed @json-render dist
 * and from this app's own provider call. Keys are what the actions lab labels
 * each step with.
 */
export const LIB_BLOCKS: Record<string, string> = ${JSON.stringify(libBlocks, null, 2)};

/** How an action is DECLARED: the catalog half, then the registry half. */
export const DEMO_ACTION_DECL: string = ${JSON.stringify(demoActionDecl)};

export const DEMO_REGISTRY_ACTIONS: string = ${JSON.stringify(demoRegistryActions)};

/** The custom action handlers, sliced from lib/demo/action-handlers.ts. */
export const HANDLER_ENTRIES: Record<string, string> = ${JSON.stringify(handlerEntries, null, 2)};

export const CATALOG_EXAMPLES: Record<string, unknown> = ${JSON.stringify(examples, null, 2)};

export const COMPONENT_NAMES: string[] = ${JSON.stringify(names)};
export const ACTION_NAMES: string[] = ${JSON.stringify(actionNames)};
export const HANDLER_NAMES: string[] = ${JSON.stringify(handlerNames)};
`;

writeFileSync(path.join(ROOT, 'lib/demo/source.generated.ts'), out);
console.log(
  `gen-source: ${Object.keys(catalogEntries).length} catalog entries, ${Object.keys(implEntries).length} impls, ${Object.keys(handlerEntries).length} handlers, ${Object.keys(libBlocks).length} lib blocks`,
);
