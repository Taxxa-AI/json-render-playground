import { GenerateDemo } from '@/components/playground/generate-demo';
import { Code, Facts, Gotcha, Gotchas, Takeaway } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export const dynamic = 'force-dynamic';

export default function Page() {
  const hasKey = Boolean(process.env.AI_GATEWAY_API_KEY);
  const model = process.env.PLAYGROUND_MODEL ?? 'anthropic/claude-sonnet-4.5';

  return (
    <StepPage
      slug="generate"
      lab={<GenerateDemo hasKey={hasKey} />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        Catalog prompt in, JSONL text out, patches applied as they land. No tool call, no structured output, no JSON
        schema.
      </p>


      <Code lang="typescript" title="app/api/generate/route.ts">{`const result = streamText({
  model: gateway('${model}'),
  system: demoCatalog.prompt({ customRules: ['Never invent monetary figures.'] }),
  prompt: buildUserPrompt({ prompt, currentSpec, state: context?.state }),
  temperature: 0.3,
});

// useUIStream reads a PLAIN TEXT stream of JSONL. Not SSE, not a UI message
// stream. Pipe result.textStream through; append one usage line at the end.
return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });`}</Code>

      <Code lang="tsx" title="the client">{`const { spec, isStreaming, error, usage, rawLines, send, clear } =
  useUIStream({ api: '/api/generate' });

await send('a dashboard for an accounting firm');
<Renderer spec={spec} registry={registry} loading={isStreaming} fallback={Unknown} />`}</Code>

      <Facts
        rows={[
          { k: 'wire format', v: 'text/plain, one JSON Patch per line' },
          { k: 'request body', v: <code key="a">{'{ prompt, context, currentSpec }'}</code> },
          { k: 'usage line', v: <code key="b">{'{"__meta":"usage","promptTokens":n,…}'}</code> },
          { k: 'bad lines', v: 'skipped by the parser — a truncated stream is a smaller UI, not a crash' },
          { k: 'why not streamObject', v: 'you cannot render until the object parses, and one bad token invalidates everything' },
        ]}
      />

      <Takeaway>
        Line-delimited patches trade schema enforcement for streaming granularity. Nothing validates the output —
        which is why <code>validateSpec</code> and <code>autoFixSpec</code> exist, and why <StepRef slug="repair" /> matters before
        you render anything a user will act on.
      </Takeaway>

      <Gotchas>
        <Gotcha><strong>Errors after the first byte cannot be HTTP errors.</strong> The status line is already sent, so
            the failure has to travel in the stream. This route emits{' '}
            <code>{'{"__meta":"error"}'}</code> — highlighted red in the wire tab. Without a terminal marker the
            client cannot tell &ldquo;finished&rdquo; from &ldquo;died&rdquo;.</Gotcha>
        <Gotcha><strong>The stock prompt tells the model to invent sample data.</strong> Wrong whenever the data is
            yours. Cancel it in <code>customRules</code> and pass real values via{' '}
            <code>buildUserPrompt({'{ state }'})</code>.</Gotcha>
        <Gotcha><strong>Nothing bounds the output.</strong> Cap element count, output tokens and wall-clock, and
            rate-limit per user — a generation request costs far more than any other route you have.</Gotcha>
        <Gotcha><strong>Cache the system prompt.</strong> It is a stable ~4,500-token prefix on every single request.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
