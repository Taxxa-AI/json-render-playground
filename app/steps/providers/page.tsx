import { ProvidersLab } from '@/components/lab/providers-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="providers"
      lab={<ProvidersLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        <code>JSONUIProvider</code> is not a runtime — it is six nested context providers and a dialog. Knowing
        which one owns what is the difference between &ldquo;the button does nothing&rdquo; and a one-line fix. The
        lab assembles the stack by hand so you can remove one layer at a time and read the exact failure.
      </p>

      <Code lang="tsx" title="what JSONUIProvider renders, in order">{`<StateProvider store={store} initialState={…} onStateChange={…}>
  <VisibilityProvider>
    <ValidationProvider customFunctions={validationFunctions}>
      <ActionProvider handlers={handlers} navigate={navigate}>
        <FunctionsContext.Provider  value={functions ?? {}}>        {/* not exported */}
          <DirectivesContext.Provider value={createDirectiveRegistry(directives)}>
            {children}
            <ConfirmationDialogManager />                            {/* not exported */}

// registry is a prop of JSONUIProvider and is never read. <Renderer> needs it.`}</Code>

      <Code lang="tsx" title="the two shapes you will actually ship">{`// 1. One provider, one renderer. Nine specs out of ten.
<JSONUIProvider registry={registry} store={store} handlers={handlers}>
  <Renderer spec={spec} registry={registry} fallback={Unknown} />
</JSONUIProvider>

// 2. One provider, many renderers — a chat log where each message carries a
//    spec, all sharing one state model and one handlers map.
<JSONUIProvider registry={registry} store={store} handlers={handlers}>
  {messages.map((m) => m.spec && <Renderer key={m.id} spec={m.spec} registry={registry} />)}
</JSONUIProvider>`}</Code>

      <Facts
        rows={[
          { k: 'StateProvider', v: <>Owns the model. <code key="a">store</code> (controlled) beats <code key="b">initialState</code> + <code key="c">onStateChange</code> (uncontrolled) — <StepRef key="d" slug="stores" />.</> },
          { k: 'VisibilityProvider', v: <>Builds <code key="e">{'{ stateModel }'}</code> and memoises an evaluator on it. Needs StateProvider above it.</> },
          { k: 'ValidationProvider', v: <>Field registrations, touched/validated flags and results. None of it is in the state model.</> },
          { k: 'ActionProvider', v: <>Built-ins, your handlers, the loading set and the pending confirmation.</> },
          { k: 'FunctionsContext', v: <>Not exported. <code key="f">$computed</code> only resolves under JSONUIProvider or createRenderer.</> },
          { k: 'DirectivesContext', v: <>Not exported either. Same story for custom <code key="g">$</code>-keys — <StepRef key="h" slug="directives" />.</> },
          { k: 'ConfirmDialog', v: <>Rendered by an internal <code key="i">ConfirmationDialogManager</code>. Hand-assemble the stack and a <code key="j">confirm</code> binding waits forever.</> },
          { k: 'Renderer', v: <><code key="k">spec</code>, <code key="l">registry</code>, <code key="m">loading</code>, <code key="n">fallback</code>. It is a consumer, not a provider — it must sit inside all of the above.</> },
          { k: 'createRenderer', v: <>Catalog + components in, one component out. Assembles the same six layers itself; takes <code key="o">state</code> rather than <code key="p">initialState</code> and has no <code key="q">validationFunctions</code>.</> },
        ]}
      />

      <Gotchas>
        <Gotcha>
          <strong><code>JSONUIProvider</code> ignores <code>registry</code>.</strong> It is in the props type, it is
          destructured, and nothing reads it. The registry that matters is the one you pass to{' '}
          <code>&lt;Renderer&gt;</code> — pass the provider one and forget the renderer one and you get an empty
          frame with no error.
        </Gotcha>
        <Gotcha>
          <strong>Three of the four layers are all-or-nothing.</strong> <code>ElementRenderer</code> calls{' '}
          <code>useStateStore</code>, <code>useVisibility</code> and <code>useActions</code> unconditionally, for
          every element, whether or not that element binds state, has a <code>visible</code> or fires an action. Miss
          any one and the entire tree throws — a spec of pure static text included.
        </Gotcha>
        <Gotcha>
          <strong>ValidationProvider is the odd one out, and that is worse.</strong> <code>ActionProvider</code>{' '}
          reads it through <code>useOptionalValidation</code>, so without it nothing crashes: components calling{' '}
          <code>useFieldValidation</code> throw into their own error boundary and quietly disappear, and{' '}
          <code>validateForm</code> logs a warning and writes nothing. A form that submits without validating looks
          exactly like a form that validated.
        </Gotcha>
        <Gotcha>
          <strong>Order is load-bearing, not cosmetic.</strong> <code>ValidationProvider</code> must sit{' '}
          <em>above</em> <code>ActionProvider</code>. Swap them and every hook still resolves, every field still
          validates on blur — but <code>validateForm</code> can no longer see <code>validateAll</code> and goes
          silent. The lab has a switch for it.
        </Gotcha>
        <Gotcha>
          <strong>Splitting the stack costs you two layers you cannot rebuild.</strong>{' '}
          <code>FunctionsContext</code> and <code>DirectivesContext</code> are module-private, so a hand-assembled
          tree can never resolve <code>$computed</code> or a custom directive: the first warns and returns{' '}
          <code>undefined</code>, the second leaves a raw object in your props. Split providers only to share{' '}
          <em>state</em> across trees — and then keep the JSONUIProvider around the part that renders specs.
        </Gotcha>
        <Gotcha>
          <strong><code>handlers</code> is read once.</strong> <code>ActionProvider</code> does{' '}
          <code>useState(initialHandlers)</code> and never syncs the prop again, so a handlers object rebuilt on
          re-render is ignored — the provider keeps the one from the first render. Build it in a{' '}
          <code>useMemo</code> with stable deps and read anything that changes through a ref, or add to it at
          runtime with <code>registerHandler</code>.
        </Gotcha>
        <Gotcha>
          <strong>Switching a StateProvider between controlled and uncontrolled is unsupported.</strong> The mode is
          captured on the first render; changing it later only warns in development. Decide before you mount.
        </Gotcha>
      </Gotchas>
    </StepPage>
  );
}
