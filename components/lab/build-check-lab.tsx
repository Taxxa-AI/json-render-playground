'use client';

import type { ActionDispatchInfo, ActionSettleInfo, Spec } from '@json-render/core';
import { createStateStore, defineCatalog, registerActionObserver } from '@json-render/core';
import { defineRegistry, JSONUIProvider, Renderer, type SetState } from '@json-render/react';
import { schema } from '@json-render/react/schema';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { CodeEditor } from '@/lib/build/code-editor';
import { compileAsyncBody, compileBody, errorText } from '@/lib/build/compile-fn';
import { demoActions, demoComponents } from '@/lib/demo/catalog';
import { demoComponentImpls } from '@/lib/demo/components';
import { guardAll } from '@/lib/demo/guard';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { at } from '@/lib/demo/spec-query';
import { ActionButton, ChromeButton, Panel, Pill } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist, type Stage } from '@/lib/labs/types';

/**
 * The two named extension points that are not components.
 *
 * A spec can say `checks: [{ type: "iban" }]` and `{ action: "archiveInvoice" }`
 * without either existing. Both are looked up by string at runtime, and the
 * two failure modes are opposites:
 *
 *   an unknown validation function  → the field passes, silently, forever
 *   an unknown action handler       → nothing happens, silently
 *
 * This lab makes you register each one, then take it away again.
 */

/* ------------------------------------------------------------- half one --- */

const DEFAULT_IBAN = `// value: whatever the bound state path holds right now.
// args:  the check's \`args\` object from the spec (null here).
// Return a BOOLEAN. Anything else is coerced, and a throw counts as invalid.
const s = String(value ?? '').replace(/\\s+/g, '').toUpperCase();
return /^IE\\d{2}[A-Z]{4}\\d{14}$/.test(s);`;

const FORM_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: 'Payout details', subtitle: null }, children: ['card'] },
    card: {
      type: 'Card',
      props: { title: null, subtitle: null },
      children: ['iban', 'actions'],
      slots: {},
    },
    iban: {
      type: 'TextInput',
      props: {
        label: 'IBAN',
        value: { $bindState: '/form/iban' },
        placeholder: 'IE29AIBK93115212345678',
        help: 'Blur the field to run the check.',
        required: true,
        checks: [{ type: 'iban', args: null, message: 'That is not an IBAN we accept.' }],
      },
      children: [],
    },
    actions: {
      type: 'Button',
      props: { label: 'Validate form', variant: 'primary' },
      on: {
        press: [
          { action: 'validateForm', params: { statePath: '/result' } },
          { action: 'submit' },
        ],
      },
      children: [],
    },
  },
};

const FORM_SEED = { form: { iban: 'NOT-AN-IBAN' }, result: null };

/* ------------------------------------------------------------- half two --- */

const DEFAULT_HANDLER = `// params arrives RESOLVED: { id: { $state: '/selected' } } -> { id: 'INV-2041' }
await sleep(450);

if (failNext) {
  // Reject, and the binding's onError branch runs instead of onSuccess.
  throw new Error('Gateway refused: ' + params.id + ' is locked for audit');
}

return { id: params.id, archivedAt: new Date().toISOString() };`;

const ARCHIVE_SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: 'Invoice INV-2041', subtitle: null }, children: ['card'] },
    card: {
      type: 'Card',
      props: { title: null, subtitle: null },
      children: ['selected', 'archive', 'status'],
    },
    selected: {
      type: 'Text',
      props: { value: { $template: 'selected: ${/selected}' }, tone: null, size: 'sm' },
      children: [],
    },
    archive: {
      type: 'Button',
      props: { label: 'Archive invoice', variant: 'danger' },
      on: {
        press: {
          action: 'archiveInvoice',
          params: { id: { $state: '/selected' } },
          confirm: {
            title: 'Archive this invoice?',
            message: 'It leaves the open ledger. The spec asked for this dialog, not the handler.',
            confirmLabel: 'Archive',
            cancelLabel: 'Keep it',
            variant: 'danger',
          },
          onSuccess: { set: { '/status': 'archived' } },
          onError: { action: 'notify', params: { message: 'Archive failed — read the log.' } },
        },
      },
      children: [],
    },
    status: {
      type: 'Alert',
      props: { title: 'status', message: { $state: '/status' }, tone: 'info' },
      visible: { $state: '/status' },
      children: [],
    },
  },
};

