import { gateway } from '@ai-sdk/gateway';
import { streamText } from 'ai';
import { demoCatalog } from '@/lib/demo/catalog';

export const maxDuration = 60;

const MODEL = process.env.PLAYGROUND_MODEL ?? 'anthropic/claude-sonnet-4.5';

/**
 * Chat + generative UI.
 *
 * `useChatUI` POSTs `{ messages: [{ role, content }] }` and reads a plain text
 * stream, which it runs through `createMixedStreamParser` — prose lines become
 * message text, JSONL lines become spec patches.
 *
 * The only thing this route adds over /api/generate is the extra instruction
 * telling the model it MAY answer in prose, and that a UI is optional. Without
 * that, the catalog prompt's "output ONLY JSONL" rule wins and you get a
 * silent assistant.
 */
export async function POST(req: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({ error: 'AI_GATEWAY_API_KEY is not set.' }, { status: 503 });
  }

  const { messages } = (await req.json()) as { messages?: Array<{ role: string; content: string }> };
  if (!messages?.length) return Response.json({ error: 'No messages.' }, { status: 400 });

  const system = `${demoCatalog.prompt({
    customRules: [
      'Prefer Metric for numeric KPIs and Card to group related content.',
      'Keep any generated UI under 15 elements.',
    ],
  })}

CHAT MODE — this overrides the "output ONLY JSONL" rule above:
You are in a conversation. You may write ordinary prose on its own lines.
When a UI would help, emit JSONL patch lines exactly as described above, on their own lines.
Prose lines must NEVER begin with "{".
A UI is optional: for a greeting or a clarifying question, answer in prose alone and emit no patches.
Write a sentence introducing the UI before the patches, and a short follow-up after them.`;

  let providerError: unknown = null;
  const result = streamText({
    model: gateway(MODEL),
    system,
    messages: messages.map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    })),
    temperature: 0.4,
    onError: ({ error }) => {
      providerError = error;
    },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of result.textStream) controller.enqueue(encoder.encode(delta));
      } catch (e) {
        const err = providerError ?? e;
        const msg = (err instanceof Error ? err.message : String(err))
          .replace(/\[[0-9;]*m/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        // Plain prose, so the mixed parser shows it to the user as text.
        controller.enqueue(encoder.encode(`\n[stream error] ${msg}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
