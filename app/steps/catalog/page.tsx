import { SchemaLab } from '@/components/lab/schema-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';

export default function Page() {
  return (
    <StepPage
      slug="catalog"
      lab={<SchemaLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        A catalog declares, per component, <strong>which props a node of that type may carry in the JSON tree</strong>.
        That single declaration is the source of three separate things.
      </p>

      <h3>Consequence 1 — the AI prompt</h3>
      <p>
        <code>catalog.prompt()</code> walks those same Zod schemas and descriptions. The{' '}
        <strong>generated prompt</strong> view in the lab is the live output, with the token cost of every
        component broken out.
      </p>


      <Code lang="typescript" title="lib/demo/catalog.ts">{`export const catalog = defineCatalog(schema, {
  components: {
    Metric: {
      description: 'A single big number with a caption. Use for KPIs.',  // ← the AI's only doc
      props: z.object({
        label: z.string(),
        value: z.string(),
        delta: z.string().nullable(),        // prefer .nullable() over .optional()
        tone:  z.enum(['neutral','info','success','warning','danger']).nullable(),
      }),
      slots: [],                             // no children
      example: { label: 'Revenue', value: '€48,200', delta: '+12%', tone: 'success' },
    },
    Card: { /* … */ slots: ['default', 'footer'] },   // children + one named slot
  },
  actions: {
    notify: { description: 'Show a toast.', params: z.object({ message: z.string() }) },
  },
});

catalog.prompt({ customRules: ['Never invent monetary figures.'] });`}</Code>

      <Facts
        rows={[
          { k: 'compile time', v: <><code key="a">defineRegistry</code> type-checks your components against it. Add an entry without implementing it and the build fails.</> },
          { k: 'run time', v: <><code key="b">catalog.prompt()</code> walks the same Zod schemas and emits the system prompt.</> },
          { k: <code key="c">description</code>, v: 'Not a comment. The only documentation a model will ever get, and the highest-leverage string in the codebase.' },
          { k: <code key="d">.nullable()</code>, v: 'Prefer over .optional(). Providers emit explicit null more happily than omitting a key, and it survives a JSON round-trip.' },
          { k: <code key="e">example</code>, v: 'Used verbatim in the prompt’s worked examples. Auto-generated from the Zod schema if omitted.' },
          { k: <code key="f">slots</code>, v: <><code key="g">['default']</code> = accepts children. Extra names become the <code key="h">slots</code> map.</> },
        ]}
      />

      <h3>The catalog is three things, not one</h3>
      <Facts
        rows={[
          { k: 'catalog.prompt()', v: 'Runtime. The system prompt the model sees — the lab above.' },
          { k: 'defineRegistry(catalog, …)', v: 'Compile time. Types your components against each Zod props schema. Add an entry without implementing it and the build fails.' },
          { k: 'catalog.validate(spec)', v: 'Runtime. Checks a spec against the generated schema. Catches unknown component names and missing children arrays — and, surprisingly, neither prop types nor action names.' },
          { k: 'catalog.jsonSchema()', v: 'The same schema as JSON Schema, if you want provider-side structured output instead of JSONL.' },
        ]}
      />

      <Gotchas>
        <Gotcha>The prompt is prepended to <strong>every</strong> request. 13 components ≈ 4,500 tokens, of which ~3,000
            is fixed scaffolding. A real design system lands at 15k–30k. Cache the prefix.</Gotcha>
        <Gotcha>For a large catalog, build a <em>narrower</em> one per request. A catalog is a plain object; nothing
            says you must send all of it.</Gotcha>
        <Gotcha>The stock prompt instructs the model to invent &ldquo;realistic sample data&rdquo; — wrong whenever the
            data is yours. Cancel it in <code>customRules</code>.</Gotcha>
        <Gotcha>Changing a description changes model behaviour globally and silently. Review these like a public API.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
