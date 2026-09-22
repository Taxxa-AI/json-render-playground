import type { Spec } from '@json-render/core';
import type { Quiz } from './types';

/**
 * AI — the streaming wire, and editing an existing spec.
 *
 * Verified with scratchpad/verify-checkpoints.ts (A1–A9) and
 * verify-checkpoints-2.ts (A8b–A12): `parseSpecStreamLine`,
 * `compileSpecStream`, `applySpecPatch`, `createMixedStreamParser`,
 * `buildUserPrompt`, `buildEditInstructions`, `catalog.prompt()`, plus
 * @json-render/react `useUIStream`'s own parseLine/applyPatch.
 */
export const aiQuiz: Quiz = {
  group: 'AI',
  slug: 'ai',
  intro: 'One patch per line, one spec per conversation, and everything that is silently dropped.',
  questions: [
    {
      kind: 'predict',
      id: 'a-jsonl',
      prompt: `Four lines arrive on the wire, in this order. What is on screen when the stream ends?

{"op":"add","path":"/root","value":"screen"}
{"op":"add","path":"/elements/screen","value":{"type":"Screen","props":{"title":"Q3","subtitle":null},"children":["m"]}}
{"op":"add","path":"/elements/m","value":{"type":"Metric","props":{"label":"Revenue","value":{"$state":"/revenue"},"delta":null,"tone":null},"children":[]}}
{"op":"add","path":"/state/revenue","value":"48,200"}`,
      // The spec below is exactly what compileSpecStream produces from those
      // four lines (A3 pattern; applySpecPatch mirrors /state into spec.state, A4).
      // The seed is passed separately BECAUSE the renderer ignores spec.state.
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: 'Q3', subtitle: null }, children: ['m'] },
          m: {
            type: 'Metric',
            props: { label: 'Revenue', value: { $state: '/revenue' }, delta: null, tone: null },
            children: [],
          },
        },
        state: { revenue: '48,200' },
      } as unknown as Spec,
      seed: { revenue: '€48,200' },
      options: [
        'A screen with one metric — each line is one RFC 6902 patch, applied in order',
        'Nothing — the root arrives before the element it names',
        'A screen with an empty metric, because /state patches are not applied',
        'Four separate specs, one per line',
      ],
      answer: 0,
      explain:
        'SpecStream is JSONL: one RFC 6902 operation per line, applied to an accumulating object. Order is a rendering nicety, not a requirement — a child that arrives before its parent simply sits in the map until something points at it, which is why "children are keys" and "streaming" are the same design decision. Look closely at the reveal: the fourth line put "48,200" in spec.state, and the metric shows the seed value instead. That is the mirror you have to write yourself.',
      step: 'streaming',
      ref: 'util-compilespecstream',
    },
    {
      kind: 'choice',
      id: 'a-state-mirror',
      prompt: 'A patch writes to /state/revenue. Which object changes — and does the UI update?',
      // Verified (A4): applySpecPatch writes into spec.state. The Renderer never
      // reads spec.state, so the store must be seeded separately.
      options: [
        'spec.state changes; the UI does not, until you mirror spec.state into the store',
        'The state store changes, and every bound element re-renders',
        'Both — spec.state and the store are kept in sync by the renderer',
        'Neither; /state is not a valid patch path',
      ],
      answer: 0,
      explain:
        'The patch lands on the spec, and the renderer does not read spec.state. So the canonical streaming integration is: apply patches to the spec, and on every change (or on completion) push spec.state into your store. Skip that one line and the generated UI renders as a perfect, empty shell.',
      step: 'streaming',
      ref: 'el-state',
    },
    {
      kind: 'choice',
      id: 'a-useuistream',
      prompt: 'Your model replies with a sentence of prose and then patches. What does useUIStream do with the sentence?',
      // Verified from useUIStream's parseLine: JSON.parse inside try/catch,
      // returns null on failure, and the caller skips nulls. Non-JSON is dropped.
      options: [
        'Drops it silently — every line that is not JSON is discarded',
        'Exposes it on a `text` field alongside the spec',
        'Treats it as a parse error and calls onError',
        'Buffers it and prepends it to the next patch',
      ],
      answer: 0,
      explain:
        'useUIStream is patch-only by design: each line is JSON.parsed in a try/catch and anything that fails is skipped. That also means a merge-patch or unified-diff reply is silently ignored — an edit that appears to succeed and changes nothing. For prose plus UI, use useChatUI or the mixed-stream parser.',
      step: 'generate',
      ref: 'hook-useuistream',
    },
    {
      kind: 'choice',
      id: 'a-mixed-parser',
      prompt: 'createMixedStreamParser receives the line `not json {`. Which callback fires?',
      // Verified (A5): ['TEXT "Sure!"', 'PATCH {...}', 'TEXT "not json {"'].
      options: [
        'onText — classification is per line, and anything parseSpecStreamLine rejects is text',
        'onPatch, with a partial patch object',
        'Neither — malformed lines are dropped',
        'onText, but only after flush()',
      ],
      answer: 0,
      explain:
        'The parser buffers chunks, splits on newlines, and classifies each complete line with parseSpecStreamLine: a valid patch goes to onPatch, everything else to onText. It is line-oriented, so you must call flush() at the end or the last unterminated line never arrives. For the AI SDK path, createJsonRenderTransform does the same job but prefers explicit ```spec fences.',
      step: 'chat',
      ref: 'util-createmixedstreamparser',
    },
    {
      kind: 'choice',
      id: 'a-data-part',
      prompt: 'SPEC_DATA_PART is "spec". What type string actually appears in the stream chunks?',
      // Verified (A6): ['spec', 'data-spec'].
      options: [
        '"data-spec" — the AI SDK prefixes data parts with "data-"',
        '"spec" — the constant is the wire format',
        '"json-render/spec"',
        'It varies; the transform picks a fresh id per stream',
      ],
      answer: 0,
      explain:
        'Register the part under SPEC_DATA_PART in your AppDataParts type, but filter message.parts on SPEC_DATA_PART_TYPE, which is "data-spec". The payload is a discriminated union of { type: "patch" }, { type: "flat" } and { type: "nested" }.',
      step: 'chat',
      ref: 'util-pipejsonrender',
    },
    {
      kind: 'choice',
      id: 'a-edit-modes',
      prompt: 'Which three edit modes can buildEditInstructions document?',
      // Verified (A10 + EditMode type): "patch" | "merge" | "diff".
      options: [
        'patch (RFC 6902), merge (RFC 7396), diff (unified)',
        'patch, replace, regenerate',
        'append, merge, overwrite',
        'json, yaml, jsonl',
      ],
      answer: 0,
      explain:
        'Default is ["patch"] alone. Enable more than one and the prompt tells the model to choose per edit — merge is compact for changing a few props, diff is good for large text edits, patch is precise and streamable. Whatever you enable, your client must actually apply it: useUIStream understands patch only.',
      step: 'refine',
      ref: 'util-builduserprompt',
    },
    {
      kind: 'choice',
      id: 'a-refine-cost',
      prompt: 'buildUserPrompt is called with a currentSpec. What goes into the request?',
      // Verified (A8b): the prompt opens with "CURRENT UI STATE (already loaded,
      // DO NOT recreate existing elements)" followed by the serialized spec.
      options: [
        'The whole serialised spec, then the user request, then "output only the patch lines"',
        'A hash of the spec, so the server can look it up',
        'Only the elements the user mentioned',
        'Nothing extra — refinement reuses the conversation history',
      ],
      answer: 0,
      explain:
        'Every refinement ships the entire current spec as context. So the cost of an edit grows with what the user has already built, which is backwards from what they expect — the tenth small tweak is the most expensive request of the session. Budget for it, or compile specs instead of refining them.',
      step: 'refine',
      ref: 'util-builduserprompt',
    },
    {
      kind: 'choice',
      id: 'a-usage-line',
      prompt: 'A line reads {"__meta":"usage","promptTokens":4200,…}. How does useUIStream treat it?',
      // Verified from useUIStream's parseLine: a __meta === 'usage' line sets
      // `usage` and is never applied as a patch or pushed to rawLines.
      options: [
        'As metadata — it populates `usage` and is not applied as a patch',
        'As a patch, writing __meta into the spec',
        'As prose, and drops it',
        'It throws, because __meta is not a valid op',
      ],
      answer: 0,
      explain:
        'The hook special-cases one sentinel line so a route can report token usage on the same wire as the patches. It is not part of RFC 6902 and it never reaches the spec — it also never appears in rawLines, so a byte-level view of the stream will not show it.',
      step: 'generate',
      ref: 'hook-useuistream',
    },
    {
      kind: 'choice',
      id: 'a-compiler',
      prompt: 'compileSpecStream vs createSpecStreamCompiler — what is the difference?',
      // Verified (A3) and from the SpecStreamCompiler interface: push(chunk)
      // returns { result, newPatches }; also getResult, getPatches, reset.
      options: [
        'compileSpecStream takes the whole stream at once; the compiler accepts chunks and reports which patches were new',
        'compileSpecStream is for JSON, the compiler for YAML',
        'The compiler validates against the catalog; compileSpecStream does not',
        'compileSpecStream is the deprecated form of the compiler',
      ],
      answer: 0,
      explain:
        'compileSpecStream is the one-shot version for a complete string — perfect for tests and fixtures. createSpecStreamCompiler is stateful: push a chunk, get back the current result plus the patches that just applied, so you can re-render only when something actually changed. It also handles a chunk boundary landing mid-line.',
      step: 'streaming',
      ref: 'util-createspecstreamcompiler',
    },
    {
      kind: 'choice',
      id: 'a-prompt-cost',
      prompt: 'The playground catalog has 13 components. Roughly how big is catalog.prompt(), and how often is it sent?',
      // Verified (F7b): demoCatalog.prompt().length === 19,422 characters,
      // which is roughly 4.5k tokens. It is the system prompt: every request.
      options: [
        'About 19k characters — roughly 4.5k tokens, on every single request',
        'About 19k characters, sent once and cached by the SDK',
        'A few hundred tokens; only component names are sent',
        'It depends on the user prompt — the catalog is filtered per request',
      ],
      answer: 0,
      explain:
        'It is the system prompt, so it is paid on every request. Thirteen toy components already cost around 4.5k tokens; a real design system lands between 15k and 30k. The two levers are provider-side prefix caching, and building a narrower catalog per request from the components that screen could plausibly need.',
      step: 'generate',
      ref: 'util-catalogprompt',
    },
  ],
};
