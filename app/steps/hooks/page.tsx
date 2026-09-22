import { HooksLab } from '@/components/lab/hooks-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="hooks"
      lab={<HooksLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        A registry component is handed everything it needs as <em>data</em>: props already resolved, children
        already rendered, <code>emit</code> already wired. The hooks are for the other direction — reading a path
        nobody passed you, writing back, dispatching something the spec never asked for. One hook per stage, each
        one opening with what you hand it and what you get back, beside a real component in a real registry
        printing what its hook actually returned.
      </p>

      <Code lang="tsx" title="the two you will actually use">{`import { useBoundProp, useStateValue } from '@json-render/react';

// 1. Two-way binding. propValue is the resolved value; bindings.<prop> is the
//    path it came from. The hook just rejoins them.
const TextInput: ComponentFn<typeof catalog, 'TextInput'> = ({ props, bindings }) => {
  const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);
  return <input value={value ?? ''} onChange={(e) => setValue(e.target.value)} />;
};

// 2. Read any path, from anywhere inside the provider.
const CartBadge = () => {
  const items = useStateValue<CartItem[]>('/cart/items');
  return <span>{items?.length ?? 0}</span>;
};`}</Code>

      <Facts
        rows={[
          { k: <code key="a">useBoundProp</code>, v: <>A control that owns a value. The only hook that reads the <code key="b">bindings</code> map, so it handles <code key="c">$bindItem</code> inside a repeat too.</> },
          { k: <code key="d">useStateValue</code>, v: 'Read one path, anywhere. Returns T | undefined.' },
          { k: <code key="e">useStateStore</code>, v: <>Read <em key="f">and</em> write: <code key="g">state</code>, <code key="h">get</code>, <code key="i">set</code>, <code key="j">update</code>, <code key="k">getSnapshot</code>.</> },
          { k: <code key="l">useStateBinding</code>, v: <>Deprecated in 0.20.0. Path in, <code key="m">[value, setValue]</code> out — but blind to repeat scope.</> },
          { k: <code key="n">useAction</code>, v: <>Dispatch one binding object, with <code key="o">isLoading</code>. Not a name — a binding.</> },
          { k: <code key="p">useActions</code>, v: <>The whole action context: handlers, loading set, pending confirmation, <code key="q">execute</code>, <code key="r">confirm</code>, <code key="s">cancel</code>, <code key="t">registerHandler</code>.</> },
          { k: <code key="u">useIsVisible</code>, v: 'Evaluate a condition object the same way the renderer evaluates `visible`.' },
          { k: <code key="v">useVisibility</code>, v: <>The evaluator plus its context. Use when you evaluate several conditions.</> },
          { k: <code key="w">useFieldValidation</code>, v: <>Registers a field and returns <code key="x">state</code>, <code key="y">errors</code>, <code key="z">isValid</code>, <code key="A">validate</code>, <code key="B">touch</code>, <code key="C">clear</code>.</> },
          { k: <code key="D">useOptionalValidation</code>, v: <>Same context or <code key="E">null</code>. For components that must survive without a ValidationProvider.</> },
          { k: <code key="F">useRepeatScope</code>, v: <><code key="G">{'{ item, index, basePath }'}</code> or <code key="H">null</code>. <code key="I">basePath</code> is the absolute path of the current row.</> },
          { k: 'the other three', v: <><code key="J">useUIStream</code>, <code key="K">useChatUI</code>, <code key="L">useJsonRenderMessage</code> own a fetch, not a prop — <StepRef key="M" slug="generate" /> and <StepRef key="N" slug="chat" />.</> },
        ]}
      />

      <Gotchas>
        <Gotcha>
          <strong>Four of them throw outside their provider.</strong> <code>useStateStore</code>,{' '}
          <code>useStateValue</code>, <code>useStateBinding</code> and <code>useBoundProp</code> throw{' '}
          <code>&quot;useStateStore must be used within a StateProvider&quot;</code>; <code>useVisibility</code> and{' '}
          <code>useIsVisible</code> throw for <code>VisibilityProvider</code>; <code>useActions</code> and{' '}
          <code>useAction</code> for <code>ActionProvider</code>; <code>useValidation</code> and{' '}
          <code>useFieldValidation</code> for <code>ValidationProvider</code>. Only{' '}
          <code>useOptionalValidation</code> and <code>useRepeatScope</code> return <code>null</code> instead —
          and if you wrapped your components in error boundaries (as you should), the throw shows up as one control
          quietly missing. <StepRef slug="providers" /> reproduces each one.
        </Gotcha>
        <Gotcha>
          <strong>There is no per-path subscription.</strong> <code>StateProvider</code> rebuilds its context value
          on every write, so <code>useStateValue(&apos;/a&apos;)</code> re-renders when <code>/b</code> changes.
          Watch the render counters in the <code>useStateValue</code> probe. For a big form, memoise the leaf, or
          keep the chatty paths in a store of your own.
        </Gotcha>
        <Gotcha>
          <strong><code>useBoundProp</code> is not state.</strong> It returns the prop you passed in and a setter
          that writes to <code>bindingPath</code> — and does nothing at all when that path is undefined. A prop
          bound to a literal instead of <code>{'{ "$bindState": … }'}</code> produces an input that cannot be typed
          in, with no error anywhere.
        </Gotcha>
        <Gotcha>
          <strong><code>useAction</code> params are under-resolved.</strong> Bindings dispatched from the renderer
          (<code>on</code>, <code>watch</code>) get full prop resolution; a binding you hand to{' '}
          <code>useAction</code> goes straight to <code>resolveAction</code>, which understands{' '}
          <code>{'{ $state }'}</code> only. Memoise the binding object too, or <code>execute</code> changes
          identity every render.
        </Gotcha>
        <Gotcha>
          <strong><code>useFieldValidation</code> registers by rendering.</strong> A field inside a hidden element
          or a collapsed tab never registers, and <code>validateForm</code> then calls the form valid. Validation
          state lives in the provider, not in the state model — nothing about it appears in your JSON{' '}
          (<StepRef slug="validation" />).
        </Gotcha>
        <Gotcha>
          <strong><code>useStateStore().state</code> is a render snapshot.</strong> In an async callback it is
          stale by definition; call <code>getSnapshot()</code> for the live model. The renderer does exactly this
          before it resolves action params.
        </Gotcha>
      </Gotchas>
    </StepPage>
  );
}
