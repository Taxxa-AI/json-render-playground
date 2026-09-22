'use client';

import type { Spec, VisibilityCondition } from '@json-render/core';
import { createStateStore, defineCatalog } from '@json-render/core';
import {
  defineRegistry,
  JSONUIProvider,
  Renderer,
  useAction,
  useActions,
  useBoundProp,
  useFieldValidation,
  useIsVisible,
  useOptionalValidation,
  useRepeatScope,
  useStateBinding,
  useStateStore,
  useStateValue,
  useValidation,
  useVisibility,
} from '@json-render/react';
import { schema } from '@json-render/react/schema';
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { CodeBlock } from '../playground/code-block';
import { JsonEditor } from '../playground/json-editor';
import { StepRef } from '@/components/shell/step-ref';
import { Chip, Panel, Pill } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { usePublishSetup } from '@/lib/labs/setup';
import { LAB_SETUPS } from '@/lib/demo/source.generated';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';

/**
 * Every hook `@json-render/react` 0.20.0 exposes to a registry component,
 * one probe at a time.
 *
 * Each probe is a real registry component in the local catalog below, rendered
 * by the real `Renderer` inside a real `JSONUIProvider`, against ONE shared
 * store — so a write made by the useStateStore probe is still there when you
 * open the useStateValue probe.
 *
 * Signatures verified against node_modules/@json-render/react/dist/index.d.ts
 * and the implementations in dist/index.mjs (`useStateStore`, `useStateValue`,
 * `useStateBinding`, `useBoundProp`, `useActions`, `useAction`, `useVisibility`,
 * `useIsVisible`, `useValidation`, `useOptionalValidation`,
 * `useFieldValidation`, `useRepeatScope`).
 */

// ---------------------------------------------------------------- chrome ---

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-[86px] shrink-0 text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-all text-foreground">{children}</span>
    </div>
  );
}

function Mini({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 flex-1 rounded-sm border bg-background px-2 py-0.5 font-mono text-[12px] text-foreground outline-none focus:border-orange-400"
    />
  );
}

/**
 * Which hook the current stage is about.
 *
 * Provided by the LAB from the stage it is on, the same way the registry lab
 * provides `ContextFocus`: one stage teaches one hook, so the chip row has to
 * follow the rail instead of offering ten other probes to wander into.
 *
 * Space-separated, because `useIsVisible` and `useVisibility` are two sides of
 * one evaluator and share a stage as two parts.
 */
const HookFocus = createContext<string | undefined>(undefined);

// --------------------------------------------------------------- catalog ---

const hooksCatalog = defineCatalog(schema, {
  components: {
    Box: {
      description: 'Layout box. Wraps probes so a spec can have more than one root child.',
      props: z.object({ title: z.string().nullable() }),
      slots: ['default'],
    },
    BoundProbe: {
      description: 'useBoundProp — two-way binding from the bindings map.',
      props: z.object({ value: z.unknown().nullable() }),
      slots: [],
    },
    ValueProbe: {
      description: 'useStateValue — read one path.',
      props: z.object({ path: z.string() }),
      slots: [],
    },
    StoreProbe: {
      description: 'useStateStore — the whole state context.',
      props: z.object({}),
      slots: [],
    },
    BindingProbe: {
      description: 'useStateBinding — deprecated path-based read/write pair.',
      props: z.object({ path: z.string() }),
      slots: [],
    },
    ActionProbe: {
      description: 'useAction — dispatch one binding, with isLoading.',
      props: z.object({ message: z.string() }),
      slots: [],
    },
    ActionsProbe: {
      description: 'useActions — the whole action context.',
      props: z.object({}),
      slots: [],
    },
    VisibleProbe: {
      description: 'useIsVisible — evaluate a condition object.',
      props: z.object({ condition: z.unknown().nullable() }),
      slots: [],
    },
    VisibilityProbe: {
      description: 'useVisibility — the evaluator plus its context.',
      props: z.object({}),
      slots: [],
    },
    FieldProbe: {
      description: 'useFieldValidation — field state, errors, touch, validate, clear.',
      props: z.object({ value: z.unknown().nullable() }),
      slots: [],
    },
    OptionalProbe: {
      description: 'useOptionalValidation — null instead of throwing.',
      props: z.object({}),
      slots: [],
    },
    ScopeProbe: {
      description: 'useRepeatScope — item, index and basePath inside a repeat.',
      props: z.object({}),
      slots: [],
    },
  },
  actions: {},
});

// ---------------------------------------------------------------- probes ---
//
// Each probe keeps its source beside it. The strings below are the same code
// with the Tailwind classes stripped — the hook calls, arguments and returned
// fields are verbatim.

const SRC_BOUND = `const BoundProbe = ({ props, bindings }) => {
  // propValue is already RESOLVED; bindings.value is the path it came from.
  const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);

  return (
    <>
      <Line label="props.value">{String(value)}</Line>
      <Line label="bindings">{bindings?.value ?? '(unbound — setValue is a no-op)'}</Line>
      <input value={value ?? ''} onChange={(e) => setValue(e.target.value)} />
    </>
  );
};`;

const SRC_VALUE = `const ValueProbe = ({ props }) => {
  const value = useStateValue<unknown>(props.path);   // T | undefined
  const renders = useRef(0);
  renders.current += 1;

  return (
    <>
      <Line label="path">{props.path}</Line>
      <Line label="value">{JSON.stringify(value)}</Line>
      <Line label="renders">{renders.current}</Line>
    </>
  );
};`;

const SRC_STORE = `const StoreProbe = () => {
  const { state, get, set, update, getSnapshot } = useStateStore();

  return (
    <>
      <Line label="keys">{Object.keys(state).join(', ')}</Line>
      <Line label="get()">{String(get('/count'))}</Line>
      <button onClick={() => set('/count', ((get('/count') as number) ?? 0) + 1)}>+1</button>
      <button onClick={() => update({ '/count': 0, '/form/draft': '' })}>update() batch</button>
      <button onClick={() => console.log(getSnapshot())}>getSnapshot()</button>
    </>
  );
};`;

const SRC_BINDING = `const BindingProbe = ({ props }) => {
  // @deprecated — takes a raw path, so it cannot see $bindItem inside a repeat.
  const [value, setValue] = useStateBinding<string>(props.path);

  return <input value={value ?? ''} onChange={(e) => setValue(e.target.value)} />;
};`;

const SRC_ACTION = `const ActionProbe = ({ props }) => {
  // useAction takes an ActionBinding OBJECT, not a name. Memoise it:
  // the returned execute() is useCallback'd on the binding identity.
  const binding = useMemo(
    () => ({ action: 'notify', params: { message: props.message, at: { $state: '/count' } } }),
    [props.message],
  );
  const { execute, isLoading } = useAction(binding);

  return (
    <button onClick={() => execute()} disabled={isLoading}>
      {isLoading ? 'running…' : 'dispatch notify'}
    </button>
  );
};`;

const SRC_ACTIONS = `const ActionsProbe = () => {
  // The context also carries confirm() and cancel(), for driving your own
  // confirmation UI instead of the built-in ConfirmDialog.
  const { handlers, loadingActions, pendingConfirmation, execute, registerHandler } = useActions();

  return (
    <>
      <Line label="handlers">{Object.keys(handlers).join(', ')}</Line>
      <Line label="loading">{[...loadingActions].join(', ') || '(none)'}</Line>
      <Line label="pending">{pendingConfirmation ? pendingConfirmation.action.action : 'null'}</Line>
      {/* execute() takes any binding — including the built-ins, which need no handler. */}
      <button onClick={() => execute({ action: 'setState', params: { statePath: '/count', value: 10 } })}>
        execute(setState /count = 10)
      </button>
      <button onClick={() => registerHandler('lateComer', async () => {})}>registerHandler()</button>
    </>
  );
};`;

