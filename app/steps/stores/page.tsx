import { StoreLab } from '@/components/lab/store-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="stores"
      lab={<StoreLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        Same spec, three owners. Press <strong>write from outside React</strong> in each.
      </p>


      <Facts
        rows={[
          { k: 'uncontrolled', v: <>Provider owns the state. Observe via <code key="a">onStateChange</code>; you cannot read it on demand and nothing outside React can write.</> },
          { k: 'controlled', v: <>You own it. <code key="b">initialState</code> and <code key="c">onStateChange</code> are ignored. <strong>Default to this.</strong></> },
          { k: 'adapter', v: <>Any library, via <code key="d">createStoreAdapter</code>. Redux, Zustand, Jotai, XState.</> },
          { k: 'the interface', v: <>
              Five methods: <code key="e">get</code>, <code key="f">set</code>, <code key="g">update</code>,{' '}
              <code key="h">getSnapshot</code>, <code key="i">subscribe</code>. That is the whole extension point.
            </>, },
        ]}
      />

      <p>
        The three modes differ by <em>one prop</em> on the provider. Here is each one in full — the same three
        snippets the lab prints under the preview as you switch modes.
      </p>

      <Code lang="tsx" title="1 · uncontrolled — the provider owns it">{`import { JSONUIProvider, Renderer } from '@json-render/react';

// You pass a starting value and never hold a reference to the store.
// StateProvider (inside JSONUIProvider) creates it and keeps it.
<JSONUIProvider
  registry={registry}
  initialState={{ name: 'Ada' }}
  onStateChange={(changes) => {
    // fires once per set/update: [{ path: '/name', value: 'Adam' }]
    console.log(changes);
  }}
>
  <Renderer spec={spec} registry={registry} />
</JSONUIProvider>

// There is no store variable, so there is no getSnapshot() to call and
// no set() to call. Observation only — one-way, out of the tree.`}</Code>

      <Code lang="tsx" title="2 · controlled — you own it (default to this)">{`import { createStateStore } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';

// Made outside React, so it outlives renders and anything can reach it.
const store = createStateStore({ name: 'Ada' });

<JSONUIProvider registry={registry} store={store}>
  <Renderer spec={spec} registry={registry} />
</JSONUIProvider>

// From a websocket handler, a timer, an agent loop, a test — anywhere:
store.get('/name');                               // 'Ada'
store.set('/name', 'Grace');                      // renderer re-renders
store.update({ '/name': 'Grace', '/role': 'ops' }); // one notification
store.getSnapshot();                              // { name: 'Grace', role: 'ops' }

// initialState and onStateChange are IGNORED once store is passed:
// the store is the single source of truth.`}</Code>

      <Code lang="tsx" title="3 · adapter — a library you already use owns it">{`import { createStoreAdapter } from '@json-render/core/store-utils';
import { JSONUIProvider, Renderer } from '@json-render/react';

// myStore is Redux, Zustand, Jotai, XState — or fifteen lines of your own.
// Supply three functions; get the full StateStore back.
const adapter = createStoreAdapter({
  getSnapshot: () => myStore.getState(),
  setSnapshot: (next) => myStore.setState(next),
  subscribe:   (listener) => myStore.subscribe(listener),
});

// createStoreAdapter fills in the rest from those three:
//   get(path)            -> reads the snapshot by JSON Pointer
//   set(path, value)     -> immutable write + setSnapshot, no-op detected
//   update(patch)        -> batched write, one notification
//   getSnapshot()        -> yours, verbatim
//   getServerSnapshot()  -> falls back to getSnapshot for SSR
//   subscribe(listener)  -> yours, verbatim

<JSONUIProvider registry={registry} store={adapter}>
  <Renderer spec={spec} registry={registry} />
</JSONUIProvider>`}</Code>

      <Gotchas>
        <Gotcha>
              Uncontrolled is a dead end the moment anything outside the tree needs to write — a websocket, a
              background job, or an agent filling a form field by field while the user watches (<StepRef slug="patterns" />).
        </Gotcha>
        <Gotcha>
              <code>set</code> no-ops when the value is unchanged. If you wrap the store for telemetry, compare
              snapshot identity, not call counts — that is what the log tab in every lab does.
        </Gotcha>
      </Gotchas>
    </StepPage>
  );
}
