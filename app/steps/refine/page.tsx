import { RefineDemo } from '@/components/playground/refine-demo';
import { Code, Facts, Gotcha, Gotchas, Takeaway } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';

export const dynamic = 'force-dynamic';

export default function Page() {
  const hasKey = Boolean(process.env.AI_GATEWAY_API_KEY);

  return (
    <StepPage
      slug="refine"
      lab={<RefineDemo hasKey={hasKey} />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        Pass <code>currentSpec</code> and <code>buildUserPrompt</code> turns a generation request into an{' '}
        <strong>edit</strong> request. Send the same edit in all three modes and compare the raw responses.
      </p>


      <Facts
        rows={[
          {
            k: 'patch',
            v: (
              <>
                RFC 6902, one op per line. <strong>Streams.</strong> Apply with{' '}
                <code>createSpecStreamCompiler</code>. Best for targeted changes.
              </>
            ),
          },
          {
            k: 'merge',
            v: (
              <>
                RFC 7396, one line flagged <code>__json_edit</code>. Does not stream. Apply with{' '}
                <code>deepMergeSpec</code>. Best for structural changes across several elements.
              </>
            ),
          },
          {
            k: 'diff',
            v: (
              <>
                A unified diff in a <code>```diff</code> fence. Does not stream.{' '}
                <strong>No applier ships</strong> — bring your own. Best for small text edits in long strings.
              </>
            ),
          },
        ]}
      />

      <Code lang="typescript">{`buildUserPrompt({ prompt: 'a revenue dashboard' })                    // fresh
buildUserPrompt({ prompt: 'add a metric', currentSpec, editModes: ['patch'] })  // edit
buildUserPrompt({ prompt: 'show my invoices', state: { invoices: rows } })      // with data

diffToPatches(before, after)   // -> RFC 6902 ops. Undo, history, audit.
deepMergeSpec(base, patch)     // -> RFC 7396. null deletes, arrays replace, objects recurse.`}</Code>

      <Takeaway>
        Always <code>diffToPatches(before, after)</code> and inspect the op list before accepting. A model given an
        edit request will sometimes rewrite elements nobody asked it to touch, and this turns &ldquo;it quietly
        reworded three labels&rdquo; into something you can see and reject.
      </Takeaway>

      <Gotchas>
        <Gotcha><strong><code>useUIStream</code> only understands patch mode.</strong> A merge line parses as JSON but
            has no <code>op</code>, so it applies as nothing. A diff fence does not parse at all. Either way: no
            error, no change, UI just sits there. For merge or diff, read the response yourself — the lab above
            does.</Gotcha>
        <Gotcha><strong>Cost grows with what the user has built.</strong> Every edit ships the entire current spec as
            context, on top of the ~4,500-token catalog prompt. Send only the subtree a request plausibly touches,
            and set a size past which you regenerate instead of editing.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
