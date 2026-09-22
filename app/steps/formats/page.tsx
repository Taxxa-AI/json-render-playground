import { FormatLab } from '@/components/lab/format-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';

export default function Page() {
  return (
    <StepPage
      slug="formats"
      lab={<FormatLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        The flat map is right for patching and wrong for almost everything a human or a database hands you. Edit
        either input; watch the canonical spec fall out.
      </p>


      <Facts
        rows={[
          { k: <code key="a">nestedToFlat</code>, v: 'Core. A readable tree → flat map. Authoring, fixtures, prompt formats.' },
          { k: <code key="b">flatToTree</code>, v: <>React package (note the split). Rows with <code key="c">key</code>+<code key="d">parentKey</code> → flat map. Exactly a SQL table of UI elements.</> },
          { k: <code key="e">isNonEmptySpec</code>, v: 'Has a root and at least one element.' },
          { k: <code key="f">deepMergeSpec</code>, v: 'RFC 7396. null deletes, arrays replace, objects recurse.' },
          { k: <code key="g">diffToPatches</code>, v: 'RFC 6902 ops between two specs. Undo, history, audit.' },
          { k: <code key="h">compileSpecStream</code>, v: 'A whole JSONL string → spec, in one call.' },
        ]}
      />

      <Code lang="typescript" title="a spec format of your own">{`export const schema = defineSchema((s) => ({
  spec: s.object({
    root: s.string(),
    elements: s.record(s.object({
      type:  s.ref('catalog.components'),       // must name a catalog component
      props: s.propsOf('catalog.components'),   // typed from that component's Zod
      children: s.array(s.string()),
    })),
  }),
  catalog: s.object({
    components: s.map({ props: s.zod(), description: s.string() }),
    actions:    s.map({ description: s.string() }),
  }),
}), {
  promptTemplate: myPromptTemplate,   // you own the whole prompt
  builtInActions: [{ name: 'setState', description: '…' }],
});`}</Code>

      <Gotchas>
        <Gotcha><code>nestedToFlat</code> invents keys (<code>el-0</code>, <code>el-1</code>) that are{' '}
            <strong>not stable across edits</strong>. Fine for one-shot render; wrong for anything you will patch,
            because patches address elements by key.</Gotcha>
        <Gotcha><code>nestedToFlat</code> is in <code>@json-render/core</code>, <code>flatToTree</code> is in{' '}
            <code>@json-render/react</code>. Easy half hour to lose.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
