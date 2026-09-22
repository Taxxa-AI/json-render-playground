import type { Chapter } from '../types';

export const ch11: Chapter = {
  slug: 'generate',
  n: 11,
  title: 'The generate route',
  goal: 'Let a model write the spec: a route that streams JSONL patches and a client that applies them.',
  minutes: 16,
  why: [
    'The wire format is JSONL: one RFC 6902 JSON Patch per line, applied in order to build up the spec. `{"op":"add","path":"/root","value":"page"}` first, then elements and state interleaved so the page fills in as it streams. Not SSE. Not an AI SDK UI message stream. Plain text.',
    'The route is short because the catalog does the work. `catalog.prompt()` serialises every component, prop, description and example into the system prompt; `buildUserPrompt` wraps the request and, when you pass a `currentSpec`, turns it into an edit. Your own contribution is `customRules` — the handful of domain constraints the schema cannot express.',
    'On the client `useUIStream` owns the transport: POST, read, parse each line, apply the patch, hand you a growing `spec`. You render it with the same `<Renderer>` and the same registry as the hand-written one.',
    'The thing everyone misses is the same thing as chapter four, arriving from a new direction: the renderer never reads `spec.state`. The model emits `/state` patches, the hook collects them onto the spec object, and unless you copy them into your store every `$state` in the generated tree reads undefined.',
  ],
  files: [
    { path: 'app/api/generate/route.ts', lang: 'ts', notes: [] },
    { path: 'app/generate/page.tsx', lang: 'tsx', notes: [] },
  ],
  mistakes: [
    {
      wrong: 'return result.toUIMessageStreamResponse();',
      lang: 'ts',
      why: 'That is the AI SDK chat protocol — SSE with typed parts. `useUIStream` reads raw text and parses lines; it will see none of it. Return a plain text stream.',
    },
    {
      wrong: '<Renderer spec={spec} registry={registry} />   // and nothing copies spec.state',
      lang: 'tsx',
      why: 'The generated tree renders with every `$state` blank and no error anywhere. Mirror `spec.state` into the store in an effect.',
    },
    {
      wrong: 'const system = catalog.prompt();   // directives registered on the provider only',
      lang: 'ts',
      why: 'The model is never told `$money` exists, so it emits pre-formatted strings instead. Pass the same array to both: `catalog.prompt({ directives })` and `<JSONUIProvider directives={directives}>`.',
    },
    {
      wrong: "headers: { 'Content-Type': 'application/json' }",
      lang: 'ts',
      why: 'The body is JSONL, not JSON — it never parses as a single document. And without `X-Accel-Buffering: no` a proxy may hold the whole response, turning progressive rendering back into a spinner.',
    },
    {
      wrong: 'const user = buildUserPrompt({ prompt, currentSpec: spec });   // spec is { root: "", elements: {} }',
      lang: 'ts',
      why: 'An empty spec still triggers edit mode, so the model is asked to patch a document with nothing in it. Guard with `isNonEmptySpec` before passing it.',
    },
  ],
  tryIt: {
    instruction: 'The preview replays a canned JSONL stream through `createSpecStreamCompiler`, one line at a time, so it works with no API key. Step through it and watch the tree appear in patch order. With `AI_GATEWAY_API_KEY` set, the real route does exactly this over the network.',
    check: 'You can name what each patch line did to the spec before the next one lands.',
  },
  refs: ['util-createspecstreamcompiler', 'hook-useuistream', 'util-builduserprompt'],
  steps: ['streaming', 'generate'],
};
