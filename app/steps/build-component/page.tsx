import { BuildComponentLab } from '@/components/lab/build-component-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="build-component"
      lab={<BuildComponentLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        <StepRef slug="build-catalog" /> declared a name and left the registry uncompilable. This is the other
        half: an ordinary React function that receives one object and returns nodes. Write it in the editor and it
        renders through the real <code>Renderer</code>, against a spec that exercises every field of that object
        at once.
      </p>

      <Code lang="tsx" title="lib/demo/components.tsx — what you would actually write">{`import { useBoundProp } from '@json-render/react';
import type { Components } from '@json-render/react';

export const demoComponentImpls: Components<typeof demoCatalog> = {
  // ONE argument, not a props spread. props is already resolved.
  Callout: ({ props, children, slots, emit, on, bindings, loading }) => {
    // props.draft holds the VALUE; bindings.draft holds the PATH it came
    // from. useBoundProp pairs them back up for two-way binding.
    const [draft, setDraft] = useBoundProp<string>(props.draft as string, bindings?.draft);

    return (
      <div className="rounded-md border">
        <header>{props.title}</header>

        {/* children IS the 'default' slot; slots holds the named ones only. */}
        <div>{children}</div>

        <input value={draft ?? ''} onChange={(e) => setDraft(e.target.value)} />

        {/* No-op when the element's \`on\` bound nothing to "press". */}
        <button onClick={() => emit('press')}>{props.label}</button>

        {slots?.actions && <footer>{slots.actions}</footer>}
      </div>
    );
  },
};`}</Code>

      <Facts
        rows={[
          { k: <code key="a">props</code>, v: 'Already resolved. Every $state / $cond / $template / directive is evaluated before your function runs.' },
          { k: <code key="b">children</code>, v: "The 'default' slot, pre-rendered. undefined when the element has no children." },
          { k: <code key="c">slots</code>, v: <>Every other slot the spec filled, by name. The default slot is not in here — it arrives as <code key="d">children</code>.</> },
          { k: <code key="e">emit(name)</code>, v: <>Fires whatever the element&rsquo;s <code key="f">on</code> field bound to that name. A no-op when unbound.</> },
          { k: <code key="g">on(name)</code>, v: <>Same event, plus <code key="h">bound</code> and <code key="i">shouldPreventDefault</code>, and an <code key="j">emit()</code> of its own.</> },
          { k: <code key="k">bindings</code>, v: <>Prop name → absolute state path, for <code key="l">$bindState</code> and <code key="m">$bindItem</code>. Pair with <code key="n">useBoundProp</code>.</> },
          { k: <code key="o">loading</code>, v: 'True while the spec is still streaming. Use it to render skeletons rather than half-filled controls.' },
          { k: 'hooks', v: <>Fine. Your component is an ordinary React component — <code key="p">useBoundProp</code>, <code key="q">useStateValue</code> and <code key="r">useFieldValidation</code> all work here (see <StepRef slug="hooks" />).</> },
        ]}
      />

      <Gotchas>
        <Gotcha>
          <strong>It is one argument.</strong> Destructuring <code>({'{ title }'})</code> gives you{' '}
          <code>undefined</code>; the prop you want is <code>props.title</code>. The signature is{' '}
          <code>(ctx) =&gt; ReactNode</code>, not <code>(props) =&gt; ReactNode</code>.
        </Gotcha>
        <Gotcha>
          <strong>Resolved is not validated.</strong> The catalog&rsquo;s Zod schema never runs at render time, so
          a prop can be any shape the model felt like emitting. Parse anything load-bearing — the{' '}
          <em>broken</em> template in the lab is exactly this bug.
        </Gotcha>
        <Gotcha>
          <strong>
            No binding path means <code>setValue</code> is a silent no-op.
          </strong>{' '}
          Change the spec&rsquo;s <code>{'{ "$bindState": "/form/draft" }'}</code> to a plain string and the input
          simply stops typing, with no error anywhere.
        </Gotcha>
        <Gotcha>
          <strong>Guard each component.</strong> One throw blanks the page. A boundary only catches its{' '}
          <em>children</em>, so render <code>{'<Impl {...props} />'}</code>, never <code>Impl(props)</code> — and
          note boundaries catch nothing during server rendering at all.
        </Gotcha>
        <Gotcha>
          <strong>Pass a <code>fallback</code> to the Renderer.</strong> Without one, an element whose type is
          missing from the registry renders nothing, and one hallucinated name silently deletes a branch.
        </Gotcha>
      </Gotchas>
    </StepPage>
  );
}