const SRC_VISIBLE = `const VisibleProbe = ({ props }) => {
  // The condition arrives as a JSON STRING, not an object. A condition is
  // expression-shaped — { "$state": "/count", gt: 2 } is a \`$state\` read to
  // resolvePropValue — so written as an object in the spec it is resolved
  // away before the probe runs, and useIsVisible gets the number 0.
  const condition = parseCondition(props.condition);

  // The same evaluator the renderer uses for an element's own \`visible\`,
  // but here you can branch on it inside your component.
  const visible = useIsVisible(condition);

  return <Pill tone={visible ? 'ok' : 'idle'}>{String(visible)}</Pill>;
};`;

/**
 * A condition prop, read back out of the spec.
 *
 * Props reach a component RESOLVED, and a visibility condition is itself an
 * expression shape, so an object here never survives the trip: the renderer
 * turns { "$state": "/count", gt: 2 } into whatever /count holds and
 * `useIsVisible(0)` throws inside `isIndexCondition`. Carrying it as a string
 * is the one shape resolvePropValue passes through untouched.
 */
function parseCondition(raw: unknown): VisibilityCondition | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  try {
    return JSON.parse(raw) as VisibilityCondition;
  } catch {
    return undefined;
  }
}

const SRC_VISIBILITY = `const VisibilityProbe = () => {
  const { isVisible, ctx } = useVisibility();

  return (
    <>
      <Line label="ctx">{Object.keys(ctx).join(', ')}</Line>
      <Line label="stateModel">{Object.keys(ctx.stateModel).join(', ')}</Line>
      <Line label="ad hoc">{String(isVisible({ $state: '/form/draft' }))}</Line>
    </>
  );
};`;

const SRC_FIELD = `const FieldProbe = ({ props, bindings }) => {
  const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);

  // Registering is what makes the built-in validateForm action see this field.
  const field = useFieldValidation(bindings?.value ?? '/unbound', {
    checks: [{ type: 'email', message: 'Enter a valid email' }],
    validateOn: 'blur',
  });

  return (
    <>
      <input value={value ?? ''} onChange={(e) => setValue(e.target.value)} onBlur={() => { field.touch(); field.validate(); }} />
      <Line label="state">{JSON.stringify(field.state)}</Line>
      <Line label="errors">{JSON.stringify(field.errors)}</Line>
      <Line label="isValid">{String(field.isValid)}</Line>
      <button onClick={() => field.clear()}>clear()</button>
    </>
  );
};`;

const SRC_OPTIONAL = `const OptionalProbe = () => {
  // useValidation() THROWS without a ValidationProvider. This one returns null.
  const validation = useOptionalValidation();

  return <Line label="returns">{validation ? Object.keys(validation).join(', ') : 'null'}</Line>;
};`;

const SRC_SCOPE = `const ScopeProbe = () => {
  const scope = useRepeatScope();          // null outside a repeat — never throws
  const { set } = useStateStore();
  if (!scope) return <Line label="scope">null — not inside a repeat</Line>;

  const { item, index, basePath } = scope;
  return (
    <>
      <Line label="index">{index}</Line>
      <Line label="basePath">{basePath}</Line>
      <Line label="item">{JSON.stringify(item)}</Line>
      {/* basePath is why $bindItem can write: it is an absolute state path. */}
      <input value={item.title} onChange={(e) => set(basePath + '/title', e.target.value)} />
    </>
  );
};`;

const { registry: hooksRegistry } = defineRegistry(hooksCatalog, {
  components: {
    Box: ({ props, children }) => (
      <div className="flex flex-col gap-2 rounded-md border bg-background p-2.5 font-mono text-[12px]">
        {props.title && (
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{props.title}</div>
        )}
        {children}
      </div>
    ),

    BoundProbe: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<string>(props.value as string, bindings?.value);
      return (
        <div className="flex flex-col gap-1.5">
          <Line label="props.value">{String(value)}</Line>
          <Line label="bindings">
            {bindings?.value ? (
              <span className="text-emerald-600 dark:text-emerald-400">{bindings.value}</span>
            ) : (
              <span className="text-yellow-600 dark:text-yellow-400">(unbound — setValue is a no-op)</span>
            )}
          </Line>
          <div className="flex gap-1.5">
            <Input value={value ?? ''} onChange={setValue} placeholder="writes /form/draft" />
          </div>
        </div>
      );
    },

    ValueProbe: ({ props }) => {
      const value = useStateValue<unknown>(props.path);
      const renders = useRef(0);
      renders.current += 1;
      return (
        <div className="flex flex-col gap-1.5">
          <Line label="path">{props.path}</Line>
          <Line label="value">{JSON.stringify(value) ?? 'undefined'}</Line>
          <Line label="renders">
            <span className="tabular-nums text-orange-600 dark:text-orange-400">{renders.current}</span>{' '}
            <span className="text-muted-foreground">— goes up on every write, to any path</span>
          </Line>
        </div>
      );
    },

    StoreProbe: () => {
      const { state, get, set, update, getSnapshot } = useStateStore();
      const [snap, setSnap] = useState<string>('—');
      return (
        <div className="flex flex-col gap-1.5">
          <Line label="keys">{Object.keys(state).join(', ')}</Line>
          <Line label="get('/count')">{String(get('/count'))}</Line>
          <Line label="getSnapshot">{snap}</Line>
          <div className="flex flex-wrap gap-1.5">
            <Mini onClick={() => set('/count', ((get('/count') as number) ?? 0) + 1)}>set → +1</Mini>
            <Mini onClick={() => update({ '/count': 0, '/form/draft': '' })}>update() batch</Mini>
            <Mini onClick={() => setSnap(`${Object.keys(getSnapshot()).length} keys, live`)}>getSnapshot()</Mini>
          </div>
        </div>
      );
    },

    BindingProbe: ({ props }) => {
      const [value, setValue] = useStateBinding<string>(props.path);
      return (
        <div className="flex flex-col gap-1.5">
          <Line label="path">{props.path}</Line>
          <Line label="value">{String(value)}</Line>
          <Input value={value ?? ''} onChange={setValue} placeholder="writes the path prop" />
        </div>
      );
    },

    ActionProbe: ({ props }) => {
      // The binding is an object, so memoise it — useAction's execute() is
      // useCallback'd on [execute, binding].
      const binding = useMemo(
        () => ({ action: 'notify', params: { message: props.message, at: { $state: '/count' } } }),
        [props.message],
      );
      const { execute, isLoading } = useAction(binding);
      return (
        <div className="flex flex-col gap-1.5">
          <Line label="binding">{JSON.stringify(binding)}</Line>
          <Line label="isLoading">{String(isLoading)}</Line>
          <div className="flex gap-1.5">
            <Mini onClick={() => void execute()}>{isLoading ? 'running…' : 'dispatch notify'}</Mini>
          </div>
        </div>
      );
    },

    ActionsProbe: () => {
      const { handlers, loadingActions, pendingConfirmation, execute, registerHandler } = useActions();
      return (
        <div className="flex flex-col gap-1.5">
          <Line label="handlers">{Object.keys(handlers).join(', ')}</Line>
          <Line label="loading">{[...loadingActions].join(', ') || '(none)'}</Line>
          <Line label="pending">{pendingConfirmation ? pendingConfirmation.action.action : 'null'}</Line>
          <div className="flex flex-wrap gap-1.5">
            <Mini onClick={() => void execute({ action: 'setState', params: { statePath: '/count', value: 10 } })}>
              execute(setState /count = 10)
            </Mini>
            <Mini onClick={() => registerHandler('lateComer', async () => {})}>registerHandler()</Mini>
          </div>
        </div>
      );
    },

    VisibleProbe: ({ props }) => {
      const condition = parseCondition(props.condition);
      const visible = useIsVisible(condition);
      return (
        <div className="flex flex-col gap-1.5">
          <Line label="condition">{condition === undefined ? 'undefined' : JSON.stringify(condition)}</Line>
          <Line label="returns">
            <Pill tone={visible ? 'ok' : 'idle'}>{String(visible)}</Pill>
          </Line>
        </div>
      );
    },

    VisibilityProbe: () => {
      const { isVisible, ctx } = useVisibility();
      return (
        <div className="flex flex-col gap-1.5">
          <Line label="ctx">{Object.keys(ctx).join(', ')}</Line>
          <Line label="stateModel">{Object.keys(ctx.stateModel).join(', ')}</Line>
          <Line label="ad hoc">
            isVisible({'{ $state: "/form/draft" }'}) → {String(isVisible({ $state: '/form/draft' }))}
          </Line>
        </div>
      );
    },

    FieldProbe: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<string>(props.value as string, bindings?.value);
      const field = useFieldValidation(bindings?.value ?? '/unbound', {
        checks: [{ type: 'email', message: 'Enter a valid email' }],
        validateOn: 'blur',
      });
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <input
              value={value ?? ''}
              placeholder="type something, then blur"
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => {
                field.touch();
                field.validate();
              }}
              className="min-w-0 flex-1 rounded-sm border bg-background px-2 py-0.5 font-mono text-[12px] text-foreground outline-none focus:border-orange-400"
            />
            <Mini onClick={() => field.clear()}>clear()</Mini>
          </div>
          <Line label="state">{JSON.stringify(field.state)}</Line>
          <Line label="errors">
            <span className={field.errors.length ? 'text-red-600 dark:text-red-400' : undefined}>
              {JSON.stringify(field.errors)}
            </span>
          </Line>
          <Line label="isValid">{String(field.isValid)}</Line>
        </div>
      );
    },

    OptionalProbe: () => {
      const validation = useOptionalValidation();
      return (
        <div className="flex flex-col gap-1.5">
          <Line label="inside">
            {validation ? (
              <span className="text-emerald-600 dark:text-emerald-400">{Object.keys(validation).join(', ')}</span>
            ) : (
              'null'
            )}
          </Line>
        </div>
      );
    },

    ScopeProbe: () => {
      const scope = useRepeatScope();
      const { set } = useStateStore();
      if (!scope) {
        return (
          <Line label="scope">
            <span className="text-yellow-600 dark:text-yellow-400">null — not inside a repeat</span>
          </Line>
        );
      }
      const item = scope.item as { title?: string };
      return (
        <div className="flex flex-col gap-1.5">
          <Line label="index">{scope.index}</Line>
          <Line label="basePath">
            <span className="text-emerald-600 dark:text-emerald-400">{scope.basePath}</span>
          </Line>
          <Line label="item">{JSON.stringify(item)}</Line>
          <Input value={item.title ?? ''} onChange={(v) => set(`${scope.basePath}/title`, v)} />
        </div>
      );
    },
  },
});

