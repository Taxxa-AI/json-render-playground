import { RegistryLab } from '@/components/lab/registry-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="registry"
      lab={<RegistryLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        The catalog says what <em>may</em> exist. The registry says what those names <em>render as</em>. A name is
        only useful when it is in both, and the two ways to get that wrong fail very differently.
      </p>

      <Code lang="tsx" title="defineRegistry returns three things">{`export const { registry, handlers, executeAction } = defineRegistry(catalog, {
  components: {
    Card:   ({ props, children, slots }) => <Card>{children}{slots?.footer}</Card>,
    Button: ({ props, emit }) => <Button onClick={() => emit('press')}>{props.label}</Button>,
  },
  // REQUIRED when the catalog declares actions. Must be async: a binding can
  // declare onSuccess/onError, so the dispatcher awaits yours.
  actions: { submit: async () => save() },
});

// registry      -> what <Renderer registry={…}> looks element.type up in
// handlers      -> ActionProvider-compatible handlers built from \`actions\`
// executeAction -> fire an action imperatively, outside the React tree`}</Code>

      <Facts
        rows={[
          {
            k: 'in catalog + registry',
            v: 'Renders. The model knows about it and you implemented it.',
          },
          {
            k: 'in catalog only',
            v: 'TypeScript refuses to compile. If you defeat that, the model emits it and the renderer shows your fallback.',
          },
          {
            k: 'in registry only',
            v: 'Renders fine if you hand-write the spec — but it is absent from catalog.prompt(), so no model will ever emit it. This is how you keep internal components out of reach of generation.',
          },
          {
            k: 'the registry itself',
            v: 'A plain object: name → render function. Nothing clever. You can filter it per user, per tenant, per feature flag.',
          },
        ]}
      />

      <h3>What a component receives</h3>
      <p>
        Inside an implementation, this is the object you are handed — printed live by the{' '}
        <strong>component context</strong> tab of the lab, by a component whose only job is to print its own
        context.
      </p>

      <Facts
        rows={[
          { k: 'props', v: 'Already resolved. Every $state / $cond / $template is evaluated before your function runs.' },
          { k: 'children', v: 'The default slot, pre-rendered.' },
          { k: 'slots', v: 'Every other declared slot, by name. Use children for the default one — a spec that writes slots.default does deliver it there, with a console warning, which is how content ends up rendered in the wrong place or not at all.' },
          { k: 'emit(name)', v: 'Fires an event named in element.on. No-op when unbound.' },
          { k: 'on(name)', v: 'Same, plus bound and shouldPreventDefault.' },
          { k: 'bindings', v: 'Prop name → state path, for $bindState/$bindItem. Pair with useBoundProp.' },
          { k: 'loading', v: 'True while a spec is still streaming.' },
        ]}
      />

      <Gotchas>
        <Gotcha>
          <strong>Props are not validated against the catalog&rsquo;s Zod schema at runtime.</strong> Those schemas
          feed the prompt and TypeScript only — see the <code>catalog.validate</code> view on{' '}
          <StepRef slug="catalog" />. Your component
          can receive any shape at all, so parse anything that matters.
        </Gotcha>
        <Gotcha>
          <strong>Pass a <code>fallback</code>.</strong> Without one, an unknown <code>type</code> renders nothing —
          one hallucinated component name silently deletes a branch.
        </Gotcha>
        <Gotcha>
          <strong>Guard each component.</strong> One throw blanks the page. An error boundary only catches its{' '}
          <em>children</em>, so render <code>{'<Impl {...props} />'}</code>, never <code>Impl(props)</code> — and
          note boundaries do not catch during SSR at all.
        </Gotcha>
      </Gotchas>
    </StepPage>
  );
}
