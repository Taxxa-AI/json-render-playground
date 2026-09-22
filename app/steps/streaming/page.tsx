import { StreamingLab } from '@/components/lab/streaming-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="streaming"
      lab={<StreamingLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        json-render streams <strong>patches</strong>, not JSON. One RFC 6902 op per line. Use{' '}
        <strong>Step</strong>, not Play.
      </p>


      <p>
        Patch 7 adds a Card whose <code>children</code> name an element that does not exist yet — it completes on
        patch 8. Patches 13–16 fill a state array one item at a time. The last patch is a <code>replace</code>: the
        model changing its mind.
      </p>

      <h3>Now write your own</h3>

      <Code lang="typescript" title="the API">{`const compiler = createSpecStreamCompiler<Spec>();   // optional initial spec

for await (const chunk of stream) {
  const { result, newPatches } = compiler.push(chunk);  // chunk, not line — it buffers
  if (newPatches.length) setSpec({ ...result });         // NEW reference, or React skips
}

// Mirror /state patches into your live store. REQUIRED — the renderer never
// reads spec.state, so a streamed repeat renders zero rows without this.
if (patch.path.startsWith('/state/')) {
  store.set(patch.path.slice('/state'.length), patch.value);
}`}</Code>

      <Facts
        rows={[
          { k: 'why flat wins', v: 'Every element has a stable address, so one line adds one element and disturbs nothing. No partial JSON parsing, ever.' },
          { k: 'truncation', v: 'Every line is independently valid. A cut stream is a smaller UI, not a corrupt one.' },
          { k: 'also available', v: <><code key="a">compileSpecStream</code>, <code key="b">parseSpecStreamLine</code> (null for non-patches), <code key="c">applySpecStreamPatch</code>, <code key="d">createMixedStreamParser</code> (<StepRef slug="chat" short />).</> },
        ]}
      />

      <Gotchas>
        <Gotcha>
              The compiler writes <code>/state/*</code> into <code>spec.state</code>, which the renderer still
              ignores. Six lines of mirroring, required by every streaming integration, absent from the quick-start.
        </Gotcha>
        <Gotcha>
              A half-rendered UI is interactive. A button is clickable before its handler is described. Use the{' '}
              <code>loading</code> prop to disable controls until the stream closes.
        </Gotcha>
      </Gotchas>
    </StepPage>
  );
}