/**
 * `useValidation()` with no ValidationProvider above it.
 *
 * Mounted only once the learner asks for it, because the throw IS the lesson:
 * catching it here is the only way to put the two doors side by side. The hook
 * order stays stable — `useValidation` reads its context and only then decides
 * to throw, and this component only ever renders outside the provider.
 */
function ValidationThrow({ onResult }: { onResult: (message: string) => void }) {
  let thrown: string | null = null;
  try {
    useValidation();
  } catch (err) {
    thrown = err instanceof Error ? err.message : String(err);
  }
  useEffect(() => {
    if (thrown) onResult(thrown);
  }, [thrown, onResult]);
  return (
    <Line label="useValidation()">
      {thrown ? (
        <span className="text-red-600 dark:text-red-400">threw — {thrown}</span>
      ) : (
        <span className="text-emerald-600 dark:text-emerald-400">returned a context</span>
      )}
    </Line>
  );
}

/** Rendered OUTSIDE every provider, to show the non-throwing hooks' other half. */
function OutsideProbes({ onThrow }: { onThrow?: (message: string) => void }) {
  const validation = useOptionalValidation();
  const scope = useRepeatScope();
  const [armed, setArmed] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-dashed bg-background p-2.5 font-mono text-[12px]">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">outside every provider</div>
      <Line label="validation">{validation ? 'context' : <span className="text-yellow-600 dark:text-yellow-400">null</span>}</Line>
      <Line label="repeatScope">{scope ? 'scope' : <span className="text-yellow-600 dark:text-yellow-400">null</span>}</Line>
      {onThrow &&
        (armed ? (
          <ValidationThrow onResult={onThrow} />
        ) : (
          <div className="flex">
            <Mini onClick={() => setArmed(true)}>call useValidation() out here</Mini>
          </div>
        ))}
    </div>
  );
}

// ----------------------------------------------------------------- specs ---

function box(title: string | null, children: string[]): Spec['elements'][string] {
  return { type: 'Box', props: { title }, children };
}

/** One line of the call: what a name means, going in or coming back. */
interface Part {
  name: string;
  note: React.ReactNode;
}

interface HookEntry {
  id: string;
  name: string;
  sig: string;
  source: string;
  spec: Spec;
  /**
   * There is no `when` here on purpose.
   *
   * The stage rail already carries "when you reach for it" for every hook, at
   * more length and with the "and when not to" half that matters most. A
   * second, shorter copy beside the probe was the same advice twice on one
   * screen, and the screen is the thing that has to stay readable.
   */
  gotcha: React.ReactNode;
  /**
   * The two questions a hook lesson has to answer, and the reason this lab
   * exists: what you hand it, and what you get back.
   *
   * They used to be buried in one long signature line in 11px mono above the
   * source, which is exactly where nobody reads them. Each entry is one name
   * and one sentence about that name — no prose to skim past.
   */
  args?: Part[];
  returns: Part[];
  /** Show the "outside every provider" card beside the live probe. */
  outside?: boolean;
}