const ARCHIVE_SEED = { selected: 'INV-2041', status: '' };

/** The catalog half two needs — demo components plus one extra action. */
const archiveCatalog = defineCatalog(schema, {
  components: demoComponents,
  actions: {
    ...demoActions,
    archiveInvoice: {
      description: 'Archive an invoice by id. Returns the archived record.',
      params: z.object({ id: z.string() }),
    },
  },
});

/* ----------------------------------------------------------- half three --- */

/**
 * Three typos, one validator.
 *
 * `catalog.validate` is the only check in the library that knows which
 * component names you declared. It is also the check that never opens an `on`
 * binding and never reads a check's `type` — which is precisely why both
 * failures this lab is about go unreported.
 */
const PROBES = [
  { id: 'none', label: 'as written' },
  { id: 'check', label: 'checks[0].type → "ibna"' },
  { id: 'action', label: 'on.press[1].action → "sumbit"' },
  { id: 'component', label: 'actions.type → "Buton"' },
] as const;

type ProbeId = (typeof PROBES)[number]['id'];

/** FORM_SPEC with one deliberate typo, so the validator can be asked about it. */
function probeSpec(id: ProbeId): Spec {
  const spec = structuredClone(FORM_SPEC);
  const el = spec.elements;
  if (id === 'check') (el.iban.props.checks as Array<{ type: string }>)[0].type = 'ibna';
  if (id === 'action') (el.actions.on?.press as Array<{ action: string }>)[1].action = 'sumbit';
  if (id === 'component') el.actions.type = 'Buton';
  return spec;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Number(ms) || 0));

interface LogLine {
  id: number;
  kind: 'dispatch' | 'settle-ok' | 'settle-fail' | 'imperative';
  text: string;
}

/** The lesson half of each stage; `items` supplies the assignment half. */
const BUILD_CHECK_STAGES = [
  {
    id: 'registered',
    title: 'A check that rejects',
    concept: 'validation-function',
    when:
      'Only when none of the fourteen built-in `check.*` helpers fits — required, email, minLength and the rest need no code from you, and a custom function is one more name the spec has to spell correctly. Write one for a rule that is genuinely yours, such as an IBAN or an internal code format, and treat it as an affordance rather than a rule: it runs in the browser, so whatever it guards has to be checked again on the server.',
    focus: 'checks',
  },
  {
    id: 'unregistered',
    title: 'An unknown check fails open',
    when:
      'Remember this one when you are deciding WHERE a rule should live. A check whose type is not registered is skipped rather than failed, so a typo in the spec, or a provider mounted without its `validationFunctions`, quietly makes every field valid — and a console warning is the whole of your notice. Register the set in one place beside the provider, and never let this be the only thing standing between a user and a bad write.',
    ref: 'val-helpers',
    focus: 'checks',
    summary:
      'A check whose `type` is not in `validationFunctions` is skipped, not failed. The same bad value now passes, nothing appears in the UI, and the only trace is a console warning — which is why a check is never a security boundary.',
  },
  {
    id: 'success',
    title: 'onSuccess writes back',
    concept: 'on-success-error',
    when:
      'Put the write in `onSuccess` when it is a UI consequence someone might reasonably want to change — a status flag, a toast, a navigation — and keep it inside the handler only when it is part of the work itself. That split is what lets one `archiveInvoice` serve two screens that react differently. It has no effect on built-in actions: `onSuccess` on a `setState` binding is dead code.',
    focus: 'handlers',
  },
  {
    id: 'error',
    title: 'onError catches a throw',
    concept: 'action-handler',
    when:
      'Throw from your handler whenever the spec should get to decide what the failure looks like, and swallow the error only when there is genuinely nothing for the UI to say. Resolving counts as success whatever you return, so a handler that returns `{ ok: false }` takes the `onSuccess` branch — the dispatcher awaits the promise and has nothing else to read. `onError` is the spec’s half of the decision, not a replacement for your own cleanup around the call.',
    also: ['handler-async'],
    focus: 'handlers',
  },
  {
    id: 'imperative',
    title: 'Firing from outside React',
    concept: 'execute-action',
    when:
      'Only where there is no element to press — start-up work such as loading initial data before the tree mounts. Anything a user triggers belongs in an `on` binding, because going round the dispatcher loses the confirm dialog, `onSuccess`, `onError` and every `registerActionObserver` row, so the call is invisible to whatever you audit or debug actions with. A name it does not know only warns.',
    focus: 'handlers',
  },
  {
    id: 'validate',
    title: 'What the validator cannot see',
    when:
      'Run it on every spec a model produced, paired with `validateSpec`: one knows your component names and prop types, the other knows structure, and neither knows the other’s half. Do not stretch it into a general safety net — action names, `on` bindings and check types are ordinary strings it never reads, so a typo in those is caught only by `defineRegistry` at compile time, or by pressing the thing and watching the log.',
    ref: 'util-catalogvalidate',
    focus: 'validate',
    summary:
      '`catalog.validate(spec)` Zod-parses a spec against the catalog and returns `{ success: true, data }` or `{ success: false, error }` with a real `ZodError`. It is the only check that knows your component names — and it never looks inside an `on` binding or at a check `type`, so neither failure in this lab is one it can report.',
  },
];

