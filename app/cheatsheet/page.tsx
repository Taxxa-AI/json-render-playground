import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeBlock } from '@/components/playground/code-block';
import { CopyButton } from '@/components/playground/ui';
import { StepRef } from '@/components/shell/step-ref';

export const metadata: Metadata = {
  title: 'Cheat sheet · json-render',
  description: 'The whole library on one page. Every signature taken from the installed 0.20.0 .d.ts.',
};

/**
 * /cheatsheet — the whole library on one page.
 *
 * Every snippet below is copied from the installed package, not from memory:
 * types from `@json-render/{core,react}/dist/*.d.ts`, runtime behaviour from
 * `dist/index.mjs`. Nothing here is invented, including the argument names.
 *
 * Print: the page is a CSS multi-column flow with `break-inside-avoid` on every
 * card, hairlines instead of tints, and the copy buttons hidden. It fits on
 * roughly four A4 pages.
 */
export default function CheatSheet() {
  return (
    <div className="mx-auto w-full max-w-[1760px] px-4 py-10 sm:px-5 lg:px-10 lg:py-12 print:px-0 print:py-0">
      <header className="mb-6 print:mb-3">
        <h1 className="font-display text-[36px] leading-[1.1] tracking-tight text-foreground print:text-[22px]">
          json-render cheat sheet
        </h1>
        <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-muted-foreground print:text-[11px]">
          <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs text-foreground">@json-render/core</code>{' '}
          and{' '}
          <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs text-foreground">@json-render/react</code>{' '}
          v0.20.0. Signatures are verbatim from the installed type definitions. Deeper detail, live, is on{' '}
          <Link href="/reference" className="underline underline-offset-2 hover:text-foreground">
            /reference
          </Link>
          .
        </p>
      </header>

      <div className="gap-4 lg:columns-2 xl:columns-3 print:columns-2 print:gap-3">
        {/* ---------------------------------------------------------- spec */}
        <Sheet
          title="the spec"
          step="shape"
          refs={['el-root', 'el-elements', 'el-state']}
          copy={SPEC_TS}
          lang="typescript"
        >
          <p>
            A flat map. <code>children</code> holds <em>keys</em>, not objects — which is what makes a streamed UI one
            patch per element.
          </p>
          <p className="text-red-600 dark:text-red-400">
            <code>spec.state</code> is seed data for YOU. <code>&lt;Renderer&gt;</code> never reads it.
          </p>
        </Sheet>

        <Sheet title="element fields" step="shape" refs={['el-type', 'el-props', 'el-children', 'el-slots', 'el-visible', 'el-repeat', 'el-on', 'el-watch']} copy={ELEMENT_TS} lang="typescript">
          <p>
            <code>visible</code>, <code>on</code>, <code>repeat</code> and <code>watch</code> are element-level fields.
            Inside <code>props</code> they are inert — <code>validateSpec</code> has a code for each.
          </p>
          <p>
            There is no <code>slots.default</code>: the default slot IS <code>children</code>.
          </p>
        </Sheet>

        {/* --------------------------------------------------- expressions */}
        <Sheet
          title="prop expressions"
          step="expressions"
          refs={['expr-state', 'expr-bindstate', 'expr-binditem', 'expr-cond', 'expr-template', 'expr-computed', 'expr-item', 'expr-index']}
          copy={EXPR}
          lang="json"
        >
          <p>
            Eight <code>$</code>-keys, resolved before your component runs. Anything else is a literal — including an
            object with an unregistered <code>$</code>-key, which passes through with its inner expressions resolved.
          </p>
        </Sheet>

        <Sheet title="conditions" step="conditions" refs={['cond-truthy', 'cond-eq', 'cond-and', 'cond-or', 'cond-not']} copy={COND} lang="json">
          <p>
            <strong>One operator per object.</strong> With several, only the first match runs, in the order{' '}
            <code>eq, neq, gt, gte, lt, lte</code>. With none, truthiness. <code>not: true</code> inverts the result.
          </p>
          <p>
            One object uses exactly one of <code>$state</code>, <code>$item</code>, <code>$index</code>. An array is an
            implicit AND and cannot nest <code>$or</code>; use <code>$and</code> for that.
          </p>
          <p className="text-red-600 dark:text-red-400">
            A malformed condition is not an error and is not reliably hidden: an unknown operator is dropped and the
            path is checked for truthiness, an object with no <code>$</code>-key is always visible, a typo in{' '}
            <code>$state</code> is always false, and <code>null</code> or a string throws. Only{' '}
            <code>validateSpec</code> tells you — <code>invalid_visible</code>.
          </p>
        </Sheet>

        <Sheet title="repeat" step="lists" refs={['el-repeat', 'expr-item', 'expr-index', 'expr-binditem']} copy={REPEAT} lang="json">
          <p>
            The element renders once; its <code>children</code> render once per item. <code>key</code> names a field on
            the item to use as the React key.
          </p>
          <p>
            A <code>visible</code> on the same element is split: <code>$item</code>/<code>$index</code> conjuncts filter
            items, the rest gate the container.
          </p>
        </Sheet>

        {/* ------------------------------------------------------- actions */}
        <Sheet
          title="action binding"
          step="actions"
          refs={['act-binding', 'act-params', 'act-confirm', 'act-onsuccess', 'act-onerror', 'act-preventdefault', 'act-array']}
          copy={ACTION_TS}
          lang="typescript"
        >
          <p>
            Every event slot takes one binding or an array; an array runs in order, each awaited. <code>onError</code>{' '}
            has no <code>navigate</code>.
          </p>
        </Sheet>

        <Sheet
          title="built-in actions"
          step="actions"
          refs={['act-setstate', 'act-pushstate', 'act-removestate', 'act-validateform', 'act-pushpop']}
          copy={BUILTINS}
          lang="json"
        >
          <p>
            Four need no handler and no catalog entry, and are described in <code>catalog.prompt()</code> automatically.
            The React runtime also intercepts <code>push</code> / <code>pop</code> for screen navigation.
          </p>
          <p className="text-red-600 dark:text-red-400">
            All of them return before the confirm branch — <code>confirm</code> on a built-in is ignored.
          </p>
        </Sheet>

        {/* ---------------------------------------------------- validation */}
        <Sheet title="the 14 checks" step="validation" refs={['val-required', 'val-helpers', 'val-requiredif']} copy={CHECKS} lang="json">
          <p>
            <code>args</code> values are dynamic: <code>{'{ "$state": "/path" }'}</code> resolves before the check runs.
            An <em>unknown</em> check type returns <code>valid: true</code> — a field that always passes.
          </p>
        </Sheet>

        <Sheet
          title="validation results"
          step="validation"
          refs={['val-result', 'val-usefieldvalidation', 'act-validateform']}
          copy={VALIDATION_TS}
          lang="typescript"
        >
          <p>
            <code>validateForm</code> writes <code>{'{ valid, errors }'}</code> to <code>params.statePath</code> or{' '}
            <code>/formValidation</code>. It reports; it blocks nothing.
          </p>
        </Sheet>

        {/* ------------------------------------------------------ your code */}
        <Sheet
          title="ComponentContext"
          step="build-component"
          refs={['ctx-props', 'ctx-children', 'ctx-slots', 'ctx-emit', 'ctx-on', 'ctx-bindings', 'ctx-loading']}
          copy={CTX_TS}
          lang="typescript"
        >
          <p>
            One object, not a props spread. <code>props</code> is already resolved; <code>bindings</code> carries the
            write-back paths that <code>$bindState</code> / <code>$bindItem</code> produced.
          </p>
        </Sheet>

        <Sheet
          title="providers"
          step="providers"
          refs={['prov-jsonuiprovider', 'prov-renderer', 'prov-stateprovider', 'prov-actionprovider', 'prov-validationprovider', 'prov-visibilityprovider']}
          copy={PROVIDERS_TS}
          lang="typescript"
        >
          <p>
            <code>JSONUIProvider</code> composes State → Visibility → Validation → Action, plus the functions and
            directives contexts and a confirmation-dialog manager. Split it by hand and you must keep that order.
          </p>
          <p>
            Passing <code>store</code> is controlled mode: <code>initialState</code> and <code>onStateChange</code> are
            ignored.
          </p>
        </Sheet>

        <Sheet
          title="hooks"
          step="hooks"
          refs={['hook-useboundprop', 'hook-usestatevalue', 'hook-usestatestore', 'hook-useaction', 'hook-useisvisible', 'hook-usefieldvalidation', 'hook-userepeatscope']}
          copy={HOOKS_TS}
          lang="typescript"
        >
          <p>
            <code>useBoundProp</code> is the default inside a registry component; <code>useStateValue</code> is for a
            path the spec never bound.
          </p>
        </Sheet>

        <Sheet title="directives" step="directives" refs={['expr-directive', 'util-definedirective']} copy={DIRECTIVE_TS} lang="typescript">
          <p>
            <code>defineDirective</code> throws if the name does not start with <code>$</code> or collides with a
            built-in key. An unregistered directive passes through as a plain object.
          </p>
        </Sheet>

        {/* ------------------------------------------------------ utilities */}
        <Sheet
          title="core utilities"
          step="repair"
          refs={['util-validatespec', 'util-autofixspec', 'util-formatspecissues', 'util-isnonemptyspec', 'util-deepmergespec', 'util-difftopatches', 'util-nestedtoflat', 'util-flattotree', 'util-createstatestore', 'util-createstoreadapter']}
          copy={UTILS_TS}
          lang="typescript"
        >
          <p>
            <code>nestedToFlat</code> is in core; <code>flatToTree</code> is in the React package. Both invent nothing
            except keys — <code>nestedToFlat</code> numbers them <code>el-0</code>, <code>el-1</code>, positionally.
          </p>
        </Sheet>

        <Sheet title="validateSpec issue codes" step="repair" refs={['util-validatespec']} copy={CODES} lang="text">
          <p>
            Errors make <code>valid: false</code>; <code>orphaned_element</code> is a warning and only appears with{' '}
            <code>{'{ checkOrphans: true }'}</code>.
          </p>
        </Sheet>

        <Sheet
          title="streaming"
          step="streaming"
          refs={['util-compilespecstream', 'util-createspecstreamcompiler', 'util-parsespecstreamline', 'util-applyspecstreampatch', 'util-createmixedstreamparser', 'util-pipejsonrender']}
          copy={STREAM_TS}
          lang="typescript"
        >
          <p>
            One RFC 6902 op per line. Order is a rendering nicety, not a requirement — a child may arrive before its
            parent.
          </p>
        </Sheet>

        <Sheet title="the streaming state mirror" step="streaming" refs={['el-state', 'hook-useuistream']} copy={MIRROR} lang="tsx">
          <p>
            Patches to <code>/state/*</code> land on <code>spec.state</code>, which the renderer ignores. This is the
            line that turns a generated shell into a working UI.
          </p>
        </Sheet>

        <Sheet title="a defensive render path" step="limitations" refs={['util-autofixspec', 'util-validatespec', 'util-formatspecissues']} copy={DEFENSIVE} lang="typescript">
          <p>
            Lossless fixes always; withhold pruning until the last attempt, or you silently ship the half-empty UI.
            Feed <code>issues</code> back into the retry prompt verbatim.
          </p>
        </Sheet>

        {/* ------------------------------------------------------- failures */}
        <Sheet title="every silent failure" step="limitations" refs={['util-validatespec']} copy={SILENT}>
          <p>None of these throw. All render a plausible-looking wrong UI.</p>
          <Rows
            rows={[
              ['spec.state', 'Never read by the renderer. Generated UI renders as an empty shell.'],
              ['dangling child key', 'That branch disappears; console warns.'],
              ['unknown component type', 'Renders your fallback — or nothing, if you passed none.'],
              ['visible/on/repeat/watch in props', 'Inert. A button that does nothing.'],
              ['malformed visible', 'Not an error, and not reliably hidden: unknown operator -> truthiness check on the path; no $-key -> always visible; typo\u2019d $state -> always false; null or a string -> throws. validateSpec: invalid_visible.'],
              ['unregistered $computed', 'undefined. A blank prop, warned once per name.'],
              ['unregistered directive', 'Passes through as an object. Component gets the wrong type.'],
              ['unknown check type', 'valid: true. A field that always passes.'],
              ['missing $bindState', '"I cannot type in this field."'],
              ['validateForm', 'Reports, does not block.'],
              ['merge/diff via useUIStream', 'Dropped. An edit that changes nothing.'],
              ['confirm on a built-in', 'Bypassed entirely.'],
              ['array in a watch entry', 'Runs only up to and including its first state-changing binding; the rest are dropped. One binding per entry.'],
              ['$bindItem outside a repeat', 'undefined, warned.'],
            ]}
          />
        </Sheet>

        <Sheet title="what a spec cannot do" step="limitations" refs={['expr-computed', 'el-watch']} copy={CANNOT}>
          <Rows
            rows={[
              ['no logic', 'No arithmetic, no property access, no methods. /items/length is a key lookup. $computed is the only escape.'],
              ['no styling', 'No colours, widths, margins or classes. The only lever is a prop you chose to expose.'],
              ['no lifecycle', 'watch fires on change only. Nothing runs on mount or on an interval.'],
              ['no local state', 'One flat model. Two bound controls on one path are one control.'],
              ['no state schema', 'Nothing declares which paths exist. A typo is undefined.'],
              ['no code', 'No eval, no handler bodies. It can only name things you implemented — the strong property.'],
            ]}
          />
        </Sheet>
      </div>

      <footer className="mt-8 border-t pt-4 text-[13px] text-muted-foreground print:mt-4 print:text-[10px]">
        Every signature here came from{' '}
        <code className="font-mono">node_modules/@json-render/{'{core,react}'}/dist/*.d.ts</code> at v0.20.0. When you
        upgrade, re-read the .d.ts before you trust this page.
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ chrome */

function Sheet({
  title,
  step,
  refs,
  copy,
  lang,
  children,
}: {
  title: string;
  step: string;
  refs: string[];
  /** The text the copy button puts on the clipboard; rendered as code when `lang` is set. */
  copy: string;
  lang?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 inline-block w-full break-inside-avoid overflow-hidden rounded-lg border bg-card print:mb-2 print:rounded-none">
      <header className="flex items-center justify-between gap-2 border-b bg-muted px-3 py-1.5 print:bg-transparent">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{title}</span>
        <span className="print:hidden">
          <CopyButton text={copy} />
        </span>
      </header>

      {lang && (
        <div className="border-b">
          <CodeBlock code={copy} lang={lang} maxHeight="none" showLineNumbers={false} />
        </div>
      )}

      <div className="space-y-1.5 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground print:text-[10px] [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-foreground print:[&_code]:bg-transparent">
        {children}
      </div>

      <footer className="flex flex-wrap items-center gap-1 border-t px-3 py-1.5 print:hidden">
        <StepRef slug={step} short />
        {refs.map((r) => (
          <Link
            key={r}
            href={`/reference#${r}`}
            className="rounded-sm border bg-surface px-1 py-px font-mono text-[10.5px] text-muted-foreground no-underline transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            {r}
          </Link>
        ))}
      </footer>
    </section>
  );
}

function Rows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="mt-1 divide-y border-t">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[40%_1fr] gap-2 py-1.5">
          <dt className="font-mono text-[11.5px] text-foreground">{k}</dt>
          <dd className="text-[12.5px] leading-snug text-muted-foreground print:text-[10px]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------- snippets --
 * All copied from the installed .d.ts / .mjs. Do not paraphrase.
 */

const SPEC_TS = `interface Spec {
  root: string;                          // key of the root element
  elements: Record<string, UIElement>;   // FLAT map — children are keys
  state?: Record<string, unknown>;       // seed data. <Renderer> NEVER reads it.
}`;

const ELEMENT_TS = `interface UIElement<T extends string = string,
                    P = Record<string, unknown>> {
  type: T;                     // a catalog component name
  props: P;                    // expressions resolved before render
  children?: string[];         // keys — this IS the default slot
  slots?: Record<string, string[]>;      // named slots only, never "default"
  visible?: VisibilityCondition;
  on?: Record<string, ActionBinding | ActionBinding[]>;
  repeat?: { statePath: string | { $item: string }; key?: string };
  watch?: Record<string, ActionBinding | ActionBinding[]>;
}`;

const EXPR = `{ "$state":     "/user/name" }          // read the state model
{ "$bindState": "/form/email" }        // read + expose a write-back path
{ "$item":      "title" }              // field on the repeat item ("" = item)
{ "$index":     true }                 // repeat index (a sentinel, not a path)
{ "$bindItem":  "done" }               // two-way bind a field on the item
{ "$cond": <condition>,                // pick a value
  "$then": <expr>, "$else": <expr> }
{ "$computed": "fnName",               // call a registered function
  "args": { "v": { "$state": "/n" } } }
{ "$template": "Hi \${/user/name} and \${field}" }   // missing -> ""`;

const COND = `true | false                                // literal
{ "$state": "/flag" }                       // truthiness
{ "$state": "/count", "gt": 5 }             // eq neq gt gte lt lte
{ "$state": "/count", "gt": { "$state": "/min" } }   // dynamic rhs
{ "$state": "/flag", "not": true }          // invert the whole result
[ {...}, {...} ]                            // implicit AND
{ "$and": [ ... ] }   { "$or": [ ... ] }    // explicit, nestable
{ "$item": "status", "eq": "todo" }         // inside a repeat
{ "$index": true, "lt": 3 }`;

const REPEAT = `{ "type": "Stack", "props": {},
  "repeat": { "statePath": "/tasks", "key": "id" },
  "visible": { "$item": "status", "eq": "todo" },
  "children": ["row"] }

// nested: relative to the enclosing item — invalid outside a repeat
{ "repeat": { "statePath": { "$item": "comments" }, "key": "id" } }`;

const ACTION_TS = `interface ActionBinding {
  action: string;                             // catalog name or a built-in
  params?: Record<string, DynamicValue>;      // literal | { $state: "/path" }
  confirm?: { title: string; message: string;
              confirmLabel?: string; cancelLabel?: string;
              variant?: "default" | "danger" };
  onSuccess?: { navigate: string }
            | { set: Record<string, unknown> }
            | { action: string; params?: Record<string, DynamicValue> };
  onError?:   { set: Record<string, unknown> }
            | { action: string; params?: Record<string, DynamicValue> };
  preventDefault?: boolean;
}`;

const BUILTINS = `{ "action": "setState",
  "params": { "statePath": "/tab", "value": "b" } }

{ "action": "pushState",
  "params": { "statePath": "/todos",
              "value": { "id": "$id", "text": { "$state": "/draft" } },
              "clearStatePath": "/draft" } }      // cleared to ""

{ "action": "removeState",
  "params": { "statePath": "/todos", "index": 2 } }

{ "action": "validateForm",
  "params": { "statePath": "/formValidation" } }   // default path

// React-only, not advertised in the prompt:
{ "action": "push", "params": { "screen": "detail" } }
{ "action": "pop" }`;

const CHECKS = `{ "type": "required",    "message": "..." }
{ "type": "email",       "message": "..." }
{ "type": "minLength",   "args": { "min": 8 },  "message": "..." }
{ "type": "maxLength",   "args": { "max": 140 }, "message": "..." }
{ "type": "pattern",     "args": { "pattern": "^[A-Z]" }, "message": "..." }
{ "type": "min",         "args": { "min": 0 },   "message": "..." }
{ "type": "max",         "args": { "max": 99 },  "message": "..." }
{ "type": "numeric",     "message": "..." }
{ "type": "url",         "message": "..." }
{ "type": "matches",     "args": { "other": { "$state": "/a" } }, "message": "..." }
{ "type": "equalTo",     "args": { "other": { "$state": "/a" } }, "message": "..." }
{ "type": "lessThan",    "args": { "other": { "$state": "/a" } }, "message": "..." }
{ "type": "greaterThan", "args": { "other": { "$state": "/a" } }, "message": "..." }
{ "type": "requiredIf",  "args": { "field": { "$state": "/a" } }, "message": "..." }`;

const VALIDATION_TS = `interface ValidationResult {
  valid: boolean;
  errors: string[];                 // messages of the failed checks
  checks: { type: string; valid: boolean; message: string }[];
}

// what the validateForm action writes to state:
{ valid: boolean, errors: Record<string /* field path */, string[]> }

useFieldValidation(path, config?) => {
  state: { touched: boolean; validated: boolean; result: ValidationResult | null };
  validate(): ValidationResult; touch(): void; clear(): void;
  errors: string[]; isValid: boolean;
}`;

const CTX_TS = `interface BaseComponentProps<P = Record<string, unknown>> {
  props: P;                            // ALREADY RESOLVED
  children?: ReactNode;                // the default slot
  slots?: Record<string, ReactNode>;   // named slots, already rendered
  emit: (event: string) => void;       // fire; no-op when unbound
  on: (event: string) => {             // the handle, when you need metadata
    emit(): void; shouldPreventDefault: boolean; bound: boolean };
  bindings?: Record<string, string>;   // prop name -> absolute state path
  loading?: boolean;
}`;

const PROVIDERS_TS = `interface JSONUIProviderProps {
  registry: ComponentRegistry;
  store?: StateStore;                   // controlled mode
  initialState?: Record<string, unknown>;   // uncontrolled only
  handlers?: Record<string, (params: Record<string, unknown>) => unknown>;
  navigate?: (path: string) => void;
  validationFunctions?: Record<string,
    (value: unknown, args?: Record<string, unknown>) => boolean>;
  functions?: Record<string, ComputedFunction>;   // for $computed
  directives?: DirectiveDefinition[];
  onStateChange?: (changes: { path: string; value: unknown }[]) => void;
  children: ReactNode;
}

interface RendererProps {
  spec: Spec | null;
  registry: ComponentRegistry;
  loading?: boolean;                  // suppresses missing-child warnings
  fallback?: ComponentRenderer;       // for unknown types
}`;

const HOOKS_TS = `useStateStore()          // { state, get, set, update, getSnapshot }
useStateValue<T>(path)   // T | undefined — subscribe to any path
useBoundProp<T>(value, bindingPath)      // [T | undefined, (v: T) => void]
useIsVisible(condition)  // boolean, in the current repeat scope
useVisibility()          // { isVisible, ctx }
useAction(binding)       // { execute, isLoading }
useActions()             // { handlers, loadingActions, pendingConfirmation,
                         //   execute, confirm, cancel, registerHandler }
useFieldValidation(path, config?)        // registers the field for validateForm
useValidation() / useOptionalValidation()
useRepeatScope()         // { item, index, basePath } | null
useUIStream({ api })     // { spec, isStreaming, error, usage, rawLines, send, clear }
useChatUI({ api })       // { messages, isStreaming, error, send, clear }
useJsonRenderMessage(parts)              // { spec, text, hasSpec }`;

const DIRECTIVE_TS = `const format = defineDirective({
  name: "$format",                       // must start with $, no built-in name
  description: "Locale-aware formatting.",   // goes into catalog.prompt()
  schema: z.object({ $format: z.enum(["date", "currency"]), value: z.unknown() }),
  resolve(value, ctx) {                  // ctx: PropResolutionContext
    const v = resolvePropValue(value.value, ctx);   // compose with built-ins
    return new Intl.NumberFormat().format(v as number);
  },
});

<JSONUIProvider directives={[format]} ... />
catalog.prompt({ directives: [format] })   // pass the same array`;

const UTILS_TS = `// @json-render/core
defineSchema(builder, options?)                       => Schema
defineCatalog(schema, catalog)                        => Catalog
catalog.prompt(options?)      / catalog.jsonSchema({ strict })
catalog.validate(spec)        => { success, data?, error? }   // shape, not props
validateSpec(spec, { checkOrphans? })   => { valid, issues }
autoFixSpec(spec, { lossy? })           => { spec, fixes, fixDetails }
formatSpecIssues(issues)                => string   // errors only
isNonEmptySpec(spec)                    => spec is Spec
deepMergeSpec(base, patch)              // RFC 7396: null deletes, arrays replace
diffToPatches(oldObj, newObj, basePath?) => JsonPatch[]   // arrays swap whole
nestedToFlat(nested)                    => Spec     // invents el-0, el-1 ...
createStateStore(initialState?)         => StateStore

// @json-render/core/store-utils  — a SEPARATE subpath, not the main entry
createStoreAdapter({ getSnapshot, setSnapshot, subscribe }) => StateStore
flattenToPointers(obj, prefix?)   // { user: { name } } => { "/user/name": ... }
immutableSetByPath(root, path, value)
defineDirective(def) / createDirectiveRegistry(defs)
registerActionObserver({ onDispatch, onSettle }) => () => void
resolvePropValue(value, ctx) / evaluateVisibility(condition, ctx)
getByPath / setByPath / addByPath / removeByPath   // RFC 6901 pointers

// @json-render/react
defineRegistry(catalog, { components, actions })
  => { registry, handlers, executeAction }
flatToTree(elements)   // FlatElement[] with key/parentKey => Spec
createRenderer(catalog, components)`;

const CODES = `errors
  missing_root              root missing or empty
  root_not_found            root key is not in elements
  empty_spec                elements is {}
  missing_child             a children/slots key does not exist
  invalid_visible           condition fails the strict schema
  repeat_without_children   repeat with nothing to repeat
  repeat_item_outside_scope { $item } statePath with no enclosing repeat
  repeat_state_mismatch     repeat path is not an array in spec.state
  visible_in_props          \\
  on_in_props                | field placed inside props
  repeat_in_props            | (autoFixSpec relocates all four, losslessly)
  watch_in_props            /

warning  (only with { checkOrphans: true })
  orphaned_element          not reachable from root`;

const STREAM_TS = `parseSpecStreamLine(line)            => JsonPatch | null   // null = not a patch
compileSpecStream(stream, initial?)  => T                 // one-shot
createSpecStreamCompiler<T>(initial?) => {
  push(chunk): { result: T; newPatches: JsonPatch[] };
  getResult(); getPatches(); reset(initial?);
}
applySpecStreamPatch(obj, patch)     // mutates; all six RFC 6902 ops
applySpecPatch(spec, patch)          // typed wrapper; also mutates
createMixedStreamParser({ onPatch, onText })  // per LINE; call flush()
createJsonRenderTransform()          // AI SDK: \`\`\`spec fences, else heuristic
pipeJsonRender(stream)               // the same, without the cast
SPEC_DATA_PART === "spec"   SPEC_DATA_PART_TYPE === "data-spec"`;

const MIRROR = `import { createStateStore } from '@json-render/core';
import { flattenToPointers } from '@json-render/core/store-utils';  // subpath!

const { spec, isStreaming } = useUIStream({ api: "/api/generate" });
const store = useMemo(() => createStateStore({}), []);

// Patches to /state/* land on spec.state, which <Renderer> ignores.
// Mirror them into the store, or the generated UI renders as an empty shell.
useEffect(() => {
  if (!spec?.state) return;
  store.update(flattenToPointers(spec.state));
}, [spec?.state, store]);

<JSONUIProvider registry={registry} store={store}>
  <Renderer spec={spec} registry={registry} loading={isStreaming} fallback={Unknown} />
</JSONUIProvider>`;

const DEFENSIVE = `import { validateSpec, autoFixSpec, isNonEmptySpec, formatSpecIssues } from '@json-render/core';

function prepare(raw: unknown, attempt: number, maxAttempts: number) {
  if (!isNonEmptySpec(raw)) return { ok: false, reason: 'empty' } as const;

  // Lossless fixes always; withhold pruning until the last attempt.
  const lastChance = attempt >= maxAttempts;
  const { spec, fixDetails } = autoFixSpec(raw, { lossy: lastChance });

  const { valid, issues } = validateSpec(spec);
  if (!valid && !lastChance) {
    return { ok: false, reason: 'retry', prompt: formatSpecIssues(issues) } as const;
  }

  log({ fixes: fixDetails, issues });
  return { ok: true, spec } as const;
}`;

const SILENT = `SILENT FAILURES — none throw, none log a stack

spec.state                     never read by the renderer; seed the store yourself
dangling child key             branch disappears (console warning)
unknown component type         renders your "fallback", or nothing
visible/on/repeat/watch in props   inert
malformed visible              NOT reliably false. unknown operator -> truthiness
                               check on the path; no $-key -> always visible;
                               typo'd $state -> always false; null/string -> throws.
                               validateSpec is the only detector: invalid_visible
unregistered $computed         undefined, warned once per name
unregistered directive         passes through as a plain object
unknown check type             valid: true — a field that always passes
missing $bindState             the input is read-only
validateForm                   reports, does not block
merge/diff via useUIStream     dropped
confirm on a built-in action   bypassed
array in a watch entry         runs up to and including the first binding that
                               writes state; the rest are dropped. the write
                               tears down the effect running them. one binding
                               per watch entry, chained through the paths
$bindItem outside a repeat     undefined, warned`;

const CANNOT = `WHAT A SPEC CANNOT DO

no logic        no arithmetic, property access or methods. /items/length is a
                key lookup that resolves to undefined. $computed is the escape.
no styling      no colours, widths, margins or classes — only props you exposed
no lifecycle    watch fires on change only; nothing on mount or on a timer
no local state  one flat model; two bindings to one path are one control
no state schema nothing declares which paths exist; a typo is undefined
no code         no eval, no handler bodies — it can only name what you built`;