const HOOKS: HookEntry[] = [
  {
    id: 'useBoundProp',
    name: 'useBoundProp',
    sig: 'useBoundProp<T>(propValue: T | undefined, bindingPath: string | undefined): [T | undefined, (v: T) => void]',
    source: SRC_BOUND,
    spec: {
      root: 'root',
      elements: {
        root: box('two bound, one not', ['bound', 'plain']),
        bound: { type: 'BoundProbe', props: { value: { $bindState: '/form/draft' } }, children: [] },
        plain: { type: 'BoundProbe', props: { value: 'a plain string' }, children: [] },
      },
    },
    args: [
      { name: 'propValue', note: <>The prop as the renderer already resolved it. Not a path, not an expression — the value.</> },
      { name: 'bindingPath', note: <>That prop&rsquo;s entry in <code>ctx.bindings</code>, or <code>undefined</code> when the spec wrote a literal.</> },
    ],
    returns: [
      { name: 'value', note: <><code>propValue</code>, handed straight back. The hook keeps no state and subscribes to nothing.</> },
      { name: 'setValue(v)', note: <>Calls <code>store.set(bindingPath, v)</code> — and does nothing at all when there is no path.</> },
    ],
    gotcha: (
      <>
        It stores nothing and subscribes to nothing — <code>value</code> is passed straight back out. Give it a
        prop that is not a binding expression and <code>setValue</code> becomes a silent no-op: the second probe
        above types nowhere. That is the &ldquo;my input will not type&rdquo; bug.
      </>
    ),
  },
  {
    id: 'useStateValue',
    name: 'useStateValue',
    sig: 'useStateValue<T>(path: string): T | undefined',
    source: SRC_VALUE,
    spec: {
      root: 'root',
      elements: {
        root: box('two readers, one writer', ['count', 'draft', 'writer']),
        count: { type: 'ValueProbe', props: { path: '/count' }, children: [] },
        draft: { type: 'ValueProbe', props: { path: '/form/draft' }, children: [] },
        writer: { type: 'StoreProbe', props: {}, children: [] },
      },
    },
    args: [{ name: 'path', note: <>An absolute JSON Pointer into the state model.</> }],
    returns: [
      { name: 'value', note: <>Whatever is at that path, or <code>undefined</code>. Read-only — there is no setter in this hook.</> },
    ],
    gotcha: (
      <>
        There is no per-path subscription. <code>StateProvider</code> rebuilds its whole context value on every
        write, so press <code>set → +1</code> below and <em>both</em> render counters move — including the one
        reading <code>/form/draft</code>, which did not change. On a large spec that is a re-render of every
        consumer per keystroke.
      </>
    ),
  },
  {
    id: 'useStateStore',
    name: 'useStateStore',
    sig: 'useStateStore(): { state, get, set, update, getSnapshot }',
    source: SRC_STORE,
    spec: {
      root: 'root',
      elements: {
        root: box('the whole state context', ['store']),
        store: { type: 'StoreProbe', props: {}, children: [] },
      },
    },
    returns: [
      { name: 'state', note: <>The whole model as of this render. A snapshot, not a live object.</> },
      { name: 'get(path)', note: <>One read, right now.</> },
      { name: 'set(path, v)', note: <>One write, one notification.</> },
      { name: 'update({…})', note: <>Many writes, still one notification — one re-render instead of five.</> },
      { name: 'getSnapshot()', note: <>The live model. Read this inside a callback or an effect, where <code>state</code> is already stale.</> },
    ],
    gotcha: (
      <>
        <code>state</code> is the React render snapshot; <code>getSnapshot()</code> is the live one. Inside an async
        callback, read <code>getSnapshot()</code> — <code>state</code> is whatever it was when the closure was
        created. Every one of these throws{' '}
        <code>&quot;useStateStore must be used within a StateProvider&quot;</code> outside the provider.
      </>
    ),
  },
  {
    id: 'useStateBinding',
    name: 'useStateBinding',
    sig: 'useStateBinding<T>(path: string): [T | undefined, (v: T) => void]   // @deprecated',
    source: SRC_BINDING,
    spec: {
      root: 'root',
      elements: {
        root: box('deprecated — path in, pair out', ['b']),
        b: { type: 'BindingProbe', props: { path: '/form/draft' }, children: [] },
      },
    },
    args: [
      { name: 'path', note: <>A JSON Pointer, written into the component. Nothing in the spec can point it elsewhere.</> },
    ],
    returns: [
      { name: 'value', note: <>The value at that path.</> },
      { name: 'setValue(v)', note: <>Writes that path. The same pair as <code>useBoundProp</code>, minus the ability to be redirected.</> },
    ],
    gotcha: (
      <>
        It takes a raw path, so it cannot see the repeat scope: inside a repeat, <code>useBoundProp</code> resolves{' '}
        <code>$bindItem</code> to <code>/todos/2/title</code> for you and this one cannot. That is exactly why it
        was deprecated.
      </>
    ),
  },
  {
    id: 'useAction',
    name: 'useAction',
    sig: 'useAction(binding: ActionBinding): { execute: () => Promise<void>; isLoading: boolean }',
    source: SRC_ACTION,
    spec: {
      root: 'root',
      elements: {
        root: box('dispatch without an `on` binding', ['a']),
        a: { type: 'ActionProbe', props: { message: 'from useAction' }, children: [] },
      },
    },
    args: [
      { name: 'binding', note: <>An <code>ActionBinding</code>: <code>{'{ action, params?, confirm?, onSuccess?, onError? }'}</code>. Memoise it — <code>execute</code> is <code>useCallback</code>&rsquo;d on it.</> },
    ],
    returns: [
      { name: 'execute()', note: <>Dispatches the binding and awaits your handler, exactly as an <code>on</code> event would.</> },
      { name: 'isLoading', note: <>True while any dispatch of that action NAME is in flight, so two buttons firing it light up together. Never true for a built-in.</> },
    ],
    gotcha: (
      <>
        It takes a <strong>binding object</strong>, not an action name — <code>useAction(&apos;notify&apos;)</code>{' '}
        does not compile. Its params are resolved by <code>resolveAction</code>, which understands{' '}
        <code>{'{ $state }'}</code> and nothing else: no <code>$template</code>, no <code>$item</code>, because the
        renderer is not in the path. And <code>isLoading</code> keys off the action <em>name</em>, so two buttons
        firing the same action both look busy.
      </>
    ),
  },
  {
    id: 'useActions',
    name: 'useActions',
    sig: 'useActions(): { handlers, loadingActions, pendingConfirmation, execute, confirm, cancel, registerHandler }',
    source: SRC_ACTIONS,
    spec: {
      root: 'root',
      elements: {
        root: box('the whole action context', ['a']),
        a: { type: 'ActionsProbe', props: {}, children: [] },
      },
    },
    returns: [
      { name: 'handlers', note: <>The map the provider was given, by name.</> },
      { name: 'loadingActions', note: <>A <code>Set</code> of the action names running right now.</> },
      { name: 'pendingConfirmation', note: <>The dialog a <code>confirm</code> block parked, or <code>null</code>.</> },
      { name: 'execute(binding)', note: <>Dispatch a binding your code built on the spot.</> },
      { name: 'confirm() / cancel()', note: <>Settle that pending dialog yourself, when you render your own.</> },
      { name: 'registerHandler(name, fn)', note: <>Add a handler after mount, for a lazily loaded feature.</> },
    ],
    gotcha: (
      <>
        <code>execute</code> handles the built-ins itself, so <code>setState</code> works with no handler
        registered — and never appears in <code>handlers</code>. <code>registerHandler</code> writes into{' '}
        <code>ActionProvider</code> state, so a handler registered during render loops; call it from an effect.
      </>
    ),
  },
  {
    id: 'useIsVisible',
    name: 'useIsVisible',
    sig: 'useIsVisible(condition: VisibilityCondition | undefined): boolean',
    source: SRC_VISIBLE,
    spec: {
      root: 'root',
      elements: {
        root: box('three conditions, one writer', ['gt', 'eq', 'undef', 'writer']),
        // Written as JSON strings: an object here is expression-shaped and the
        // renderer would resolve it to a value before the probe saw it.
        gt: { type: 'VisibleProbe', props: { condition: '{"$state":"/count","gt":2}' }, children: [] },
        eq: { type: 'VisibleProbe', props: { condition: '{"$state":"/form/draft","neq":""}' }, children: [] },
        // No `condition` prop at all, so the hook is handed `undefined` — the
        // case that returns true. A null would throw, in here exactly as it
        // does in the renderer.
        undef: { type: 'VisibleProbe', props: {}, children: [] },
        // A condition nobody can move teaches nothing, so this stage keeps a
        // writer beside the probes, as the useStateValue one does.
        writer: { type: 'StoreProbe', props: {}, children: [] },
      },
    },
    args: [
      { name: 'condition', note: <>The same grammar <code>element.visible</code> takes. <code>undefined</code> means visible.</> },
    ],
    returns: [
      { name: 'boolean', note: <>The answer core&rsquo;s <code>evaluateVisibility</code> gives, against the current state and repeat scope.</> },
    ],
    gotcha: (
      <>
        <code>undefined</code> evaluates to <strong>true</strong> (third probe): &ldquo;no condition&rdquo; means
        visible. It also cannot see <code>$item</code>/<code>$index</code> unless the component is inside a repeat,
        because the context comes from <code>VisibilityProvider</code>, not from the element.
      </>
    ),
  },
  {
    id: 'useVisibility',
    name: 'useVisibility',
    sig: 'useVisibility(): { isVisible: (c?: VisibilityCondition) => boolean; ctx: VisibilityContext }',
    source: SRC_VISIBILITY,
    spec: {
      root: 'root',
      elements: {
        root: box('evaluator + context, and something to evaluate', ['v', 'w']),
        v: { type: 'VisibilityProbe', props: {}, children: [] },
        w: { type: 'BoundProbe', props: { value: { $bindState: '/form/draft' } }, children: [] },
      },
    },
    returns: [
      { name: 'isVisible(c?)', note: <>The same evaluator, callable as often as you like.</> },
      { name: 'ctx', note: <>What it evaluates against: <code>stateModel</code>, plus <code>repeatItem</code> and <code>repeatIndex</code> inside a repeat.</> },
    ],
    gotcha: (
      <>
        <code>ctx</code> is only <code>{'{ stateModel }'}</code> here — the renderer adds{' '}
        <code>repeatItem</code>/<code>repeatIndex</code>/<code>functions</code>/<code>directives</code> per element
        before it evaluates, and that enriched object never reaches this hook. Throws without a{' '}
        <code>VisibilityProvider</code>.
      </>
    ),
  },
  {
    id: 'useFieldValidation',
    name: 'useFieldValidation',
    sig: 'useFieldValidation(path: string, config?: ValidationConfig): { state, validate, touch, clear, errors, isValid }',
    source: SRC_FIELD,
    spec: {
      root: 'root',
      elements: {
        root: box('one field, registered', ['f']),
        f: { type: 'FieldProbe', props: { value: { $bindState: '/form/email' } }, children: [] },
      },
    },
    args: [
      { name: 'path', note: <>The state path this control owns. It is also the key it is registered under.</> },
      { name: 'config', note: <>The checks to run — the same <code>checks</code> a spec puts in props.</> },
    ],
    returns: [
      { name: 'state', note: <>The field record: <code>errors</code>, <code>touched</code>, <code>validated</code>.</> },
      { name: 'validate()', note: <>Runs the checks now and returns the result. Nothing runs them for you.</> },
      { name: 'touch() / clear()', note: <>Mark it visited; drop its errors.</> },
      { name: 'isValid', note: <>True before the first <code>validate()</code> as well as after a clean one — read <code>state.validated</code> to tell those apart.</> },
    ],
    gotcha: (
      <>
        Registration is a side effect of rendering: a field that is hidden, or in a collapsed tab, is not registered,
        so <code>validateForm</code> reports the form valid. <code>validateOn</code> is data — the provider does not
        act on it; your component decides when to call <code>validate()</code>. See{' '}
        <code>validateAll</code> in <StepRef slug="validation" />.
      </>
    ),
  },
  {
    id: 'useOptionalValidation',
    name: 'useOptionalValidation / useValidation',
    sig: 'useOptionalValidation(): ValidationContextValue | null        useValidation(): ValidationContextValue',
    source: SRC_OPTIONAL,
    spec: {
      root: 'root',
      elements: {
        root: box('inside the provider', ['o']),
        o: { type: 'OptionalProbe', props: {}, children: [] },
      },
    },
    outside: true,
    returns: [
      { name: 'context | null', note: <><code>null</code> when no <code>ValidationProvider</code> is mounted, where <code>useValidation()</code> would throw.</> },
    ],
    gotcha: (
      <>
        <code>useValidation()</code> (and therefore <code>useFieldValidation</code>) throws{' '}
        <code>&quot;useValidation must be used within a ValidationProvider&quot;</code>. In the demo registry every
        component is wrapped in its own error boundary, so that throw does not blank the page — the input just
        vanishes. Silent, and the reason the providers lab exists.
      </>
    ),
  },
  {
    id: 'useRepeatScope',
    name: 'useRepeatScope',
    sig: 'useRepeatScope(): { item: unknown; index: number; basePath: string } | null',
    source: SRC_SCOPE,
    spec: {
      root: 'root',
      elements: {
        root: box('inside a repeat, and outside one', ['list', 'lonely']),
        list: { type: 'Box', props: { title: 'repeat over /todos' }, repeat: { statePath: '/todos' }, children: ['row'] },
        row: { type: 'ScopeProbe', props: {}, children: [] },
        lonely: { type: 'ScopeProbe', props: {}, children: [] },
      },
    },
    outside: true,
    returns: [
      { name: 'item', note: <>The current row object.</> },
      { name: 'index', note: <>Its position in the array.</> },
      { name: 'basePath', note: <>The absolute path to that row — <code>/todos/0</code> — to build write paths from.</> },
      { name: 'null', note: <>What you get outside a repeat. Check for it; there is no other signal.</> },
    ],
    gotcha: (
      <>
        Returns <code>null</code> outside a repeat instead of throwing, so a component that assumes a scope crashes
        on <code>scope.item</code> rather than telling you why. <code>item</code> is typed <code>unknown</code>:
        narrow it yourself.
      </>
    ),
  },
];

