'use client';

import { useChatLab } from './chat-lab';
import { useMixedStreamLab } from './mixed-stream-lab';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist } from '@/lib/labs/types';

/**
 * Two things this step teaches, each with its own run of stages: the offline
 * parser, which needs no key, and then the live chat loop.
 *
 * A stage belongs to exactly one of them and scopes the lab to it, so the
 * parser is never on screen while you are reading about per-message stores.
 */
const PARSER_STAGES = [
  {
    id: 'parse-run',
    title: 'Prose and patches, mixed',
    when:
      'Mix the two when the assistant has to talk and draw in the same turn. If every reply is UI, stay on the pure JSONL route and `useUIStream` — mixing costs you the catalog prompt rule that says to output ONLY JSONL, and if you forget to override it every greeting comes back as a dashboard.',
    concept: 'mixed-stream',
  },
  {
    id: 'parse-chunks',
    title: 'Chunks split mid-line',
    when:
      'Let the parser hold the buffer whenever the bytes come off the network, because a chunk ends where the network ends it and never where a line does. Splitting on newline yourself is only safe over a stream you already hold whole, which is a test fixture rather than a request.',
    concept: 'text-plain-wire',
  },
  {
    id: 'parse-tricky',
    title: 'The lines that look like both',
    when:
      'Classify on the client when you do not own the route — a third-party endpoint, a provider stream you only proxy. Where you do own it, classify upstream instead: a leading brace is a guess about intent, and this parser is the thing that stops that guess from eating a sentence or a patch the network cut in three.',
    ref: 'util-createmixedstreamparser',
    summary:
      'Prose that begins with a brace, and a patch broken across three chunks, are the two cases a naive split-on-newline parser gets wrong. Both appear in the canned response on purpose.',
  },
  {
    id: 'parse-server',
    title: 'Classify on the server instead',
    when:
      'Fence mode is the one to reach for whenever the route is yours: position decides what a patch is, so prose that opens with a brace can no longer be mistaken for one, and the client is handed typed parts instead of raw lines to re-guess. Keep the client parser for streams that arrive already mixed from somewhere you do not control.',
    ref: 'util-pipejsonrender',
    focus: 'server',
    tasks: 2,
    summary:
      'The same classification, one hop upstream. The client is then handed prose parts and data-spec parts rather than raw lines — and with a ```spec fence, position decides what a patch is instead of a leading brace.',
  },
];

/**
 * The four live-chat stages, each named after the task it is actually paired
 * with.
 *
 * These had drifted by one: "One store per message" sat on the task that asks
 * for a spec-carrying turn, while the task that genuinely shows two
 * independent stores sat under "What you send back". A stage that names a
 * feature its task never demonstrates is the same defect as a stage that
 * names no feature at all — it is just harder to see.
 */
const CHAT_STAGES = [
  {
    id: 'chat-greet',
    title: 'Not every reply carries UI',
    when:
      'Decide per message whether to render, never per route — a loop that always renders draws an empty shell for "hello", which is the first thing anyone types. If your surface is a builder where every reply genuinely is UI, `useUIStream` is the smaller hook and this case does not arise.',
    ref: 'hook-usechatui',
    summary:
      'The greeting has to come back as prose with no spec at all. A loop that always renders something will render an empty shell for "hello", which is the first thing a user types.',
  },
  {
    id: 'chat-ui',
    title: 'A turn that carries a spec',
    when:
      'Reach for `useJsonRenderMessage` when you are already on the AI SDK and the transport is `message.parts` — it only pulls the spec back out of a turn you are otherwise managing. `useChatUI` is the alternative rather than the layer underneath: it owns the whole loop, and you pick one.',
    ref: 'hook-usejsonrendermessage',
    summary:
      'A message is a list of parts, and the UI arrives as one of them. `useJSONRenderMessage` is what pulls the spec back out of the turn so you can render it beside the prose.',
  },
  {
    id: 'chat-interact',
    title: 'Prose and a spec in one turn',
    when:
      'Interleave when the prose is explaining the UI beside it and the user should see both appear. Wait for the whole response instead when you intend to validate or repair before showing anything — that is a real trade, and on a conversational turn it is usually the wrong side of it.',
    concept: 'mixed-stream',
    summary:
      'The same reply carries both, interleaved, over one connection — the live version of the parser you stepped through offline. Neither half waits for the other.',
  },
  {
    id: 'chat-history',
    title: 'One store per message',
    when:
      'One store per message is the default, because generated specs all reach for paths like `/form/email` and two turns will collide on the first one. Share a single store across the thread only when the thread deliberately edits one document across turns, where shared paths are the feature rather than the bug.',
    concept: 'per-message-store',
    summary:
      'Type into the form in one message and the form in another does not move. Each message owns its own state model; share one and every form in the thread writes to the same paths.',
  },
];

export function ChatStepLab({ hasKey }: { hasKey: boolean }) {
  const parser = useMixedStreamLab();
  const chat = useChatLab({ hasKey });

  const stages = [
    ...stagesFromChecklist(parser.items, PARSER_STAGES),
    ...stagesFromChecklist(chat.items, CHAT_STAGES),
  ];

  return (
    <StageFrame
      slug="chat"
      stages={stages}
    >
      {/* The pane is derived from the stage, never stored — a stored copy can
          drift out of step with the rail; a derived one cannot. */}
      {(stage) => (stage.id.startsWith('parse-') ? parser.body(stage.focus) : chat.body)}
    </StageFrame>
  );
}
