import { gateway } from '@ai-sdk/gateway';
import { buildUserPrompt, isNonEmptySpec, type Spec } from '@json-render/core';
import { streamText } from 'ai';
import { demoCatalog } from '@/lib/demo/catalog';

export const maxDuration = 60;

const MODEL = process.env.PLAYGROUND_MODEL ?? 'anthropic/claude-sonnet-4.5';

/**
 * The generation endpoint.
 *
 * `useUIStream` from @json-render/react POSTs `{ prompt, context, currentSpec }`
 * and reads back a PLAIN TEXT stream of JSONL patch lines — one JSON object per
 * line. It is not an AI SDK UI message stream, and it is not SSE. The only
 * special line is a trailing `{"__meta":"usage", …}`, which the hook pulls out
 * to report token counts.
 *
 * So the whole integration is: system prompt from the catalog, user prompt from
 * the builder, pipe the model's text through untouched.
 */
export async function POST(req: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      { error: 'AI_GATEWAY_API_KEY is not set. Copy .env.example to .env and add a Vercel AI Gateway key.' },
      { status: 503 },
    );
  }

  const body = (await req.json()) as {
    prompt?: string;
    currentSpec?: Spec;
    context?: { editModes?: Array<'patch' | 'merge' | 'diff'>; state?: Record<string, unknown> };
  };

  const prompt = (body.prompt ?? '').trim();
  if (!prompt) return Response.json({ error: 'Empty prompt.' }, { status: 400 });

  // 1. THE SYSTEM PROMPT. Generated from the catalog — this is step 2.
  //    `customRules` is where domain rules go. Note that we explicitly cancel
  //    the stock prompt's instruction to invent sample data.
  const system = demoCatalog.prompt({
    customRules: [
      'Prefer Metric for any numeric KPI, and Card to group related content.',
      'Every spec must have exactly one Screen as its root element.',
      'Keep the tree under 25 elements unless the request clearly needs more.',
      'Use only the tones neutral, info, success, warning and danger.',
    ],
  });

  // 2. THE USER PROMPT. `buildUserPrompt` wraps the raw request, and — when a
  //    non-empty spec is passed — turns this into an EDIT request with
  //    instructions for the chosen edit modes. That is step 12.
  const refining = body.currentSpec && isNonEmptySpec(body.currentSpec);
  const user = buildUserPrompt({
    prompt,
    ...(refining ? { currentSpec: body.currentSpec } : {}),
    ...(refining ? { editModes: body.context?.editModes ?? ['patch'] } : {}),
    ...(body.context?.state ? { state: body.context.state } : {}),
  });

  // `streamText` surfaces provider failures through onError as well as by
  // throwing from textStream, and the thrown one is usually the unhelpful
  // wrapper ("No output generated"). Capture the real cause here.
  let providerError: unknown = null;

  const result = streamText({
    model: gateway(MODEL),
    system,
    prompt: user,
    temperature: 0.3,
    onError: ({ error }) => {
      providerError = error;
    },
  });

  // 3. THE RESPONSE. Raw text through, plus a usage line at the end.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of result.textStream) {
          controller.enqueue(encoder.encode(delta));
        }
        const usage = await result.usage;
        controller.enqueue(
          encoder.encode(
            `\n${JSON.stringify({
              __meta: 'usage',
              promptTokens: usage.inputTokens ?? 0,
              completionTokens: usage.outputTokens ?? 0,
              totalTokens: usage.totalTokens ?? 0,
            })}\n`,
          ),
        );
      } catch (e) {
        // A mid-stream failure cannot become an HTTP error — the headers went
        // out with the first byte. So the failure has to travel IN the stream.
        // `__meta: "error"` is not part of the protocol; it is a convention
        // this playground adds so the client can tell "finished" from "died",
        // which is exactly the terminal marker step 11 argues you need.
        controller.enqueue(
          encoder.encode(`\n${JSON.stringify({ __meta: 'error', message: describe(providerError ?? e) })}\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}

/** Unwrap the AI SDK's error wrappers down to something a human can act on. */
function describe(error: unknown): string {
  const parts: string[] = [];
  let cur: unknown = error;
  for (let depth = 0; cur && depth < 4; depth++) {
    const raw = cur instanceof Error ? cur.message : typeof cur === 'string' ? cur : null;
    // Gateway errors arrive with ANSI colour codes, which are noise in a browser.
    const msg = raw?.replace(/\u001b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim() || null;
    if (msg && !parts.includes(msg)) parts.push(msg);
    cur = cur instanceof Error ? (cur.cause as unknown) : null;
  }
  return parts.join(' — ') || 'Unknown provider error.';
}
