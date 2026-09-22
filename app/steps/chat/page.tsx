import { ChatStepLab } from '@/components/lab/chat-step-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';

export const dynamic = 'force-dynamic';

export default function Page() {
  const hasKey = Boolean(process.env.AI_GATEWAY_API_KEY);

  return (
    <StepPage
      slug="chat"
      lab={<ChatStepLab hasKey={hasKey} />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>One response, prose and patches interleaved. Run the parser on a canned response first — no key needed.</p>


      <h3>A full chat loop</h3>

      <Code lang="typescript" title="server: two options">{`// A — plain text stream. What useChatUI expects.
//     POST { messages } -> text/plain, prose and JSONL interleaved.
return new Response(result.textStream, { headers: { 'Content-Type': 'text/plain' } });

// B — AI SDK UI message stream, for useChat and persisted messages.
const stream = createUIMessageStream({
  execute: async ({ writer }) => { writer.merge(pipeJsonRender(result.toUIMessageStream())); },
});
return createUIMessageStreamResponse({ stream });`}</Code>

      <Code lang="tsx" title="client">{`// With B, rebuild from message.parts:
const { spec, text, hasSpec } = useJsonRenderMessage(message.parts);

// Lower level: buildSpecFromParts(parts), getTextFromParts(parts).
// With A: useChatUI({ api }) manages the whole conversation.`}</Code>

      <Facts
        rows={[
          {
            k: <code>createMixedStreamParser</code>,
            v: (
              <>
                Client-side. <code>onText</code> / <code>onPatch</code> per line. Buffers partial lines.
              </>
            ),
          },
          {
            k: <code>pipeJsonRender</code>,
            v: (
              <>
                Server-side. Prefers <code>```spec</code> fences, falls back to the brace heuristic, emits{' '}
                <code>data-spec</code> parts.
              </>
            ),
          },
          {
            k: <code>useJsonRenderMessage</code>,
            v: 'Memoised on array length + last-element identity. Mid-array edits may not recompute.',
          },
        ]}
      />

      <Gotchas>
        <Gotcha><strong>The catalog prompt ends with &ldquo;output ONLY JSONL, no markdown&rdquo;.</strong> A chat route
            must explicitly override that and say prose lines may never begin with <code>{'{'}</code>. Skip it and
            every greeting comes back as a dashboard.</Gotcha>
        <Gotcha><strong>Give each message its own store.</strong> Two generated UIs in one conversation will both bind
            to <code>/form/email</code> and share a value. Nothing isolates them for you.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
