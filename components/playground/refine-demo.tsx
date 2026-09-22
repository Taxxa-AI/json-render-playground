'use client';

import type { Spec } from '@json-render/core';
import { buildUserPrompt, createSpecStreamCompiler, deepMergeSpec, diffToPatches } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { createStateStore } from '@json-render/core';
import { useEffect, useMemo, useState } from 'react';
import { StageFrame } from '@/components/lab/stage-frame';
import { type Stage, stagesFromChecklist } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { REFINE_BASE } from '@/lib/demo/specs';
import type { ChecklistItem } from '../lab/checklist';
import { CopyButton, Panel, Tabs } from './ui';

type Mode = 'patch' | 'merge' | 'diff';

/** The four tabs of the right-hand panel. A stage is about exactly one of them. */
type Tab = 'wire' | 'diff' | 'bench' | 'prompt';

const MODE_NOTE: Record<Mode, string> = {
  patch: 'RFC 6902. One operation per line, applied as they stream. The only mode useUIStream understands out of the box.',
  merge: 'RFC 7396. ONE line, flagged with __json_edit. Nothing streams — you get the whole edit at the end and apply it with deepMergeSpec yourself.',
  diff: 'A unified diff in a ```diff fence. No applier ships with the library; you bring your own patch implementation.',
};

/**
 * Deliberately does NOT use `useUIStream`.
 *
 * That hook parses every line as a JSON Patch, which is correct for `patch`
 * mode and silently drops everything else. To show honestly what merge and
 * diff modes put on the wire, this reads the response itself.
 */
/** Edits the base by hand: one rename, and one null that DELETES rather than sets. */
const MERGE_PATCH_SEED = JSON.stringify(
  { elements: { screen: { props: { title: 'Revenue, merged', subtitle: null } } } },
  null,
  2,
);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Which keys a merge removed, as JSON pointers.
 *
 * RFC 7396 spends its one special value on deletion, so "what did this patch
 * delete" is the single question the merged spec cannot answer just by being
 * read — the key is not there to notice.
 */
function deletedPaths(before: unknown, after: unknown, at = ''): string[] {
  if (!isPlainObject(before) || !isPlainObject(after)) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(before)) {
    const path = `${at}/${k}`;
    if (!(k in after)) out.push(path);
    else out.push(...deletedPaths(v, after[k], path));
  }
  return out;
}

/**
 * The lesson half of each stage; the demo's own checklist supplies the rest.
 *
 * `focus` is the TAB the stage's own steps tell you to read, and the panel
 * opens on it. Careful with `diff`: the stage id is the diff MODE, while the
 * tab id `diff` is the computed-diff pane — that stage reads the raw response,
 * so it focuses `wire`. The mode selector is deliberately NOT stage-driven:
 * picking a mode is the assignment on the first three stages, and each of them
 * has a "do it for me" button for the learner who would rather not.
 */
