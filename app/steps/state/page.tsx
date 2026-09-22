import { StateLab } from '@/components/lab/state-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';

export default function Page() {
  return (
    <StepPage
      slug="state"
      lab={<StateLab />}
      // No `concepts` strip: this lab is staged, and each stage opens the
      // concept it introduces in place (components/lab/stage-rail.tsx).
    >
      <p>
        One state model per tree, addressed by JSON Pointer. The lab walks five stages; each one loads the whole spec
        as it stands at that point, so you can wander off and still land on your feet.
      </p>


      <Facts
        rows={[
          { k: <code key="a">{'{"$state": "/p"}'}</code>, v: 'One-way read. The prop reflects the value; writing is impossible.' },
          { k: <code key="b">{'{"$bindState": "/p"}'}</code>, v: 'Two-way. Same value, plus the path handed to the component so it can write back.' },
          { k: 'where it goes', v: <>On the natural value prop — <code key="c">value</code>, <code key="d">checked</code>, <code key="e">pressed</code>. There is no <code key="f">statePath</code> prop.</> },
          { k: 'paths', v: <>RFC 6901. <code key="g">/invoices/0/amount</code>, never <code key="h">invoices[0].amount</code>.</> },
        ]}
      />

      <Code lang="tsx" title="the component side">{`// The renderer splits a $bindState prop in two:
//   props.value    -> the resolved VALUE     ("Ada")
//   bindings.value -> the PATH it came from  ("/user/first")

const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);`}</Code>

      <Gotchas>
        <Gotcha>
              A control bound to a <em>literal</em> is silently read-only — <code>bindings.value</code> is undefined
              and <code>setValue</code> is a no-op. This is the number-one cause of &ldquo;my input will not
              type&rdquo;.
        </Gotcha>
        <Gotcha>
              Pointers are not JavaScript. <code>/todos/length</code> looks up a key named <code>length</code> and
              resolves to <code>undefined</code>. No arithmetic, no method calls — <code>$computed</code> is the
              escape.
        </Gotcha>
        <Gotcha>
              Nothing declares the state shape. A typo'd path is not an error, it silently creates a new branch.
              Validate with Zod at the boundary.
        </Gotcha>
        <Gotcha>
              <code>&lt;Renderer&gt;</code> does not seed from <code>spec.state</code>. You do.
        </Gotcha>
      </Gotchas>
    </StepPage>
  );
}