// ------------------------------------------------------------------- lab ---

/** The hook ids a stage shows; every one when a stage does not scope itself. */
function focusIds(focus: string | undefined): string[] {
  return focus ? focus.split(' ') : HOOKS.map((h) => h.id);
}

/** The hook names, scoped to the stage — the lab's one control for choosing a probe. */
/** One row per name: the token on the left, one sentence on the right. */
function PartList({ label, parts }: { label: string; parts: Part[] }) {
  return (
    <div>
      <div className="border-b bg-muted px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <dl className="divide-y">
        {parts.map((part) => (
          <div key={part.name} className="grid grid-cols-[minmax(96px,auto)_1fr] gap-3 px-3 py-2">
            <dt className="font-mono text-[12px] text-foreground">{part.name}</dt>
            <dd className="text-[13px] leading-relaxed text-muted-foreground">{part.note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ChipRow({ active, onPick }: { active: string; onPick: (id: string) => void }) {
  const focus = useContext(HookFocus);
  const ids = focusIds(focus);
  const shown = HOOKS.filter((h) => ids.includes(h.id));

  // Nine of the ten stages teach ONE hook, where a row holding a single chip
  // that does nothing is just chrome above the lesson. The rail names the
  // stage and the panel below is titled with the hook.
  if (shown.length < 2) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">two doors</span>
      {shown.map((h) => (
        <Chip key={h.id} active={h.id === active} onClick={() => onPick(h.id)}>
          {h.name}
        </Chip>
      ))}
    </div>
  );
}

const SEED = {
  count: 0,
  form: { draft: '', email: '' },
  todos: [{ title: 'read the catalog' }, { title: 'write a component' }],
};

/**
 * What the learner has actually made the store do.
 *
 * Every probe writes through the shared store and never through this
 * component, so the honest check for a task is what the store now holds —
 * plus which probe was on screen when the write landed, which is the only way
 * to tell "typed into the bound input" from "typed into the unbound one that
 * writes nowhere". The marks are kept, because a stage deliberately resets a
 * value an earlier stage asked for: `update()` wipes both paths, and the tick
 * belongs to the write that happened, not to the leftovers.
 */
function marksFor(snap: Record<string, unknown>, from: string): string[] {
  const count = (snap.count as number) ?? 0;
  const form = (snap.form as Record<string, unknown>) ?? {};
  const draft = (form.draft as string) ?? '';
  const email = (form.email as string) ?? '';
  const todos = (snap.todos as Array<{ title?: string }>) ?? [];

  const out = [`wrote:${from}`];
  if (count >= 3) out.push('count-3');
  if (count === 10) out.push('count-10');
  // Both useIsVisible probes read false only here, and only when that stage is
  // the one on screen — the same values elsewhere are just an empty form.
  if (from === 'useIsVisible' && count <= 2 && draft === '') out.push('cond-false');
  if (email.length > 0 && !email.includes('@')) out.push('bad-email');
  if (todos.some((t, i) => (t.title ?? '') !== SEED.todos[i]?.title)) out.push('todo-renamed');
  return out;
}

/** The lesson half of each stage; `items` supplies the assignment half. */
const HOOKS_STAGES = [
  {
    id: 'bound',
    title: 'useBoundProp binds an input',
    when:
      'The default for any component that both shows a value and writes it back, because it is the only hook that reads the renderer’s `bindings` map — which is what lets one component serve `$bindState` and `$bindItem` alike. Reach for `useStateStore().set` instead only when your code computes the path rather than being handed it. With no `bindingPath` the setter is a silent no-op, which is the usual reason an input will not type.',
    concept: 'use-bound-prop-hook',
    ref: 'hook-useboundprop',
    also: ['hooks-vs-props'],
    focus: 'useBoundProp',
  },
  {
    id: 'value',
    title: 'useStateValue reads one path',
    when:
      'Only for a value nobody passed you — a sibling field, a global flag, something a row needs from outside the row. If the value arrived in `props` it is already resolved, and reading it again by pointer adds a second source of truth for the same thing. There is no per-path subscription either, so a component reading `/a` re-renders when `/b` changes.',
    concept: 'use-state-value',
    ref: 'hook-usestatevalue',
    focus: 'useStateValue',
  },
  {
    id: 'store',
    title: 'useStateStore writes many',
    when:
      'Take the whole context for two reasons: writing several paths at once, where `update({ … })` is one notify and one re-render instead of several, and reading inside a callback or effect, where `getSnapshot()` is live and the `state` snapshot is stale. For a single read during render `useStateValue` is narrower, and for a bound input `useBoundProp` already has the setter.',
    concept: 'use-state-store',
    ref: 'hook-usestatestore',
    focus: 'useStateStore',
  },
  {
    id: 'binding',
    title: 'useStateBinding, the deprecated pair',
    when:
      'Effectively never in a registry component: a hard-coded path means the spec can no longer say where the control writes, which is the whole point of `bindings`. The case left is a bespoke component that owns a state path nobody will redirect — and even there `useStateValue(path)` with `useStateStore().set` says the same thing without the deprecation.',
    ref: 'hook-usestatebinding',
    focus: 'useStateBinding',
    summary:
      'The hook `useBoundProp` replaced, still exported and still working in 0.20.0. It takes a path STRING, so the component hard-codes where it writes and never reads the `bindings` map — which is why neither `$bindState` nor `$bindItem` can redirect it.',
  },
  {
    id: 'scope',
    title: 'useRepeatScope names the row',
    when:
      'When a component needs the row’s IDENTITY rather than one of its fields — a row menu that removes itself, a drag handle, a nested control building its own paths off `basePath`. If a field of the row is all you want, `$item` or `$bindItem` in the spec is cheaper and keeps the component generic. Nested repeats leave only the innermost scope readable.',
    concept: 'use-repeat-scope',
    ref: 'hook-userepeatscope',
    focus: 'useRepeatScope',
  },
  {
    id: 'action',
    title: 'useAction dispatches one binding',
    when:
      'A component that dispatches something the spec did not bind to an event, and wants the loading flag with it. If the spec CAN name the event, `on` plus `emit` keeps the behaviour where it can be read, diffed and regenerated. Two caveats decide the rest: `isLoading` keys off the action NAME, so every button firing it lights up together, and it is never true for a built-in.',
    concept: 'use-action',
    ref: 'hook-useaction',
    focus: 'useAction',
  },
  {
    id: 'actions',
    title: 'useActions, the whole context',
    when:
      'Only for what the single-binding hook cannot reach: registering a handler at runtime for a lazily-loaded feature, driving `pendingConfirmation` yourself because you render your own dialog, or dispatching a binding your code builds on the spot rather than a fixed one. For a constant binding with a loading flag, `useAction` is the smaller surface.',
    ref: 'hook-useactions',
    focus: 'useActions',
    summary:
      'The built-in actions — `setState`, `validateForm`, `push`, `navigate` — are implemented by the library, so `useActions().execute()` runs them without you registering anything. Your handlers are only for the names the library does not already own.',
  },
  {
    id: 'visible',
    title: 'useIsVisible evaluates a condition',
    when:
      'When your component must branch on a rule the SPEC wrote, so it uses the same grammar as `visible` instead of inventing a second one. If the branch is simply whether the element appears, put it on `element.visible` — a condition in the spec is readable by `validateSpec`, by a person and by a model, and one buried in a component is not. Take `useVisibility()` over `useIsVisible` only when you evaluate several conditions or need `ctx` itself.',
    concept: 'use-is-visible',
    ref: 'hook-useisvisible',
    focus: 'useIsVisible useVisibility',
    tasks: 2,
    summary:
      'One evaluator, two doors into it: `useIsVisible(condition)` answers for a single condition, `useVisibility()` hands back that same `isVisible` plus the `ctx` it evaluates against. Both end up in core `evaluateVisibility`, the function an element’s own `visible` field goes through.',
  },
  {
    id: 'field',
    title: 'useFieldValidation registers a field',
    when:
      'In any input component that should take part in form validation, because calling it is what registers the field — there is no scan of the spec, so a control that skips it is invisible to `validateForm` however wrong its value is. It is not the page-level check: it validates one field, only when you call `validate()`, and `isValid` is true before the first run, so read `state.validated` before showing a tick.',
    ref: 'hook-usefieldvalidation',
    focus: 'useFieldValidation',
    summary:
      '`useFieldValidation` registers a control with the nearest ValidationProvider, which is what puts it in the `errors` map `validateForm` writes. A control that never calls it is invisible to form validation, however broken its value is.',
  },
  {
    id: 'optional',
    title: 'useOptionalValidation returns null',
    when:
      'A component that has to render both inside a form and outside one — a shared input dropped onto a read-only page. When the component only ever lives in a form, `useValidation()` is the better choice: the throw tells you at once that the provider is missing, where the optional variant hands back `null` and the field quietly stops validating.',
    ref: 'hook-useoptionalvalidation',
    focus: 'useOptionalValidation',
    summary:
      '`useValidation()` throws when no ValidationProvider is mounted; `useOptionalValidation()` returns null instead. A component that has to work inside a form and outside one takes the optional door — `ActionProvider` does exactly that, which is why `validateForm` can warn rather than crash.',
  },
];

export function HooksLab() {
  /**
   * The opening probe is the opening STAGE's hook.
   *
   * `onStageChange` below only fires on the client, so without this a deep link
   * to `?stage=3` server-renders the `useBoundProp` probe under a chip row that
   * already says `useStateValue`, and only snaps to the right hook after
   * hydration — the one paint the stage-addressable URL exists to make honest.
   */
  const opening = useInitialStage(HOOKS_STAGES.length);
  const [active, setActive] = useState(() => focusIds(HOOKS_STAGES[opening].focus)[0]);
  const [log, setLog] = useState<Array<{ id: number; text: string }>>([]);
  const [marks, setMarks] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [thrown, setThrown] = useState<string | null>(null);
  const seq = useRef(0);

  const store = useMemo(() => createStateStore(structuredClone(SEED)), []);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  /** Which probe is on screen when a write lands. Read by the subscription below. */
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(
    () =>
      store.subscribe(() => {
        const found = marksFor(store.getSnapshot(), activeRef.current);
        setMarks((prev) => {
          if (found.every((m) => prev.has(m))) return prev;
          const next = new Set(prev);
          for (const m of found) next.add(m);
          return next;
        });
      }),
    [store],
  );

  const handlers = useMemo(
    () => ({
      notify: async (params: Record<string, unknown>) => {
        seq.current += 1;
        setLog((prev) => [{ id: seq.current, text: `notify(${JSON.stringify(params)})` }, ...prev].slice(0, 20));
      },
    }),
    [],
  );

  const entry = HOOKS.find((h) => h.id === active) ?? HOOKS[0];

  /**
   * The spec the probe renders from, editable.
   *
   * Derived rather than stored: moving to another hook has to bring that
   * hook's spec in the SAME render, or one frame of the previous one is
   * enough to make the panel disagree with the chip above it.
   */
  const [edited, setEdited] = useState<{ id: string; text: string } | null>(null);
  const specText = edited?.id === entry.id ? edited.text : JSON.stringify(entry.spec, null, 2);
  const liveSpec = useMemo(() => {
    try {
      return JSON.parse(specText) as Spec;
    } catch {
      return null;
    }
  }, [specText]);

  /** Same thing clicking a chip does — the checklist's apply buttons reuse it. */
  const open = (id: string) => setActive(id);
  const count = (snapshot.count as number) ?? 0;
  const draft = ((snapshot.form as Record<string, unknown>)?.draft as string) ?? '';

  /* This lab builds its own catalog and registry for the probes, so the notes
     drawer would otherwise show the shared demo setup instead. */
  usePublishSetup({
    spec: null,
    sources: [
      {
        label: "this lab's own catalog + registry · components/lab/hooks-lab.tsx",
        code: LAB_SETUPS['components/lab/hooks-lab.tsx'] ?? '',
        lang: 'tsx',
      },
    ],
  });

  const items: ChecklistItem[] = [
    {
      label: (
        <>
          Type into the <em>bound</em> <code>useBoundProp</code> probe and watch <code>/form/draft</code> move.
          The unbound one below it will not type.
        </>
      ),
      done: marks.has('wrote:useBoundProp'),
      hint:
        'The setter writes through bindings[prop]. With no binding path it is a no-op — it neither throws nor warns.',
      steps: [
        <>
          The middle panel, <strong>live — one shared store, the real Renderer</strong>, holds two{' '}
          <code>useBoundProp</code> probes.
        </>,
        <>
          The first one&rsquo;s <code>bindings</code> line is green and reads <code>/form/draft</code>; the second
          reads <em>(unbound — setValue is a no-op)</em>.
        </>,
        <>
          Type into the <em>first</em> input.
        </>,
        <>
          Watch <strong>state</strong> below: <code>form.draft</code> follows every keystroke.
        </>,
        <>
          Now type into the second input. Nothing happens anywhere — that is the &ldquo;my input will not
          type&rdquo; bug, and the only difference is the binding path.
        </>,
      ],
      apply: { label: 'open useBoundProp', run: () => open('useBoundProp') },
    },
    {
      label: (
        <>
          Press <strong>set → +1</strong> under the two <code>useStateValue</code> readers and make{' '}
          <em>both</em> render counters move — including the one reading <code>/form/draft</code>, which did
          not change.
        </>
      ),
      done: marks.has('wrote:useStateValue'),
      hint:
        'There is no per-path subscription: the hook reads the whole store, and StateProvider rebuilds its context value on every write.',
      steps: [
        <>
          Three probes render: readers on <code>/count</code> and <code>/form/draft</code>, and one writer
          underneath them.
        </>,
        <>
          Note the <strong>renders</strong> number on each reader.
        </>,
        <>
          Press <strong>set → +1</strong> on the writer.
        </>,
        <>
          Both counters go up, though only <code>/count</code> changed. On a large spec that is every consumer
          re-rendering per keystroke.
        </>,
        <>
          The <code>value</code> line of the second reader is unchanged — it re-rendered to print the same
          string.
        </>,
      ],
      apply: { label: 'open useStateValue', run: () => open('useStateValue') },
    },
    {
      label: (
        <>
          Drive <code>/count</code> to <strong>3</strong> with <code>set</code>, then wipe both paths with a
          single <code>update()</code>.
        </>
      ),
      done: marks.has('count-3') && marks.has('wrote:useStateStore'),
      hint:
        'set(path, value) notifies once per call; update(record) writes every path and notifies once. get() and getSnapshot() are live, state is the render snapshot.',
      steps: [
        <>
          Press <strong>set → +1</strong> three times and watch <code>get(&apos;/count&apos;)</code> read 1, 2,
          3.
        </>,
        <>
          Press <strong>getSnapshot()</strong>: the line reports the live snapshot, which is what an async
          callback must read instead of <code>state</code>.
        </>,
        <>
          Press <strong>update() batch</strong>. <code>/count</code> and <code>/form/draft</code> both reset in
          one notify — one re-render, not two.
        </>,
        <>
          <strong>state</strong> shows <code>count: 0</code> and an empty draft again. Earlier ticks stay: the
          writes happened.
        </>,
      ],
      apply: { label: 'open useStateStore', run: () => open('useStateStore') },
    },
    {
      label: (
        <>
          Type into the deprecated <code>useStateBinding</code> probe. It writes the path string it was handed
          — it never looks at <code>bindings</code>.
        </>
      ),
      done: marks.has('wrote:useStateBinding'),
      hint:
        'A raw path in, a [value, setValue] pair out. The @deprecated tag is JSDoc only — nothing warns at runtime.',
      steps: [
        <>
          Read the <code>path</code> line: a plain <code>/form/draft</code>, not a <code>$bindState</code>{' '}
          expression.
        </>,
        <>
          Type into the input.
        </>,
        <>
          <strong>state</strong> moves exactly as it did on the <code>useBoundProp</code> stage — for one fixed
          path the two hooks do the same job.
        </>,
        <>
          The difference lands on the next stage: a raw path cannot become <code>/todos/1/title</code>, because
          only the <code>bindings</code> map knows which row you are in.
        </>,
      ],
      apply: { label: 'open useStateBinding', run: () => open('useStateBinding') },
    },
    {
      label: (
        <>
          Rename a row from inside the repeat. The input writes <code>basePath + &apos;/title&apos;</code> —
          which is what <code>$bindItem</code> does for you.
        </>
      ),
      done: marks.has('todo-renamed'),
      hint:
        'useRepeatScope returns { item, index, basePath } from the nearest RepeatScopeProvider, and null — never a throw — outside one.',
      steps: [
        <>
          The repeat over <code>/todos</code> renders one probe per row.
        </>,
        <>
          Read <code>index</code> and <code>basePath</code>: the first row is <code>/todos/0</code>, an
          absolute state path.
        </>,
        <>
          Edit a row&rsquo;s input.
        </>,
        <>
          <strong>state</strong> shows that row&rsquo;s <code>title</code> change, and only that row.
        </>,
        <>
          The lonely probe under the list, and the dashed <em>outside every provider</em> card, both read{' '}
          <code>null</code> — a component that assumed a scope would crash on <code>scope.item</code> instead.
        </>,
      ],
      apply: { label: 'open useRepeatScope', run: () => open('useRepeatScope') },
    },
    {
      label: (
        <>
          Dispatch <code>notify</code> from inside a component with <code>useAction</code> — no{' '}
          <code>on</code> binding anywhere in the spec.
        </>
      ),
      done: log.length > 0,
      hint:
        'useAction takes an ActionBinding object, and its params are resolved by resolveAction, which understands { $state } and nothing else.',
      steps: [
        <>
          Read the <code>binding</code> line in the probe: an <em>object</em>,{' '}
          <code>{'{ action: "notify", params: { … } }'}</code>, not a name. Passing a string does not
          compile.
        </>,
        <>
          Press <strong>dispatch notify</strong>.
        </>,
        <>
          A row appears in <strong>action log</strong> under the state panel. Its{' '}
          <code>at</code> param is the resolved <code>/count</code>, because{' '}
          <code>resolveAction</code> understands <code>{'{ $state }'}</code>.
        </>,
        <>
          Nothing in the spec has an <code>on</code> binding — the dispatch came from inside the
          component.
        </>,
      ],
      apply: { label: 'open useAction', run: () => open('useAction') },
    },
    {
      label: (
        <>
          Use <code>useActions().execute()</code> to fire the built-in <code>setState</code> — no handler
          required — and park <code>/count</code> at <strong>10</strong>.
        </>
      ),
      done: marks.has('count-10') && marks.has('wrote:useActions'),
      hint:
        'execute() runs the built-in actions itself, so they never appear in handlers; registerHandler writes provider state, so call it from an effect, never during render.',
      steps: [
        <>
          Read the <code>handlers</code> line: it lists <code>notify</code> only. The built-ins are not
          there.
        </>,
        <>
          Press <strong>execute(setState /count = 10)</strong>.
        </>,
        <>
          <strong>state</strong> shows <code>count: 10</code> even though no handler named{' '}
          <code>setState</code> exists — <code>execute</code> handles the built-ins itself.
        </>,
        <>
          Press <strong>registerHandler()</strong> and watch <code>lateComer</code> join the{' '}
          <code>handlers</code> line.
        </>,
      ],
      apply: { label: 'open useActions', run: () => open('useActions') },
    },
    {
      label: (
        <>
          Reset the store so both conditions read <strong>false</strong>, then bring the first one back to{' '}
          <strong>true</strong> — on the same evaluator the renderer runs for <code>visible</code>.
        </>
      ),
      done: marks.has('cond-false') && count > 2,
      hint:
        'useIsVisible calls core evaluateVisibility, the function element.visible goes through. An undefined condition returns true.',
      steps: [
        <>
          Three probes and one writer render: <code>{'{ $state: "/count", gt: 2 }'}</code>,{' '}
          <code>{'{ $state: "/form/draft", neq: "" }'}</code>, and one element handed no condition at all.
        </>,
        <>
          Press <strong>update() batch</strong> on the writer: the first two pills drop to{' '}
          <code>false</code>.
        </>,
        <>
          The third stays <code>true</code> — &ldquo;no condition&rdquo; means visible, exactly as it does for
          an element with no <code>visible</code> field.
        </>,
        <>
          Press <strong>set → +1</strong> three times: the first pill flips back the moment{' '}
          <code>/count</code> passes 2.
        </>,
      ],
      apply: { label: 'open useIsVisible', run: () => open('useIsVisible') },
    },
    {
      label: (
        <>
          Switch to <code>useVisibility</code>, read the <code>ctx</code> the evaluator is actually given, then
          type until an ad-hoc condition — one your code wrote, not the spec — reads <code>true</code>.
        </>
      ),
      done: marks.has('wrote:useVisibility') && draft.length > 0,
      hint:
        'useVisibility returns { isVisible, ctx }. ctx holds stateModel only: repeatItem, repeatIndex, functions and directives are added per element by the renderer and never reach the hook.',
      steps: [
        <>
          Click the <strong>useVisibility</strong> chip beside <strong>useIsVisible</strong>.
        </>,
        <>
          Read the <code>ctx</code> line: one key, <code>stateModel</code>. That is everything this hook gets.
        </>,
        <>
          The <strong>ad hoc</strong> line evaluates <code>{'{ $state: "/form/draft" }'}</code> in the
          component — <code>false</code> while the draft is empty.
        </>,
        <>
          Type into the input under the probe; the line flips to <code>true</code> as soon as the string stops
          being empty.
        </>,
      ],
      apply: { label: 'open useVisibility', run: () => open('useVisibility') },
    },
    {
      label: (
        <>
          Put something that is not an email into the <code>useFieldValidation</code> probe and blur it.
        </>
      ),
      done: marks.has('bad-email'),
      hint: 'validate() returns the result AND stores it; errors[] is read off the stored result.',
      steps: [
        <>
          Type <code>nope</code> into the probe&rsquo;s input, then click outside it to blur.
        </>,
        <>
          Read the three lines under the input: <code>state</code> is now{' '}
          <code>touched: true</code>, <code>errors</code> turns red with{' '}
          <em>Enter a valid email</em>, and <code>isValid</code> is <code>false</code>.
        </>,
        <>
          Press <strong>clear()</strong>: the error goes, the typed value stays. Validation state and the
          state model are two different stores.
        </>,
        <>
          Check the <strong>state</strong> panel — <code>form.email</code> holds your text and knows
          nothing about the verdict.
        </>,
      ],
      apply: { label: 'open useFieldValidation', run: () => open('useFieldValidation') },
    },
    {
      label: (
        <>
          Make <code>useValidation()</code> throw where <code>useOptionalValidation()</code> simply returns{' '}
          <code>null</code>.
        </>
      ),
      done: thrown !== null,
      hint:
        'useOptionalValidation returns null when no ValidationProvider is mounted; useValidation throws instead. ActionProvider takes the optional door, which is why validateForm warns rather than crashes.',
      steps: [
        <>
          The probe inside the providers prints the keys of the context it got.
        </>,
        <>
          The dashed <em>outside every provider</em> card below it reads <code>null</code> for the same hook —
          no throw, no warning.
        </>,
        <>
          Press <strong>call useValidation() out here</strong> on that card.
        </>,
        <>
          Its throwing twin mounts and the message appears in red:{' '}
          <code>useValidation must be used within a ValidationProvider</code>.
        </>,
        <>
          The renderer wraps every element in an error boundary, so inside a spec that throw does not blank the
          page — the control just vanishes. See <StepRef slug="providers" />.
        </>,
      ],
      apply: { label: 'open useOptionalValidation', run: () => open('useOptionalValidation') },
    },
  ];

  const stages = stagesFromChecklist(items, HOOKS_STAGES);

  /**
   * Call → live → spec → source, in that order.
   *
   * The lab used to open with three columns of prose: a "what this hook is
   * for" card that restated the rail's own `when`, a gotcha, and a footnote.
   * A hook is defined by two things — what you hand it and what it hands
   * back — and neither was anywhere except a 11px signature line above the
   * source. Those two lists now come first, the running probe sits beside
   * them, and the prose is one card.
   */
  const stagedBody = (
    <div className="flex flex-col gap-3">

      <ChipRow active={active} onPick={open} />

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title={`the call · ${entry.name}`}>
          <pre className="overflow-x-auto border-b bg-background px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground">
            {entry.sig}
          </pre>
          {entry.args && <PartList label="you hand it" parts={entry.args} />}
          <PartList label="you get back" parts={entry.returns} />
        </Panel>

        <div className="flex min-w-0 flex-col gap-3">
          <Panel title="live · the probe, in the real Renderer" bodyClassName="overflow-auto">
            <div className="flex flex-col gap-2 p-3">
              {liveSpec ? (
                <JSONUIProvider registry={hooksRegistry} store={store} handlers={handlers}>
                  <Renderer spec={liveSpec} registry={hooksRegistry} />
                </JSONUIProvider>
              ) : (
                <span className="text-[12px] text-red-600 dark:text-red-400">invalid JSON — the render is paused</span>
              )}
              {entry.outside && (
                <OutsideProbes onThrow={entry.id === 'useOptionalValidation' ? setThrown : undefined} />
              )}
            </div>
          </Panel>

          <Panel title="state · one store, shared by every probe" bodyClassName="overflow-auto">
            <CodeBlock code={JSON.stringify(snapshot, null, 2)} lang="json" maxHeight={130} showLineNumbers={false} />
          </Panel>

          <Panel title={`action log · ${log.length}`} bodyClassName="overflow-auto">
            <div className="max-h-[110px] overflow-auto p-2 font-mono text-[11.5px]">
              {log.length === 0 ? (
                <span className="text-muted-foreground">Nothing dispatched yet.</span>
              ) : (
                log.map((l) => (
                  <div key={l.id} className="flex gap-2 rounded px-1 py-0.5 hover:bg-muted">
                    <span className="text-orange-600 dark:text-orange-400">action</span>
                    <span className="min-w-0 break-all text-muted-foreground">{l.text}</span>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title="the spec this probe renders from · edit this">
          <div className="h-[260px]">
            <JsonEditor value={specText} onChange={(t) => setEdited({ id: entry.id, text: t })} />
          </div>
        </Panel>

        <Panel title={`source · the component calling ${entry.name}`} bodyClassName="overflow-hidden">
          <CodeBlock code={entry.source} lang="tsx" maxHeight={260} showLineNumbers={false} />
        </Panel>
      </div>

      <Panel title="gotcha">
        <div className="flex gap-2.5 px-3.5 py-2.5">
          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-red-500" aria-hidden />
          <div className="prose-doc text-[14px] leading-relaxed">{entry.gotcha}</div>
        </div>
      </Panel>

      <div className="rounded-lg border bg-surface px-3.5 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
        Three more hooks ship in this package — <code>useUIStream</code>, <code>useChatUI</code> and{' '}
        <code>useJsonRenderMessage</code>. None belongs in a registry component: they own a fetch, not a prop. See{' '}
        <StepRef slug="generate" short /> and <StepRef slug="chat" short />.
      </div>
    </div>
  );

  return (
    <StageFrame
      slug="hooks"
      stages={stages}
      // The stage names its hook; opening that probe here is what makes `focus`
      // more than a label — the learner arrives at the one thing being taught.
      onStageChange={(stage) => setActive(focusIds(stage.focus)[0])}
    >
      {(stage) => <HookFocus.Provider value={stage.focus}>{stagedBody}</HookFocus.Provider>}
    </StageFrame>
  );
}