const REFINE_STAGES: Array<{
  id: string;
  focus: Tab;
  title: string;
  concept?: string;
  ref?: string;
  when?: string;
  summary?: string;
}> = [
  {
    id: 'run',
    focus: 'wire',
    title: 'Three ways to send one edit',
    when:
      'Send `patch` unless you have a reason not to: it is the only mode `useUIStream` can apply, and the other two come back looking like success and changing nothing. Choose `merge` when a broad edit touches many props and you are willing to write the apply step, and `diff` only if you already own a unified-diff applier, because none ships.',
    concept: 'edit-modes',
  },
  {
    id: 'compare',
    focus: 'wire',
    title: 'Compare what came back',
    when:
      'Run this comparison once, against your own catalog, before you commit to a mode — the answer depends on how your props are shaped and how large a typical edit is, not on which format reads better. In production you pick one and keep it; offering the model all three is how you get a response you cannot apply.',
    concept: 'edit-modes',
  },
  {
    id: 'diff',
    focus: 'wire',
    title: 'Read the diff first',
    when:
      'Compute a diff whenever the spec being edited is something a user already trusts or has work in. Apply blind only on a scratch preview: a model asked for one change quietly rewrites labels nobody mentioned, and once you have accepted there is no earlier version left to compare against.',
    concept: 'merge-and-diff',
  },
  {
    id: 'merge-rules',
    focus: 'bench',
    title: 'null deletes, arrays replace',
    when:
      'Merge suits an edit that sets or removes many props at once and none of them null — a tone, a title, a batch of labels. The moment your catalog has nullable props, or the edit changes one item inside a list, merge is the wrong mode rather than a risky one: it cannot write a null, and it replaces an array wholesale. Use `patch`.',
    concept: 'rfc7396-merge',
    ref: 'util-deepmergespec',
    summary:
      'Merge mode is cheap to emit and cheap to get wrong, because RFC 7396 gives null one job: removal. A merge patch therefore cannot set a value TO null — and a demo catalog built out of .nullable() props is exactly where a model reaches for one.',
  },
  {
    id: 'accept',
    focus: 'diff',
    title: 'Accept is a decision',
    when:
      'Put a human in front of the operation list whenever the spec is something a user built and can lose. Auto-accepting is defensible on a throwaway preview and nowhere else, because each accepted spec becomes the base the next instruction edits — so an unnoticed regression is inherited rather than corrected.',
    concept: 'diff-before-accept',
    ref: 'util-difftopatches',
  },
  {
    id: 'base',
    focus: 'wire',
    title: 'The new base spec',
    when:
      'Keep the accepted spec as the single base only if you also keep the ones before it; refinement compounds, and the cheapest insurance against a bad fifth edit is dropping back to the third. When the spec has drifted far from what the user is now describing, regenerate rather than refine again — it is usually cheaper than the prompt you have been shipping every turn.',
    ref: 'util-deepmergespec',
    summary:
      'An accepted refinement becomes the spec the next instruction edits. Refinement is a loop, so whatever the model quietly broke on this pass is the ground truth for the next one.',
  },
  {
    id: 'prompt',
    focus: 'prompt',
    title: 'What the model was sent',
    when:
      'Use `buildUserPrompt` when you want the library\'s refinement framing and can afford to ship the whole current spec every turn. Assemble the turn yourself once that bill hurts and you can send a subtree instead — and watch what you pass as `currentSpec`, because the test is `isNonEmptySpec` and an empty elements map silently becomes a fresh generation.',
    ref: 'util-builduserprompt',
    summary:
      'One function assembles the user turn, and one test decides its shape: a non-empty currentSpec turns a generation into a refinement. Everything the loop has accumulated is inside that string, and you pay for all of it on every edit.',
  },
];

/** The tab a stage opens on, tolerant of a stage that never named one. */
function tabOf(stage: Pick<Stage, 'focus'>): Tab {
  return (stage.focus as Tab | undefined) ?? 'wire';
}

