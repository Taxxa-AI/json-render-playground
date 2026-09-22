import { BuildCatalogLab } from '@/components/lab/build-catalog-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="build-catalog"
      lab={<BuildCatalogLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        Adding a component is one object in one file. What makes it worth a lab is that the object lands in three
        places at once: it becomes a paragraph in the system prompt, a required key in your registry&rsquo;s type,
        and a name the validator will accept. Declare one on the left and watch all three move.
      </p>

      <Code lang="typescript" title="lib/demo/catalog.ts — the real thing">{`import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

export const demoComponents = {
  // …the other entries…

  Callout: {
    // Written for a reader who cannot read your source: the model.
    description:
      'A highlighted note. Use it to draw attention to one sentence, not a paragraph.',
    props: z.object({
      title: z.string(),
      body: z.string().nullable(),          // prefer nullable over optional
      tone: z.enum(['info', 'warning', 'danger']).nullable(),
    }),
    slots: ['default', 'actions'],          // 'default' === accepts children
    example: { title: 'Heads up', body: null, tone: 'info' },
  },
};

export const demoCatalog = defineCatalog(schema, {
  components: demoComponents,
  actions: demoActions,
});`}</Code>

      <Facts
        rows={[
          {
            k: <code key="a">props</code>,
            v: 'A Zod object. Serialised into the prompt as a TypeScript-looking signature, and inferred into your component props. Never used to validate props at render time.',
          },
          {
            k: <code key="b">slots</code>,
            v: (
              <>
                <code key="c">[&apos;default&apos;]</code> means it accepts children. Named slots appear in the
                prompt as <code key="d">[slots: actions]</code> and reach your component as{' '}
                <code key="e">slots.actions</code>.
              </>
            ),
          },
          {
            k: <code key="f">description</code>,
            v: 'The only reason a model reaches for one component over another. Write when to use it, not what it looks like.',
          },
          {
            k: <code key="g">example</code>,
            v: 'Inlined verbatim into the sample JSONL at the top of the prompt. Optional — the library generates one from the schema if you omit it.',
          },
          {
            k: 'what it costs',
            v: 'Roughly one line of prompt per component plus its prop signature. The lab prints the exact character and token delta.',
          },
          {
            k: 'the other two places',
            v: (
              <>
                <code key="h">defineRegistry</code> gains a required key (see <StepRef slug="build-component" />),
                and <code key="i">catalog.validate</code> starts accepting the name.
              </>
            ),
          },
        ]}
      />

      <Gotchas>
        <Gotcha>
          <strong>
            <code>.nullable()</code> and <code>.optional()</code> print identically.
          </strong>{' '}
          Both become <code>name?: string</code> in the prompt, so the model cannot tell them apart. Prefer{' '}
          <code>.nullable()</code> — structured output emits an explicit <code>null</code> more reliably than it
          omits a key.
        </Gotcha>
        <Gotcha>
          <strong>Declaring a name does not make it render.</strong> <code>catalog.validate</code> and{' '}
          <code>validateSpec</code> both pass while the element draws your fallback, because nothing joins catalog
          to registry at runtime — only TypeScript does, at build time.
        </Gotcha>
        <Gotcha>
          <strong>
            <code>jsonSchema()</code> drops your prop shapes as soon as there are two components.
          </strong>{' '}
          Per-element <code>props</code> collapses to{' '}
          <code>{'{ "type": "object", "additionalProperties": {} }'}</code>, because JSON Schema cannot say
          &ldquo;props depend on type&rdquo; here. Structured-output mode constrains component <em>names</em>; the
          prop vocabulary only ever reaches the model through <code>prompt()</code>.
        </Gotcha>
        <Gotcha>
          <strong>
            The default slot is <code>children</code>, not <code>slots.default</code>.
          </strong>{' '}
          A spec that writes <code>{'"slots": { "default": ["a"] }'}</code> gets a console warning and hands your
          component a slot it almost certainly ignores. Declaring no <code>slots</code> at all does not block
          children at runtime — it only removes them from the prompt, so no model emits any.
        </Gotcha>
        <Gotcha>
          <strong>Nothing re-validates props at runtime.</strong> The Zod schema feeds the prompt and TypeScript
          only. A model that emits the wrong type reaches your component untouched — see{' '}
          <StepRef slug="registry" />.
        </Gotcha>
      </Gotchas>
    </StepPage>
  );
}
