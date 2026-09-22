import { gateway } from '@ai-sdk/gateway';
import { buildUserPrompt, isNonEmptySpec, type Spec } from '@json-render/core';
import { createTextStreamResponse, streamText, toTextStream } from 'ai';
import { catalog } from '../../../lib/catalog';
import { directives } from '../../../lib/directives';

/** Generation is slow. Raise the ceiling or the platform kills the stream. */
export const maxDuration = 60;

/**
 * THE GENERATE ROUTE.
 *
 * `useUIStream` POSTs `{ prompt, context, currentSpec }` and reads back a
 * PLAIN TEXT stream of JSONL patch lines. Not SSE, not an AI SDK UI message
 * stream. So the whole job is: system prompt from the catalog, user prompt
 * from the builder, pipe the model's text through untouched.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    prompt?: string;
    currentSpec?: Spec;
    context?: { state?: Record<string, unknown> };
  };

  // Never trust the client with the length of a prompt you will pay for.
  const prompt = (body.prompt ?? '').trim();
  if (!prompt) return Response.json({ error: 'Empty prompt.' }, { status: 400 });

  /**
   * The system prompt is GENERATED from the catalog: every component, every
   * Zod field, every description, plus the directives you pass. Write the
   * catalog well and this needs almost nothing added.
   */
  const system = catalog.prompt({
    directives,
    customRules: [
      'Every spec must have exactly one Page element, and it must be the root.',
      'Use Badge only for an invoice status: paid, unpaid or overdue.',
      'Format every money amount with $money over integer cents. Never inline a formatted string.',
      'Keep the tree under 25 elements.',
    ],
  });

  // `buildUserPrompt` wraps the request. Passing a non-empty `currentSpec`
  // turns it into an EDIT: the model is told to emit patches against it
  // instead of a whole new tree.
  const refining = body.currentSpec && isNonEmptySpec(body.currentSpec);
  const user = buildUserPrompt({
    prompt,
    maxPromptLength: 2000,
    ...(refining ? { currentSpec: body.currentSpec, editModes: ['patch' as const] } : {}),
    ...(body.context?.state ? { state: body.context.state } : {}),
  });

  const result = streamText({
    model: gateway(process.env.GENERATE_MODEL ?? 'anthropic/claude-sonnet-4.5'),
    system,
    prompt: user,
    // Low, not zero. Spec generation is structure, not prose.
    temperature: 0.3,
  });

  // `text/plain`, and no buffering: the hook applies each patch as its line
  // arrives, so a proxy that buffers turns streaming UI back into a spinner.
  // (`result.toTextStreamResponse()` is deprecated in this AI SDK version.)
  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
    headers: {
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