export function RefineDemo({ hasKey }: { hasKey: boolean }) {
  const initial = useInitialStage(REFINE_STAGES.length);
  const [base, setBase] = useState<Spec>(REFINE_BASE);
  const [mode, setMode] = useState<Mode>('patch');
  const [prompt, setPrompt] = useState('Add an "Outstanding" metric showing €9,640 in a warning tone, side by side with the existing one.');
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<Spec | null>(null);
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle');
  const [note, setNote] = useState('');
  // Seeded from the stage the lab OPENS on, not from a fixed 'wire'. A deep
  // link (`?stage=5`) is server-rendered, so a tab chosen only in
  // onStageChange would paint the wrong pane until hydration.
  const [tab, setTab] = useState<Tab>(() => tabOf(REFINE_STAGES[initial]));
  const [ranModes, setRanModes] = useState<Set<Mode>>(new Set());
  const [accepted, setAccepted] = useState(0);
  const [viewedDiff, setViewedDiff] = useState(false);
  const [mergePatch, setMergePatch] = useState(MERGE_PATCH_SEED);
  const [mergeNote, setMergeNote] = useState('');
  const [mergeDeleted, setMergeDeleted] = useState<string[]>([]);
  const [sawMergeDelete, setSawMergeDelete] = useState(false);
  const [promptWithSpec, setPromptWithSpec] = useState(true);
  const [promptShapes, setPromptShapes] = useState<Set<string>>(new Set());

  const store = useMemo(() => createStateStore({}), []);
  const shown = result ?? base;

  const userPrompt = useMemo(
    () => buildUserPrompt({ prompt, currentSpec: promptWithSpec ? base : null, editModes: [mode] }),
    [prompt, base, promptWithSpec, mode],
  );

  // The shape is read back OUT of the built string rather than off the toggle,
  // because buildUserPrompt is the thing deciding: it asks isNonEmptySpec, so
  // `{ root, elements: {} }` would come back a fresh generation either way.
  useEffect(() => {
    if (tab !== 'prompt') return;
    const shape = userPrompt.includes('CURRENT UI STATE') ? 'refinement' : 'fresh';
    setPromptShapes((prev) => (prev.has(shape) ? prev : new Set(prev).add(shape)));
  }, [tab, userPrompt]);

  const patchesFromAccept = useMemo(() => {
    if (!result) return [];
    try {
      return diffToPatches(base as unknown as Record<string, unknown>, result as unknown as Record<string, unknown>);
    } catch {
      return [];
    }
  }, [base, result]);

  // "Did they read the computed diff?" is a question about what is ON SCREEN,
  // not about a click: the accept stage opens that tab for them, so a learner
  // who follows the stage never clicks it and would never clear the stage.
  useEffect(() => {
    if (tab === 'diff' && patchesFromAccept.length > 0) setViewedDiff(true);
  }, [tab, patchesFromAccept]);

  async function run() {
    setRaw('');
    setResult(null);
    setNote('');
    setStatus('streaming');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, currentSpec: base, context: { editModes: [mode] } }),
      });

      if (!res.ok || !res.body) {
        const msg = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setNote(String(msg.error ?? `HTTP ${res.status}`));
        setStatus('error');
        return;
      }

      // Patch mode can apply progressively; the others cannot, so they just accumulate.
      const compiler = createSpecStreamCompiler<Spec>(structuredClone(base));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        text += chunk;
        setRaw(text);
        if (mode === 'patch') {
          compiler.push(chunk);
          setResult({ ...(compiler.getResult() as Spec) });
        }
      }

      if (mode === 'patch') {
        setResult({ ...(compiler.getResult() as Spec) });
        setNote('Applied live, patch by patch, as it streamed.');
      } else if (mode === 'merge') {
        // Find the single __json_edit line and deep-merge it (RFC 7396:
        // null deletes a key, arrays replace wholesale, objects recurse).
        const line = text
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.startsWith('{') && l.includes('__json_edit'));
        if (!line) {
          setNote('No __json_edit line found. Nothing to apply.');
        } else {
          const { __json_edit, ...patch } = JSON.parse(line) as Record<string, unknown>;
          void __json_edit;
          setResult(deepMergeSpec(base as unknown as Record<string, unknown>, patch) as unknown as Spec);
          setNote('Arrived as one line at the end, then applied with deepMergeSpec(base, patch).');
        }
      } else {
        setNote('A unified diff. The library ships no applier for this — you would use your own, or regenerate.');
      }

      setRanModes((prev) => new Set(prev).add(mode));
      setStatus('done');
    } catch (e) {
      setNote((e as Error).message);
      setStatus('error');
    }
  }

  /** Apply the hand-written merge patch locally: no model, no gateway key. */
  function applyMerge() {
    try {
      const patch = JSON.parse(mergePatch) as Record<string, unknown>;
      const next = deepMergeSpec(base as unknown as Record<string, unknown>, patch) as unknown as Spec;
      const gone = deletedPaths(base, next);
      setResult(next);
      setMergeDeleted(gone);
      setMergeNote(
        gone.length > 0
          ? `deepMergeSpec removed ${gone.length} key(s). Neither input was mutated.`
          : 'Merged. Nothing was deleted — no null in the patch lined up with a key the base actually has.',
      );
      if (gone.length > 0) setSawMergeDelete(true);
    } catch (e) {
      setMergeDeleted([]);
      setMergeNote((e as Error).message);
    }
  }

  const items: ChecklistItem[] = [
    {
      label: <>Send the edit in <code>patch</code> mode and watch it apply line by line.</>,
      done: ranModes.has('patch'),
      steps: [
        <>
          Leave the mode selector on <strong>patch</strong> — it is the leftmost of the three.
        </>,
        <>
          Leave the prompt as it is: it asks for an <em>Outstanding</em> metric beside the existing one.
        </>,
        <>
          Press <strong>Send edit</strong>.
        </>,
        <>
          Watch the left pane: the new metric appears mid-stream, because each line is applied as it
          arrives. The element count in that panel&rsquo;s header goes up.
        </>,
        <>
          Read the grey note under the prompt box:{' '}
          <em>Applied live, patch by patch, as it streamed.</em>
        </>,
      ],
      apply: { label: 'select patch mode', run: () => setMode('patch') },
    },
    {
      label: <>Send the same edit in <code>merge</code> mode and find the single <code>__json_edit</code> line in the raw response.</>,
      done: ranModes.has('merge'),
      hint: 'Nothing streams. The whole edit arrives at the end and is applied with deepMergeSpec.',
      steps: [
        <>
          Press <strong>Reset</strong> so you are editing the same base again.
        </>,
        <>
          Click <strong>merge</strong> in the mode selector, then press <strong>Send edit</strong>.
        </>,
        <>
          Watch the left pane stay still for the whole request — nothing can apply until the last byte.
        </>,
        <>
          Read <strong>raw response</strong> — the tab this stage opens — and find the one line containing{' '}
          <code>__json_edit</code>: the entire edit, as a single RFC 7396 merge patch.
        </>,
      ],
      apply: { label: 'select merge mode', run: () => setMode('merge') },
    },
    {
      label: <>Send it in <code>diff</code> mode. Nothing applies — the library ships no diff applier.</>,
      done: ranModes.has('diff'),
      steps: [
        <>
          Click <strong>diff</strong> in the mode selector and press <strong>Send edit</strong>.
        </>,
        <>
          Read <strong>raw response</strong>: a unified diff inside a <code>```diff</code> fence.
        </>,
        <>
          The left pane never changes, and the note says so — you would need your own patch applier, or a
          regeneration.
        </>,
      ],
      apply: { label: 'select diff mode', run: () => setMode('diff') },
    },
    {
      label: <>Write a merge patch that DELETES a prop, and watch <code>null</code> do it.</>,
      done: sawMergeDelete,
      hint: 'RFC 7396 gives null exactly one meaning: remove the key. Which is why a merge patch cannot set a prop to null.',
      steps: [
        <>
          The <strong>merge bench</strong> tab is open on the right. No model runs here — it calls{' '}
          <code>deepMergeSpec(base, patch)</code> directly.
        </>,
        <>
          Read the seeded patch: it renames <code>screen.props.title</code> and sets{' '}
          <code>subtitle</code> to <code>null</code>.
        </>,
        <>
          Press <strong>Apply merge</strong>. The <strong>deleted</strong> line names{' '}
          <code>/elements/screen/props/subtitle</code> — the key is <em>gone</em> from the result, not set to
          null.
        </>,
        <>
          Now try to write it back: change the patch to{' '}
          <code>&#123; &quot;subtitle&quot;: null &#125;</code> on a base that has one and press{' '}
          <strong>Apply merge</strong> again. There is no patch that assigns null, so this format cannot
          express it at all.
        </>,
        <>
          Swap <code>props</code> for <code>&quot;children&quot;: [&quot;m1&quot;]</code> on{' '}
          <code>screen</code> to see the other rule: arrays REPLACE wholesale, they never concatenate.
        </>,
      ],
      apply: {
        label: 'apply the seeded patch',
        run: () => {
          setTab('bench');
          applyMerge();
        },
      },
    },
    {
      label: <>Open <strong>computed diff</strong> and read the RFC 6902 ops separating before and after.</>,
      done: viewedDiff,
      hint: 'diffToPatches(base, result). This is how you catch a model that reworded labels nobody asked about.',
      steps: [
        <>
          Run an edit in <strong>patch</strong> or <strong>merge</strong> mode first — this pane needs a
          result to compare against.
        </>,
        <>
          Read the <strong>computed diff</strong> tab on the right-hand panel — this stage opens it.
        </>,
        <>
          Read the operations: one per thing that actually changed between the base spec and the result.
        </>,
        <>
          Look for any op you did not ask for — a reworded label, a dropped prop. This list is how you
          catch that before the user does.
        </>,
      ],
      // No tick to hand out here: the effect ticks it the moment the pane is
      // on screen with something in it. The button is for the learner who
      // wandered off the stage's own tab.
      apply: { label: 'open computed diff', run: () => setTab('diff') },
    },
    {
      label: 'Accept a result as the new base and send a second edit against it.',
      done: accepted >= 1 && ranModes.size >= 1 && status === 'done' && result !== null,
      hint: 'Every edit ships the whole current spec as context. Cost grows with what the user has built.',
      steps: [
        <>
          With a result on screen, press <strong>Accept as new base</strong>. The panel title goes back to{' '}
          <strong>current spec</strong>.
        </>,
        <>
          Type a second instruction, e.g. <em>&ldquo;Put the two metrics in a row and add a
          Paid badge.&rdquo;</em>
        </>,
        <>
          Press <strong>Send edit</strong> again.
        </>,
        <>
          Read <strong>raw response</strong>: its paths address elements that only exist because you
          accepted the last edit. The second instruction was applied to your accepted spec, not to the one
          this lab started with. (What was <em>sent</em> is the next stage, in <strong>user prompt</strong>
          .)
        </>,
      ],
    },
    {
      label: (
        <>
          See both shapes <code>buildUserPrompt</code> produces — a fresh generation and a refinement.
        </>
      ),
      done: promptShapes.size === 2,
      hint: 'One test picks the shape: isNonEmptySpec(currentSpec). Pass null, or a spec with no elements, and you get a generation prompt instead of an edit.',
      steps: [
        <>
          The <strong>user prompt</strong> tab is open on the right. This is the exact user turn the route
          builds, rendered live from the box above.
        </>,
        <>
          With <code>currentSpec: base</code> selected, read the top of it:{' '}
          <em>CURRENT UI STATE (already loaded, DO NOT recreate existing elements)</em>, the whole spec
          serialized, then your request, then <em>Output ONLY the JSON Patch lines needed for the
          change.</em>
        </>,
        <>
          Click <code>currentSpec: null</code>. The spec block and the refinement instruction vanish, and a
          reminder to output <code>/root</code> first takes their place — a generation prompt.
        </>,
        <>
          Accept an edit as the new base, then look again: the spec block grew. This is the token bill that
          rises with every accepted refinement, and the reason a long session gets slower and dearer.
        </>,
      ],
      apply: {
        label: 'open it and flip the toggle',
        run: () => {
          setTab('prompt');
          setPromptWithSpec((on) => !on);
        },
      },
    },
  ];

  const stagedBody = (
    <div className="flex flex-col gap-3">

      <div className="rounded-lg border bg-surface p-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Describe a change to the current spec…"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
          <button
            type="button"
            disabled={!hasKey || status === 'streaming' || !prompt.trim()}
            onClick={() => void run()}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {status === 'streaming' ? 'Editing…' : 'Send edit'}
          </button>

          <div className="flex items-center gap-0.5 rounded-md border p-0.5">
            {(['patch', 'merge', 'diff'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded px-2 py-0.5 font-mono text-[11px] transition ${
                  mode === m ? 'bg-surface-hover text-foreground' : 'text-muted-foreground hover:text-muted-foreground'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={!result}
            onClick={() => {
              if (result) {
                setBase(result);
                setAccepted((n) => n + 1);
              }
              setResult(null);
              setRaw('');
              setNote('');
              setStatus('idle');
            }}
            className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          >
            Accept as new base
          </button>
          <button
            type="button"
            onClick={() => {
              setBase(REFINE_BASE);
              setResult(null);
              setRaw('');
              setNote('');
              setStatus('idle');
            }}
            className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Reset
          </button>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          <span className="font-mono text-muted-foreground">{mode}</span> — {MODE_NOTE[mode]}
        </p>
      </div>

      {!hasKey && (
        <div className="rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950 px-3.5 py-2.5 text-xs text-yellow-600 dark:text-yellow-400">
          <strong>No gateway key.</strong> Add <code>AI_GATEWAY_API_KEY</code> to <code>.env</code> to run edits.
        </div>
      )}

      {note && (
        <div
          className={`rounded-lg border px-3.5 py-2 text-xs ${
            status === 'error'
              ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
              : 'border-border bg-surface text-muted-foreground'
          }`}
        >
          {note}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel
          title={result ? 'after the edit' : 'current spec'}
          right={
            <span className="font-mono text-[11px] text-muted-foreground">
              {Object.keys(shown.elements ?? {}).length} elements
            </span>
          }
          bodyClassName="overflow-auto"
        >
          <div className="p-4" style={{ minHeight: 440, maxHeight: 540 }}>
            <JSONUIProvider registry={demoRegistry} store={store}>
              <Renderer spec={shown} registry={demoRegistry} fallback={UnknownComponent} />
            </JSONUIProvider>
          </div>
        </Panel>

        <Panel
          title={
            <Tabs
              tabs={[
                { id: 'wire', label: 'raw response' },
                { id: 'diff', label: 'computed diff' },
                { id: 'bench', label: 'merge bench' },
                { id: 'prompt', label: 'user prompt' },
              ]}
              active={tab}
              // Just the tab: the effect above owns "they have seen the diff",
              // so arriving by stage and arriving by click count the same.
              onChange={(id) => setTab(id as Tab)}
            />
          }
          right={
            <CopyButton
              text={
                tab === 'wire'
                  ? raw
                  : tab === 'diff'
                    ? JSON.stringify(patchesFromAccept, null, 2)
                    : tab === 'bench'
                      ? mergePatch
                      : userPrompt
              }
            />
          }
        >
          {tab === 'bench' ? (
            <div className="flex flex-col" style={{ minHeight: 440, maxHeight: 540 }}>
              <textarea
                value={mergePatch}
                onChange={(e) => setMergePatch(e.target.value)}
                spellCheck={false}
                className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-[11.5px] leading-[1.6] text-foreground outline-none"
              />
              <div className="flex flex-wrap items-center gap-2 border-t bg-muted px-3 py-1.5">
                <button
                  type="button"
                  onClick={applyMerge}
                  className="rounded bg-brand px-2 py-0.5 font-mono text-[11px] text-brand-foreground"
                >
                  Apply merge
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMergePatch(MERGE_PATCH_SEED);
                    setMergeNote('');
                    setMergeDeleted([]);
                  }}
                  className="rounded border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                >
                  reset patch
                </button>
              </div>
              <div className="shrink-0 border-t p-3 font-mono text-[11.5px] leading-[1.6]">
                <div className="text-muted-foreground">
                  {mergeNote || 'deepMergeSpec(base, patch) — press Apply merge to run it against the spec on the left.'}
                </div>
                {mergeDeleted.length > 0 && (
                  <div className="mt-1.5 text-red-600 dark:text-red-400">deleted: {mergeDeleted.join(' · ')}</div>
                )}
              </div>
            </div>
          ) : tab === 'prompt' ? (
            <div className="flex flex-col" style={{ minHeight: 440, maxHeight: 540 }}>
              <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b bg-muted px-3 py-1.5">
                {([true, false] as const).map((on) => (
                  <button
                    key={String(on)}
                    type="button"
                    onClick={() => setPromptWithSpec(on)}
                    className={`rounded px-2 py-0.5 font-mono text-[11px] transition ${
                      promptWithSpec === on ? 'bg-surface-hover text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    currentSpec: {on ? 'base' : 'null'}
                  </button>
                ))}
              </div>
              <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11.5px] leading-[1.6] text-muted-foreground">
                <code>{userPrompt}</code>
              </pre>
            </div>
          ) : (
            <pre
              className="overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11.5px] leading-[1.6] text-muted-foreground"
              style={{ minHeight: 440, maxHeight: 540 }}
            >
              <code>
                {tab === 'wire'
                  ? raw || 'Nothing sent yet. Everything the model returns lands here, verbatim.'
                  : patchesFromAccept.length
                    ? JSON.stringify(patchesFromAccept, null, 2)
                    : 'diffToPatches(base, result) — run an edit to see the operations that separate the two specs.'}
              </code>
            </pre>
          )}
        </Panel>
      </div>
    </div>
  );

  return (
    <StageFrame
      slug="refine"
      stages={stagesFromChecklist(items, REFINE_STAGES)}
      // Every stage names its tab, so none of them can inherit the last one's.
      onStageChange={(stage) => setTab(tabOf(stage))}
    >
      {() => stagedBody}
    </StageFrame>
  );
}
