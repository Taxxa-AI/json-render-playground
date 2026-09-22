'use client';

import { useStreamPlayer } from '../playground/stream-player';
import { StageFrame } from './stage-frame';
import { useStreamConsole } from './stream-console';
import { stagesFromChecklist } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';

/**
 * Two things this step teaches, each with its own run of stages: watching a
 * canned stream land frame by frame, then writing the patch lines yourself.
 *
 * A stage belongs to exactly one of them and scopes the lab to it.
 */
const PLAYER_STAGES = [
  {
    id: 'play-step',
    title: 'The wire is JSON Patch lines',
    when:
      'Stream line by line when the wait would otherwise be dead air — seconds of a blank page while a model thinks. Ask for one whole JSON object instead when you are going to validate and repair before showing anything anyway, because progressive rendering buys nothing there and a complete object is far easier to reject than a spec that is briefly incomplete at every point.',
    concept: 'jsonl-patches',
    also: ['flat-enables-patching'],
    ref: 'util-parsespecstreamline',
    tasks: 2,
    summary:
      'One feature, watched twice: each line is one RFC 6902 operation, and the spec grows by exactly that much. Stepping the stream and reading the patch beside the tree is the same lesson from both ends.',
  },
  {
    id: 'play-partial',
    title: 'A half-arrived page',
    when:
      'Pass `loading` whenever anything in the streamed page is interactive: without it a button is clickable before the line describing its handler has arrived. If the streamed UI is read-only text and metrics, skipping it costs you a flicker rather than a broken click — and it is not a substitute for deciding, outside the Renderer, whether to show the page at all yet.',
    concept: 'loading-prop',
    ref: 'util-compilespecstream',
    refs: ['ctx-loading'],
    tasks: 2,
    summary:
      'One flag, both ends of it: you pass `loading` to the Renderer while the stream is open, and every component receives it as `ctx.loading`. That is the only way a component can tell "this page is finished" from "the rest is still on the wire" and draw a skeleton for the difference.',
  },
  {
    id: 'play-chunk',
    title: 'A chunk that ends mid-line',
    when:
      'Reach for the stateful compiler whenever the lines come off a socket, because the buffer across chunk boundaries is the only thing it adds. `compileSpecStream` is for a stream you already hold whole — a captured session replayed, a test, a server-side pass — and choosing it for a live fetch is how you lose every line the network happened to split.',
    concept: 'spec-stream',
    ref: 'util-createspecstreamcompiler',
    summary:
      'A network chunk stops wherever the network stops it, usually in the middle of a line. The compiler keeps everything after the last newline in a buffer and applies it when the rest arrives, which is the whole reason it exists next to the one-shot compileSpecStream.',
  },
];

const CONSOLE_STAGES = [
  {
    id: 'write-root',
    title: 'Applying a patch',
    when:
      'Apply patches yourself when you are the producer or need to see each op go past — mirroring `/state`, logging, refusing one. When a model is producing the lines you cannot dictate the order, so treat root-before-children as something to validate afterwards rather than something to assume.',
    ref: 'util-applyspecstreampatch',
    summary:
      'A stream has to build a renderable page from nothing, so the first patches establish the root and its container. Until they land there is no tree to attach anything to.',
  },
  {
    id: 'write-add',
    title: 'add, to elements and children',
    when:
      'Emit the pair every time you introduce an element; one without the other is the orphan, and nothing reports it. When the element already exists and you only want it to say something different, that is a `replace` at one pointer — cheaper, and it does not touch a parent list at all.',
    ref: 'el-elements',
    summary:
      'An element arrives as one patch defining it under `/elements`, and another appending its key to a parent’s children. Send only the first and it is defined but unreachable — the orphan case, straight off the wire.',
  },
  {
    id: 'write-replace',
    title: 'replace, at a stable pointer',
    when:
      'Use `replace` when the value is already there and `add` when the key may not be. On an array the choice stops being stylistic: `add` inserts and shifts everything after it, so correcting one entry with an `add` quietly duplicates a row instead of changing it.',
    ref: 'el-props',
    summary:
      'Because the spec is a flat map, any prop has a stable pointer that does not move when the tree changes. That is what makes a targeted replace possible at all.',
  },
  {
    id: 'write-ops',
    title: 'The four ops nobody streams',
    when:
      'You will not get these from a model, so reach for them when your own code produces the stream — a `diffToPatches` result replayed on the wire, an undo log, a server retracting something it already sent. `test` is the reason the loop needs a try/catch the moment the patches come from anywhere but your own generator: it is the only op that throws.',
    concept: 'rfc6902-patch',
    refs: ['util-applyspecstreampatch'],
    summary:
      'A stream is almost all `add` and `replace`, but the format is RFC 6902 and json-render implements the whole of it. `remove`, `move` and `copy` are how a model retracts and rearranges what it already sent; `test` is the one op that throws, which is why the loop feeding your compiler needs a try/catch.',
  },
  {
    id: 'write-state',
    title: 'Patching the state model',
    when:
      'Mirror whenever the model is allowed to invent the data, because the renderer never reads `spec.state` and a streamed repeat over unmirrored state renders zero rows. When the data is yours, the better answer is to seed the store from your own records and tell the model in `customRules` not to make any up — then there is nothing to mirror.',
    concept: 'state-mirroring',
  },
  {
    id: 'write-bad',
    title: 'A patch that cannot apply',
    when:
      'Silently dropping a bad patch is the right default on a live stream, where one lost line beats a thrown error in front of a user. It is the wrong place to debug from: when a section the spec clearly describes is missing, read the raw lines and run `validateSpec`, because neither the compiler nor the renderer will ever mention it.',
    ref: 'util-createspecstreamcompiler',
    summary:
      'Point a patch at a path whose parent does not exist and it is dropped. The stream carries on, the page renders, and the only sign is the thing you asked for being absent.',
  },
];

export function StreamingLab() {
  const player = useStreamPlayer();
  /* A deep link into the console stages has to arrive with the earlier pushes
     already applied, or the instruction targets a pointer that does not exist. */
  // Stages, not tasks: the rail counts stages, and a stage may own two tasks.
  const opening = useInitialStage(99);
  const console_ = useStreamConsole(Math.max(0, opening - PLAYER_STAGES.length));

  const stages = [
    ...stagesFromChecklist(player.items, PLAYER_STAGES),
    ...stagesFromChecklist(console_.items, CONSOLE_STAGES),
  ];

  return (
    <StageFrame
      slug="streaming"
      stages={stages}
    >
      {/* Derived from the stage, never stored. */}
      {(stage) => (stage.id.startsWith('play-') ? player.body : console_.body)}
    </StageFrame>
  );
}
