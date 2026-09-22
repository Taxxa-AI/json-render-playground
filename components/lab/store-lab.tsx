'use client';

import type { Spec, StateStore } from '@json-render/core';
import { createStateStore } from '@json-render/core';
import { createStoreAdapter } from '@json-render/core/store-utils';
import { JSONUIProvider, Renderer, StateProvider } from '@json-render/react';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { Chip, Code, Panel } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';

/**
 * Three ways to own the state model, side by side, running the same spec.
 *
 * The point of the third one: `createStoreAdapter` needs only
 * { getSnapshot, setSnapshot, subscribe } — so ANY external store works. The
 * "external store" here is a hand-rolled 15-line pub/sub, deliberately not a
 * real library, to show how little surface is required.
 */

const SPEC: Spec = {
  root: 'card',
  elements: {
    card: { type: 'Card', props: { title: 'Same spec, three owners', subtitle: null }, children: ['name', 'echo'] },
    name: {
      type: 'TextInput',
      props: { label: 'Name', value: { $bindState: '/name' }, placeholder: 'type here', help: null, required: null, checks: null },
      children: [],
    },
    echo: { type: 'Badge', props: { label: { $template: 'state.name = ${/name}' }, tone: 'info' }, children: [] },
  },
};

/** A deliberately naive external store — stands in for Redux/Zustand/XState. */
function makeExternalStore(initial: Record<string, unknown>) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => snapshot,
    setState: (next: Record<string, unknown>) => {
      snapshot = next;
      for (const l of listeners) l();
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

type Mode = 'uncontrolled' | 'controlled' | 'adapter';

/**
 * The wiring for each mode, printed under the preview as you switch.
 * These are the real calls this file makes — not a paraphrase of them.
 */
const WIRING: Record<Mode, { title: string; code: string }> = {
  uncontrolled: {
    title: 'uncontrolled · the provider owns it',
    code: `import { JSONUIProvider, Renderer } from '@json-render/react';

// You pass a starting value and never hold a reference to the store.
<JSONUIProvider
  registry={registry}
  initialState={{ name: 'Ada' }}
  onStateChange={(changes) => {
    // fires once per set/update: [{ path: '/name', value: 'Adam' }]
    setLastChange(changes);
  }}
>
  <Renderer spec={SPEC} registry={registry} />
</JSONUIProvider>

// No store variable -> no getSnapshot() to call, no set() to call.
// That is why "write from outside React" is disabled in this mode.`,
  },
  controlled: {
    title: 'controlled · you own it',
    code: `import { createStateStore } from '@json-render/core';

// Made outside React, so it outlives renders and anything can reach it.
const controlled = createStateStore({ name: 'Ada' });

<JSONUIProvider registry={registry} store={controlled}>
  <Renderer spec={SPEC} registry={registry} />
</JSONUIProvider>

// The button above calls exactly this, outside the tree:
controlled.set('/name', \`set at \${stamp}\`);

// ...and the right-hand panel reads it back on demand:
controlled.getSnapshot();  // { name: 'set at 14:02:11' }

// initialState and onStateChange are IGNORED once store is passed.`,
  },
  adapter: {
    title: 'adapter · a foreign store owns it',
    code: `import { createStoreAdapter } from '@json-render/core/store-utils';

// \`external\` is the 15-line pub/sub at the top of this file — stands in
// for Redux / Zustand / Jotai / XState. Supply three functions:
const adapter = createStoreAdapter({
  getSnapshot: () => external.getState(),
  setSnapshot: (next) => external.setState(next),
  subscribe:   (listener) => external.subscribe(listener),
});

// createStoreAdapter fills in the rest from those three:
//   get / set (no-op detected) / update (batched) / getServerSnapshot

<JSONUIProvider registry={registry} store={adapter}>
  <Renderer spec={SPEC} registry={registry} />
</JSONUIProvider>

// The button writes to the foreign store directly — json-render never
// sees the call, it just hears about it through subscribe:
external.setState({ ...external.getState(), name: \`external at \${stamp}\` });`,
  },
};

/** The lesson half of each stage; `items` supplies the assignment half. */
const STORE_STAGES = [
  {
    id: 'uncontrolled',
    focus: 'uncontrolled',
    title: 'The provider owns the state',
    when:
      'Uncontrolled suits a self-contained form that reports its result and nothing else — a demo, a one-screen editor. The moment anything outside the tree has to write into the model, a websocket or a background job or an agent filling fields, it is a dead end you rewrite through; defaulting to controlled means never meeting that wall.',
    concept: 'store-uncontrolled',
    ref: 'util-createstatestore',
    refs: ['prov-stateprovider'],
    tasks: 2,
    summary:
      'One feature, then its consequence: pass `initialState` and the provider makes the store, so the only thing visible from outside is what it chooses to report. The same spec then runs unchanged against all three modes — the store is the only moving part.',
  },
  {
    id: 'controlled',
    focus: 'controlled',
    title: 'Writing in from outside React',
    when:
      'Own the store yourself whenever you need to read the state on demand or write it from outside the render tree. The trap is passing `store` and `initialState` together: `store` wins, the seed silently does nothing, so put the seed inside `createStateStore` where it will actually be used.',
    concept: 'store-controlled',
  },
  {
    id: 'adapter',
    focus: 'adapter',
    title: 'A store json-render never knew',
    when:
      'Adapt an existing store when the app already has one source of truth worth keeping — Redux, Zustand, Jotai, XState — and the spec has to read and write the same model as everything else. If json-render state is only the form the user is filling in, `createStateStore` is less machinery and one fewer place for two copies to disagree.',
    concept: 'store-adapter',
    ref: 'util-createstoreadapter',
  },
];

export function StoreLab() {
  /**
   * The opening mode is the opening STAGE's mode.
   *
   * `onStageChange` below only fires on the client, so without this a deep link
   * to `?stage=2` server-renders the uncontrolled panel and only snaps to the
   * controlled one after hydration — which is exactly the first paint the
   * stage-addressable URL exists to make honest.
   */
  const opening = useInitialStage(STORE_STAGES.length);
  const [mode, setMode] = useState<Mode>(() => (STORE_STAGES[opening].focus ?? 'uncontrolled') as Mode);
  const [lastChange, setLastChange] = useState<string>('—');
  const [tried, setTried] = useState<Set<Mode>>(new Set(['uncontrolled']));
  const [pokedControlled, setPokedControlled] = useState(false);
  const [pokedAdapter, setPokedAdapter] = useState(false);

  const controlled = useMemo(() => createStateStore({ name: 'Ada' }), []);

  const external = useRef(makeExternalStore({ name: 'Grace' })).current;
  const adapter: StateStore = useMemo(
    () =>
      createStoreAdapter({
        getSnapshot: () => external.getState(),
        setSnapshot: (next) => external.setState(next as Record<string, unknown>),
        subscribe: (l) => external.subscribe(l),
      }),
    [external],
  );

  // Read whichever store is active, from outside the renderer.
  const controlledSnap = useSyncExternalStore(controlled.subscribe, controlled.getSnapshot, controlled.getSnapshot);
  const externalSnap = useSyncExternalStore(external.subscribe, external.getState, external.getState);

  const poke = useCallback(() => {
    const stamp = new Date().toLocaleTimeString();
    if (mode === 'controlled') {
      controlled.set('/name', `set at ${stamp}`);
      setPokedControlled(true);
    }
    if (mode === 'adapter') {
      external.setState({ ...external.getState(), name: `external at ${stamp}` });
      setPokedAdapter(true);
    }
  }, [mode, controlled, external]);

  const body = (
    <Renderer spec={SPEC} registry={demoRegistry} fallback={UnknownComponent} />
  );

  const items: ChecklistItem[] = [
    {
      label: (
        <>
          Get oriented: type in the input in <strong>uncontrolled</strong> mode and read the right-hand panel.
          The only thing you can see from outside is what <code>onStateChange</code> pushes at you.
        </>
      ),
      done: lastChange !== '—',
      hint: 'Rule: with initialState, the provider owns the model. There is no getSnapshot to call and nothing outside React can write — which is why the write button is disabled in this mode.',
      steps: [
        <>
          Check the chip row below: <strong>uncontrolled</strong> is the active mode.
        </>,
        <>
          In the <strong>preview · uncontrolled</strong> panel, click into <strong>Name</strong> and type a
          few characters.
        </>,
        <>
          The badge under the input follows along, so a state model plainly exists.
        </>,
        <>
          Read the right panel: <code>store.getSnapshot()</code> says{' '}
          <em>unavailable — the provider owns it</em>, and <code>onStateChange</code> now shows{' '}
          <code>/name = "…"</code>.
        </>,
        <>
          Note the <strong>write from outside React</strong> button at the right of the chip row: greyed out.
          There is nothing to write to.
        </>,
      ],
    },
    {
      label: 'Switch through all three ownership modes so you have seen each panel.',
      done: tried.size === 3,
      steps: [
        <>
          Click <strong>controlled</strong> in the chip row. The right panel gains{' '}
          <code>controlled.getSnapshot()</code>, printing the whole model on demand.
        </>,
        <>
          Click <strong>adapter</strong>. The row becomes <code>external.getState()</code> — a store
          json-render has never heard of, driving the same spec.
        </>,
        <>
          Click back to <strong>uncontrolled</strong> and watch the snapshot row disappear again.
        </>,
        <>
          All three dots on the chip row have now been active, and the preview rendered the same spec in each.
        </>,
      ],
      apply: {
        label: 'show all three',
        run: () => {
          setMode('adapter');
          setTried(new Set(['uncontrolled', 'controlled', 'adapter']));
        },
      },
    },
    {
      label: (
        <>
          In <strong>controlled</strong>, press <strong>write from outside React</strong> — the input updates
          with no event, no ref and no parent re-render.
        </>
      ),
      done: pokedControlled,
      hint: 'Rule: you made the store, so store.set() is available anywhere — a websocket handler, a timer, a test. The renderer subscribes to it and re-renders itself.',
      steps: [
        <>
          Click <strong>controlled</strong> in the chip row.
        </>,
        <>
          Press <strong>write from outside React</strong>, at the right of that row.
        </>,
        <>
          The <strong>Name</strong> input and the badge both jump to <code>set at …</code> — that came from{' '}
          <code>controlled.set(&apos;/name&apos;, …)</code>, called outside the tree.
        </>,
        <>
          Read <code>controlled.getSnapshot()</code> in the right panel: the same string, readable on demand.
        </>,
      ],
      apply: {
        label: 'write it for me',
        run: () => {
          setMode('controlled');
          controlled.set('/name', `set at ${new Date().toLocaleTimeString()}`);
          setPokedControlled(true);
        },
      },
    },
    {
      label: (
        <>
          In <strong>adapter</strong>, do the same through a store json-render has never heard of. Three
          functions were enough to make it a first-class state model.
        </>
      ),
      done: pokedAdapter,
      hint: 'Rule: createStoreAdapter({ getSnapshot, setSnapshot, subscribe }) fills in get, set, update, getServerSnapshot and no-op detection. The official Redux, Zustand and Jotai packages are each a few lines over it.',
      steps: [
        <>
          Click <strong>adapter</strong> in the chip row. The input reads <code>Grace</code> — this model came
          from the hand-rolled store, not from json-render.
        </>,
        <>
          Press <strong>write from outside React</strong>.
        </>,
        <>
          The input shows <code>external at …</code>: the write went into the foreign store and the renderer
          heard about it through <code>subscribe</code>.
        </>,
        <>
          Now type in the input and read <code>external.getState()</code> in the right panel — your keystrokes
          land in that same foreign object.
        </>,
        <>
          Read the code panel at the bottom — it follows the chip row, so it is showing{' '}
          <strong>adapter · a foreign store owns it</strong> right now: three functions, and that is the
          entire integration. Switch chips to see the other two modes wired up.
        </>,
      ],
      apply: {
        label: 'write it for me',
        run: () => {
          setMode('adapter');
          external.setState({ ...external.getState(), name: `external at ${new Date().toLocaleTimeString()}` });
          setPokedAdapter(true);
        },
      },
    },
  ];

  const stages = stagesFromChecklist(items, STORE_STAGES);

  const stagedBody = (
    <div className="flex flex-col gap-3">

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-surface px-3 py-2">
        {(['uncontrolled', 'controlled', 'adapter'] as Mode[]).map((m) => (
          <Chip
            key={m}
            active={mode === m}
            onClick={() => {
              setMode(m);
              setTried((prev) => new Set(prev).add(m));
            }}
          >
            {m}
          </Chip>
        ))}
        <button
          type="button"
          onClick={poke}
          disabled={mode === 'uncontrolled'}
          className="ml-auto rounded border px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground transition hover:text-foreground disabled:opacity-40"
        >
          write from outside React
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={`preview · ${mode}`} bodyClassName="overflow-auto">
          <div className="p-4" style={{ minHeight: 310 }}>
            {mode === 'uncontrolled' && (
              <JSONUIProvider
                registry={demoRegistry}
                initialState={{ name: 'Ada' }}
                onStateChange={(changes) =>
                  setLastChange(changes.map((c) => `${c.path} = ${JSON.stringify(c.value)}`).join(', '))
                }
              >
                {body}
              </JSONUIProvider>
            )}
            {mode === 'controlled' && (
              <JSONUIProvider registry={demoRegistry} store={controlled}>
                {body}
              </JSONUIProvider>
            )}
            {mode === 'adapter' && (
              <StateProvider store={adapter}>
                <JSONUIProvider registry={demoRegistry} store={adapter}>
                  {body}
                </JSONUIProvider>
              </StateProvider>
            )}
          </div>
        </Panel>

        <Panel title="what you can see from outside">
          <div className="flex flex-col gap-2.5 p-3 font-mono text-[12px]">
            {mode === 'uncontrolled' && (
              <>
                <Row label="store.getSnapshot()" value="unavailable — the provider owns it" tone="warn" />
                <Row label="onStateChange" value={lastChange} />
                <p className="border-t pt-2 font-sans text-[13.5px] leading-relaxed text-muted-foreground">
                  In uncontrolled mode the state lives inside <code>StateProvider</code>. You can observe changes via{' '}
                  <code>onStateChange</code>, but you cannot read the model on demand and nothing outside React can
                  write to it. Fine for a self-contained widget; a dead end the moment a websocket or a background
                  agent needs to push a value in.
                </p>
              </>
            )}
            {mode === 'controlled' && (
              <>
                <Row label="controlled.getSnapshot()" value={JSON.stringify(controlledSnap)} tone="ok" />
                <p className="border-t pt-2 font-sans text-[13.5px] leading-relaxed text-muted-foreground">
                  You made the store, so you can read and write it from anywhere. Press{' '}
                  <strong>write from outside React</strong> — the input updates with no event, no ref and no
                  re-render of the parent. <code>initialState</code> and <code>onStateChange</code> are ignored in
                  this mode; the store is the single source of truth.
                </p>
              </>
            )}
            {mode === 'adapter' && (
              <>
                <Row label="external.getState()" value={JSON.stringify(externalSnap)} tone="ok" />
                <p className="border-t pt-2 font-sans text-[13.5px] leading-relaxed text-muted-foreground">
                  The renderer is now driven by a store json-render has never heard of. Writes from the outside flow
                  in; edits in the input flow back out to the same object. That is the whole integration story for
                  Redux, Zustand, Jotai and XState — the official adapter packages are each a few lines over{' '}
                  <code>createStoreAdapter</code>.
                </p>
              </>
            )}
          </div>
        </Panel>
      </div>

      <Code lang="tsx" title={WIRING[mode].title}>{WIRING[mode].code}</Code>

    </div>
  );

  /**
   * Nothing here is hidden per stage, and that is the honest answer: three
   * owners side by side IS the instrument, and the first stage's second task
   * asks the learner to click all three chips. What was wrong is that the mode
   * did not follow the rail — you could stand on "Writing in from outside
   * React" reading the uncontrolled panel, whose only readout is the one that
   * says there is nothing to read. So the stage picks the mode, and every panel
   * below (preview, what you can see, the wiring code) already follows it.
   * `tried` is deliberately NOT marked here: arriving is not clicking, and a
   * task that ticks itself teaches nothing.
   */
  return (
    <StageFrame
      slug="stores"
      stages={stages}
      onStageChange={(stage) => {
        if (stage.focus) setMode(stage.focus as Mode);
      }}
    >
      {() => stagedBody}
    </StageFrame>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span
        className={
          tone === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'warn' ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}