export function BuildCheckLab() {
  /* ------------------------------------------------------------- shared */
  const [log, setLog] = useState<LogLine[]>([]);
  const [fired, setFired] = useState<string[]>([]);
  const logSeq = useRef(0);

  const push = useCallback((kind: LogLine['kind'], text: string) => {
    logSeq.current += 1;
    const id = logSeq.current;
    setLog((prev) => [{ id, kind, text }, ...prev].slice(0, 60));
  }, []);

  useEffect(() => {
    // Global, not per-provider. Every dispatch through ActionProvider lands
    // here — and nothing that bypasses ActionProvider does.
    return registerActionObserver({
      onDispatch: (e: ActionDispatchInfo) =>
        push('dispatch', `→ ${e.name}${e.params ? ` ${JSON.stringify(e.params)}` : ''}`),
      onSettle: (e: ActionSettleInfo) =>
        push(
          e.ok ? 'settle-ok' : 'settle-fail',
          `${e.ok ? '✓' : '✗'} ${e.name} · ${Math.round(e.durationMs)}ms${
            e.error ? ` · ${errorText(e.error)}` : ''
          }`,
        ),
    });
  }, [push]);

  const trackFired = useCallback((name: string) => {
    setFired((prev) => [...prev, name].slice(-100));
  }, []);

  /* ------------------------------------------------------ half one state */
  const [ibanBody, setIbanBody] = useState(DEFAULT_IBAN);
  const [ibanRegistered, setIbanRegistered] = useState(true);

  const ibanCompiled = useMemo(
    () => compileBody<(value: unknown, args?: Record<string, unknown>) => unknown>(['value', 'args'], ibanBody),
    [ibanBody],
  );

  // The body is read through a ref so typing does not hand the provider a new
  // map on every keystroke; only the register toggle changes the map itself,
  // because "unregistered" has to mean genuinely absent, not a stub returning
  // true. That difference is the whole point of the first two tasks.
  const ibanRef = useRef(ibanCompiled);
  ibanRef.current = ibanCompiled;

  type CheckFn = (value: unknown, args?: Record<string, unknown>) => boolean;
  const validationFunctions = useMemo<Record<string, CheckFn>>(() => {
    const out: Record<string, CheckFn> = {};
    if (!ibanRegistered) return out;
    out.iban = (value, args) => {
      const c = ibanRef.current;
      if (!c.ok || !c.fn) return false;
      try {
        return Boolean(c.fn(value, args));
      } catch {
        // runValidationCheck does not catch for you; a throwing check would
        // take the field render with it.
        return false;
      }
    };
    return out;
  }, [ibanRegistered]);

  const formStore = useMemo(() => createStateStore(structuredClone(FORM_SEED)), []);
  const formState = useSyncExternalStore(formStore.subscribe, formStore.getSnapshot, formStore.getSnapshot);
  const result = at(formState, '/result') as { valid?: boolean; errors?: Record<string, string[]> } | null;

  const formHandlers = useMemo(
    () => ({
      submit: async () => {
        trackFired('submit');
      },
      notify: async () => {
        trackFired('notify');
      },
      reset: async () => {
        trackFired('reset');
      },
    }),
    [trackFired],
  );

  /* ---------------------------------------------------- half three state */
  const [probe, setProbe] = useState<ProbeId>('none');
  const [probesSeen, setProbesSeen] = useState<ProbeId[]>([]);
  const chooseProbe = (id: ProbeId) => {
    setProbe(id);
    setProbesSeen((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
  const probed = useMemo(() => probeSpec(probe), [probe]);
  const probeResult = useMemo(() => archiveCatalog.validate(probed), [probed]);
  const probeIssue = probeResult.error?.issues?.[0];

  /* ------------------------------------------------------ half two state */
  const [handlerBody, setHandlerBody] = useState(DEFAULT_HANDLER);
  const [failNext, setFailNext] = useState(false);
  const [imperative, setImperative] = useState<string | null>(null);

  const handlerCompiled = useMemo(
    () =>
      compileAsyncBody<(params: Record<string, unknown>, failNext: boolean, s: typeof sleep) => Promise<unknown>>(
        ['params', 'failNext', 'sleep'],
        handlerBody,
      ),
    [handlerBody],
  );

  const archiveStore = useMemo(() => createStateStore(structuredClone(ARCHIVE_SEED)), []);
  const archiveState = useSyncExternalStore(
    archiveStore.subscribe,
    archiveStore.getSnapshot,
    archiveStore.getSnapshot,
  );

  /** A SetState over a StateStore — what executeAction wants and the provider already has. */
  const setState = useCallback<SetState>(
    (updater) => {
      const next = updater(archiveStore.getSnapshot());
      archiveStore.update(Object.fromEntries(Object.entries(next).map(([k, v]) => [`/${k}`, v])));
    },
    [archiveStore],
  );

  /**
   * The live body and the throw toggle are read through refs, so editing the
   * handler does not rebuild the registry — a new registry means new component
   * identities, which would remount the form under you on every keystroke.
   */
  const handlerRef = useRef(handlerCompiled);
  handlerRef.current = handlerCompiled;
  const failRef = useRef(failNext);
  failRef.current = failNext;

  const runHandler = useCallback(async (params: Record<string, unknown> | undefined) => {
    const c = handlerRef.current;
    if (!c.ok || !c.fn) throw new Error(c.error ?? 'the handler body did not compile');
    return c.fn(params ?? {}, failRef.current, sleep);
  }, []);

  /** The registry half two uses — built once, like a real app's. */
  const built = useMemo(
    () =>
      defineRegistry(archiveCatalog, {
        components: guardAll(demoComponentImpls) as never,
        actions: {
          submit: async () => {},
          notify: async () => {},
          reset: async () => {},
          archiveInvoice: async (params: Record<string, unknown> | undefined) => {
            await runHandler(params);
          },
        } as never,
      }),
    [runHandler],
  );

  const archiveHandlers = useMemo(
    () => ({
      archiveInvoice: async (params: Record<string, unknown>) => {
        trackFired('archiveInvoice');
        return runHandler(params);
      },
      notify: async (params: Record<string, unknown>) => {
        trackFired('notify');
        push('settle-fail', `toast: ${String(params?.message ?? '')}`);
      },
      submit: async () => {
        trackFired('submit');
      },
      reset: async () => {
        trackFired('reset');
      },
    }),
    [runHandler, trackFired, push],
  );

  const runImperative = async () => {
    setImperative('running…');
    push('imperative', `executeAction('archiveInvoice') — outside React, bypassing the dispatcher`);
    try {
      await built.executeAction(
        'archiveInvoice',
        { id: String(at(archiveStore.getSnapshot(), '/selected') ?? '') },
        setState,
        archiveStore.getSnapshot(),
      );
      setImperative('resolved');
      push('imperative', '✓ resolved — note: no dispatch row above, no onSuccess, no confirm');
    } catch (e) {
      setImperative(errorText(e));
      push('imperative', `✗ threw: ${errorText(e)} — and nothing handled it`);
    }
  };

  const handlerNames = Object.keys(built.handlers(() => setState, () => archiveStore.getSnapshot()));

  const items: ChecklistItem[] = [
    {
      label: (
        <>
          With <code>iban</code> registered, validate the form and get a rejection.
        </>
      ),
      done: ibanRegistered && result?.valid === false,
      hint: 'Blur the field, or press Validate form — validateForm writes its verdict to /result.',
      steps: [
        <>
          Check the button in the header of the{' '}
          <strong>validationFunctions — a check the spec names and you supply</strong> panel reads{' '}
          <strong>● registered</strong>.
        </>,
        <>
          Read the code block under the editor: it shows{' '}
          <code>validationFunctions={'{ iban }'}</code> — what the provider is actually being handed.
        </>,
        <>
          In the rendered form on the right, press <strong>Validate form</strong>. The IBAN field is
          seeded with <code>NOT-AN-IBAN</code>.
        </>,
        <>
          The pill under the form flips to <strong>rejected</strong>, and the{' '}
          <code>/result</code> block shows <code>valid: false</code> with your message under{' '}
          <code>/form/iban</code>.
        </>,
        <>
          Read the <strong>dispatch log</strong>: <code>→ validateForm</code>, then a green{' '}
          <code>✓ validateForm</code>.
        </>,
      ],
      apply: { label: 'make sure iban is registered', run: () => setIbanRegistered(true) },
    },
    {
      label: (
        <>
          Unregister it and validate again. The same bad value now passes: an unknown check{' '}
          <strong>fails open</strong>.
        </>
      ),
      done: !ibanRegistered && result?.valid === true,
      hint: 'Check the console: "Unknown validation function: iban". That warning is the only signal you get.',
      steps: [
        <>
          Press the <strong>● registered</strong> button in that panel&rsquo;s header. It becomes{' '}
          <strong>○ not registered</strong> and the code block under the editor becomes{' '}
          <code>validationFunctions={'{}'}</code>.
        </>,
        <>
          Change nothing in the form — the value is still <code>NOT-AN-IBAN</code>.
        </>,
        <>
          Press <strong>Validate form</strong> again.
        </>,
        <>
          The pill now reads <strong>valid — because nothing checked it</strong>, and{' '}
          <code>/result</code> says <code>valid: true</code>. An unknown check fails <em>open</em>.
        </>,
        <>
          Open the browser console: one line,{' '}
          <code>Unknown validation function: iban</code>. That warning is the entire signal you get in
          production.
        </>,
      ],
      apply: { label: 'unregister it', run: () => setIbanRegistered(false) },
    },
    {
      label: (
        <>
          Archive the invoice and let <code>onSuccess</code> write <code>&quot;archived&quot;</code> to{' '}
          <code>/status</code>.
        </>
      ),
      done: at(archiveState, '/status') === 'archived',
      steps: [
        // This stage scopes the page to the handlers panel, so it is the only
        // one on screen — there is no second panel to scroll to.
        <>
          You are on{' '}
          <strong>action handlers — onSuccess, onError, and the imperative back door</strong>, the one panel this
          stage shows.
        </>,
        <>
          Check the header button reads <strong>○ make it throw</strong> (off).
        </>,
        <>
          Press <strong>Archive invoice</strong> in the rendered card, then <strong>Archive</strong> in
          the confirmation dialog. The dialog came from the spec&rsquo;s <code>confirm</code> block, not
          from your handler.
        </>,
        <>
          Wait out the <code>sleep(450)</code>, then read the state block at the bottom:{' '}
          <code>status: &quot;archived&quot;</code>, written by <code>onSuccess</code>.
        </>,
        <>
          The Alert appears because its <code>visible</code> watches <code>/status</code> — the handler
          wrote nothing and knew nothing about it.
        </>,
      ],
    },
    {
      label: (
        <>
          Flip <strong>make it throw</strong> and watch <code>onError</code> dispatch the notify toast
          instead.
        </>
      ),
      done: fired.includes('notify'),
      hint: 'onError runs only when your handler rejects. Returning a falsy value is still success.',
      steps: [
        <>
          Press <strong>○ make it throw</strong> in that panel&rsquo;s header so it reads{' '}
          <strong>● make it throw</strong>.
        </>,
        <>
          Read the handler body: <code>if (failNext)</code> is what that switch feeds — the throw is
          ordinary code, not a library feature.
        </>,
        <>
          Press <strong>Archive invoice</strong> and confirm again.
        </>,
        <>
          In the <strong>dispatch log</strong>, read the red rows: a failed settle for{' '}
          <code>archiveInvoice</code> carrying the gateway message, then{' '}
          <code>toast: Archive failed — read the log.</code> from the <code>onError</code> branch.
        </>,
        <>
          <code>/status</code> is unchanged — <code>onSuccess</code> never ran.
        </>,
      ],
      apply: { label: 'flip "make it throw"', run: () => setFailNext(true) },
    },
    {
      label: (
        <>
          Fire <code>executeAction</code> from outside React and compare the log rows.
        </>
      ),
      done: imperative !== null && imperative !== 'running…',
      hint: 'It runs the registry action directly — no observer, no confirm, no onSuccess.',
      steps: [
        <>
          Press <strong>clear</strong> on the dispatch log so the comparison is clean.
        </>,
        <>
          Press <strong>executeAction(&apos;archiveInvoice&apos;)</strong> in the grey box under the
          handler editor.
        </>,
        <>
          Read the orange rows that appear: they are printed by the lab itself. There is no{' '}
          <code>→ archiveInvoice</code> dispatch row and no green <code>✓</code> settle — the observer
          never saw it.
        </>,
        <>
          No confirmation dialog appeared and <code>/status</code> did not change:{' '}
          <code>confirm</code>, <code>onSuccess</code> and <code>onError</code> all live in the
          dispatcher you just bypassed.
        </>,
      ],
      apply: { label: 'fire it for me', run: () => void runImperative() },
    },
    {
      label: (
        <>
          Break the spec three ways and ask <code>catalog.validate</code> about each. It notices exactly
          one of them.
        </>
      ),
      done:
        probesSeen.includes('check') && probesSeen.includes('action') && probesSeen.includes('component'),
      hint: 'catalog.validate Zod-parses the spec against your catalog: it knows the component names and the spec shape, and nothing about checks, handlers or on bindings.',
      steps: [
        <>
          Press <strong>checks[0].type → &quot;ibna&quot;</strong>. The verdict stays{' '}
          <strong>success</strong>: a check&rsquo;s <code>type</code> is an ordinary string inside a
          prop, and no validator owns the list of names you registered.
        </>,
        <>
          Press <strong>on.press[1].action → &quot;sumbit&quot;</strong>. Still{' '}
          <strong>success</strong> — <code>catalog.validate</code> does not read <code>on</code> bindings
          or action params at all.
        </>,
        <>
          Press <strong>actions.type → &quot;Buton&quot;</strong>. Now it fails, with a real{' '}
          <code>ZodError</code> issue at <code>elements.actions.type</code> listing every name the
          catalog declares.
        </>,
        <>
          That is the whole of its knowledge: component names, and the spec shape the schema describes —
          it is stricter than the renderer there, because it insists on <code>children</code>. Pair it
          with <code>validateSpec</code> for structure, and you have still checked neither of the two
          names this lab is about.
        </>,
      ],
      apply: {
        label: 'try all three',
        run: () => {
          chooseProbe('check');
          chooseProbe('action');
          chooseProbe('component');
        },
      },
    },
  ];

  const stages = stagesFromChecklist(items, BUILD_CHECK_STAGES);

  /* ------------------------------------------------- half one: checks */
  const checksPanel = (
    <Panel
      title="validationFunctions — a check the spec names and you supply"
      right={
        <div className="flex items-center gap-2">
          {ibanCompiled.ok ? <Pill tone="ok">compiles</Pill> : <Pill tone="bad">syntax error</Pill>}
          <ChromeButton active={ibanRegistered} onClick={() => setIbanRegistered((v) => !v)}>
            {ibanRegistered ? '● registered' : '○ not registered'}
          </ChromeButton>
        </div>
      }
      bodyClassName="grid gap-3 p-3 lg:grid-cols-2"
    >
      <div className="flex flex-col gap-2">
        <div className="overflow-hidden rounded-md border">
          <div className="border-b bg-muted px-3 py-1 font-mono text-[11px] text-muted-foreground">
            (value: unknown, args?: Record&lt;string, unknown&gt;) =&gt; boolean
          </div>
          <div className="h-[180px]">
            <CodeEditor value={ibanBody} onChange={setIbanBody} jsx={false} />
          </div>
          {ibanCompiled.error && (
            <div className="bg-red-50 px-3 py-1.5 font-mono text-[12px] text-red-700 dark:bg-red-950 dark:text-red-300">
              {ibanCompiled.error}
            </div>
          )}
        </div>
        <pre className="overflow-x-auto rounded-md border bg-surface px-3 py-2 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
{`<JSONUIProvider
  registry={registry}
  validationFunctions={${ibanRegistered ? '{ iban }' : '{}'}}
>`}
        </pre>
      </div>

      <div className="flex flex-col gap-2">
        <div className="rounded-md border bg-background p-3">
          <JSONUIProvider
            registry={demoRegistry}
            store={formStore}
            handlers={formHandlers}
            validationFunctions={validationFunctions}
          >
            <Renderer spec={FORM_SPEC} registry={demoRegistry} fallback={UnknownComponent} />
          </JSONUIProvider>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">/result</span>
          {result === null || result === undefined ? (
            <Pill tone="idle">not validated yet</Pill>
          ) : result.valid ? (
            <Pill tone={ibanRegistered ? 'ok' : 'warn'}>
              {ibanRegistered ? 'valid' : 'valid — because nothing checked it'}
            </Pill>
          ) : (
            <Pill tone="bad">rejected</Pill>
          )}
        </div>
        <pre className="max-h-[120px] overflow-auto rounded-md border bg-surface px-3 py-2 font-mono text-[11.5px] text-foreground">
          {JSON.stringify(at(formState, '/result') ?? null, null, 2)}
        </pre>
      </div>
    </Panel>
  );

  const logPanel = (
    <Panel
      title="dispatch log · registerActionObserver (global — both halves)"
      right={<ChromeButton onClick={() => setLog([])}>clear</ChromeButton>}
      bodyClassName="p-0"
    >
      <ul className="max-h-[200px] divide-y overflow-auto">
        {log.length === 0 && (
          <li className="px-3 py-1.5 font-mono text-[11.5px] text-muted-foreground">nothing dispatched</li>
        )}
        {log.map((l) => (
          <li
            key={l.id}
            className={`px-3 py-1 font-mono text-[11.5px] ${
              l.kind === 'settle-fail'
                ? 'text-red-600 dark:text-red-400'
                : l.kind === 'settle-ok'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : l.kind === 'imperative'
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-foreground'
            }`}
          >
            {l.text}
          </li>
        ))}
      </ul>
    </Panel>
  );

  /* -------------------------------------------- half three: the spec */
  const validatePanel = (
    <Panel
      title="catalog.validate — the only check that knows your component names"
      right={probeResult.success ? <Pill tone="ok">success</Pill> : <Pill tone="bad">rejected</Pill>}
      bodyClassName="grid gap-3 p-3 lg:grid-cols-2"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {PROBES.map((pr) => (
            <ChromeButton key={pr.id} active={probe === pr.id} onClick={() => chooseProbe(pr.id)}>
              {pr.label}
            </ChromeButton>
          ))}
        </div>
        <pre className="max-h-[220px] overflow-auto rounded-md border bg-surface px-3 py-2 font-mono text-[11.5px] leading-relaxed text-foreground">
          {JSON.stringify(
            {
              'elements.iban.props.checks': probed.elements.iban.props.checks,
              'elements.actions.type': probed.elements.actions.type,
              'elements.actions.on.press': probed.elements.actions.on?.press,
            },
            null,
            2,
          )}
        </pre>
      </div>

      <div className="flex flex-col gap-2">
        <pre className="max-h-[220px] overflow-auto rounded-md border bg-surface px-3 py-2 font-mono text-[11.5px] leading-relaxed text-foreground">
          {probeResult.success
            ? '{ success: true, data: { … } }   // the error key is absent, not undefined'
            : `{\n  success: false,\n  error.issues[0].path: ${JSON.stringify(
                probeIssue?.path?.join('.') ?? '',
              )},\n  error.issues[0].message: ${JSON.stringify(probeIssue?.message ?? '')}\n}`}
        </pre>
        <div className="rounded-md border border-l-2 border-l-orange-500 bg-surface px-3 py-2 text-[13.5px] leading-relaxed">
          Two of these three typos are invisible to it. What it does check is the element{' '}
          <em>types</em> and the spec shape the schema describes; a check name lives in a prop and a
          handler name lives in <code>on</code>, and it reads inside neither. <code>validateSpec</code>{' '}
          is the other half — structure, no catalog — and it reads inside neither either, which is how
          both of this lab&rsquo;s failures reach production unannounced.
        </div>
      </div>
    </Panel>
  );

  /* ---------------------------------------------- half two: handlers */
  const handlersPanel = (
    <Panel
      title="action handlers — onSuccess, onError, and the imperative back door"
      right={
        <div className="flex items-center gap-2">
          {handlerCompiled.ok ? <Pill tone="ok">compiles</Pill> : <Pill tone="bad">syntax error</Pill>}
          <ChromeButton active={failNext} onClick={() => setFailNext((v) => !v)}>
            {failNext ? '● make it throw' : '○ make it throw'}
          </ChromeButton>
        </div>
      }
      bodyClassName="grid gap-3 p-3 lg:grid-cols-2"
    >
      <div className="flex flex-col gap-2">
        <div className="overflow-hidden rounded-md border">
          <div className="border-b bg-muted px-3 py-1 font-mono text-[11px] text-muted-foreground">
            async archiveInvoice(params) — in scope: params, failNext, sleep
          </div>
          <div className="h-[200px]">
            <CodeEditor value={handlerBody} onChange={setHandlerBody} jsx={false} />
          </div>
          {handlerCompiled.error && (
            <div className="bg-red-50 px-3 py-1.5 font-mono text-[12px] text-red-700 dark:bg-red-950 dark:text-red-300">
              {handlerCompiled.error}
            </div>
          )}
        </div>

        <div className="rounded-md border bg-surface px-3 py-2">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
            defineRegistry(catalog, {'{ actions }'}) also returns
          </div>
          <pre className="mt-1 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-foreground">
{`handlers(getSetState, getState)
  → { ${handlerNames.join(', ')} }
  → each one no-ops when getSetState() is undefined

executeAction(name, params, setState, state)
  → awaits the registry action directly`}
          </pre>
          <div className="mt-2 flex items-center gap-2">
            <ActionButton onClick={runImperative}>executeAction(&apos;archiveInvoice&apos;)</ActionButton>
            {imperative && (
              <span className="font-mono text-[11.5px] text-muted-foreground">{imperative}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="rounded-md border bg-background p-3">
          <JSONUIProvider registry={built.registry} store={archiveStore} handlers={archiveHandlers}>
            <Renderer spec={ARCHIVE_SPEC} registry={built.registry} fallback={UnknownComponent} />
          </JSONUIProvider>
        </div>

        {logPanel}

        <pre className="max-h-[110px] overflow-auto rounded-md border bg-surface px-3 py-2 font-mono text-[11.5px] text-foreground">
          {JSON.stringify(archiveState, null, 2)}
        </pre>
      </div>
    </Panel>
  );

  const closingNote = (
    <div className="rounded-lg border border-l-2 border-l-orange-500 bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed">
      The orange rows are the imperative call. There is no <code>→ archiveInvoice</code> dispatch above them and
      no <code>✓</code> settle: <code>executeAction</code> runs the registry&rsquo;s action function directly, so
      it skips the observer, the confirm dialog and both branches. It is for start-up work outside the React
      tree, not a shortcut for buttons.
    </div>
  );

  /* Each stage is one of the three instruments, so the page shows that one.
   * The log is global to both halves, so it follows the checks panel when the
   * handlers panel that normally holds it is not on screen. */
  const stagedBody = (stage: Stage) => (
    <div className="flex flex-col gap-3 pb-6">
      {(stage.focus ?? 'checks') === 'checks' && (
        <>
          {checksPanel}
          {logPanel}
        </>
      )}
      {stage.focus === 'validate' && validatePanel}
      {stage.focus === 'handlers' && (
        <>
          {handlersPanel}
          {closingNote}
        </>
      )}
    </div>
  );

  return (
    <StageFrame slug="build-check" stages={stages}>
      {(stage) => stagedBody(stage)}
    </StageFrame>
  );
}
