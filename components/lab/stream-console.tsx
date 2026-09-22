'use client';

import type { Spec } from '@json-render/core';
import { createSpecStreamCompiler, createStateStore, parseSpecStreamLine } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { useCallback, useRef, useState } from 'react';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { ActionButton, ChromeButton, Chip, Panel } from '../playground/ui';
import { safeCheck, type Task, type TaskContext, type TaskSolution } from './task-list';
import type { ChecklistItem } from './checklist';

/**
 * Be the model.
 *
 * Type patch lines, press push, and watch the spec assemble. This is the same
 * compiler the streaming client uses — there is no simulation layer.
 */

const SNIPPETS: Array<{ label: string; lines: string }> = [
  { label: 'root', lines: `{"op":"add","path":"/root","value":"screen"}` },
  {
    label: 'screen',
    lines: `{"op":"add","path":"/elements/screen","value":{"type":"Screen","props":{"title":"My dashboard","subtitle":null},"children":[]}}`,
  },
  {
    label: 'append child',
    lines: `{"op":"add","path":"/elements/screen/children/-","value":"m1"}
{"op":"add","path":"/elements/m1","value":{"type":"Metric","props":{"label":"Revenue","value":"€48,200","delta":"+12%","tone":"success"},"children":[]}}`,
  },
  {
    label: 'replace a prop',
    lines: `{"op":"replace","path":"/elements/m1/props/tone","value":"danger"}`,
  },
  {
    label: 'remove element',
    lines: `{"op":"remove","path":"/elements/m1"}`,
  },
  {
    label: 'copy · move · remove · test',
    lines: `{"op":"add","path":"/elements/screen/children/-","value":"note"}
{"op":"add","path":"/elements/note","value":{"type":"Alert","props":{"title":"Draft","message":"copied, moved, then removed","tone":"info"},"children":[]}}
{"op":"copy","path":"/elements/spare","from":"/elements/note"}
{"op":"move","path":"/elements/moved","from":"/elements/spare"}
{"op":"remove","path":"/elements/moved"}
{"op":"test","path":"/root","value":"nope"}`,
  },
  {
    label: 'state + repeat',
    lines: `{"op":"add","path":"/elements/screen/children/-","value":"list"}
{"op":"add","path":"/elements/list","value":{"type":"Card","props":{"title":"Clients","subtitle":null},"repeat":{"statePath":"/clients","key":"id"},"children":["row"]}}
{"op":"add","path":"/elements/row","value":{"type":"Text","props":{"value":{"$item":"name"},"tone":null,"size":null},"children":[]}}
{"op":"add","path":"/state/clients","value":[]}
{"op":"add","path":"/state/clients/0","value":{"id":"1","name":"Acme Oy"}}
{"op":"add","path":"/state/clients/1","value":{"id":"2","name":"Borealis AB"}}`,
  },
  { label: 'garbage', lines: `this is not json at all\n{"op":"add"}` },
];

/**
 * The exact lines each task needs, keyed by task id.
 *
 * `onApply` drops them into the draft box — it deliberately does NOT press
 * push for you, because pushing is the thing the check watches.
 */
export const LINES: Record<string, string> = {
  root: `${SNIPPETS[0].lines}\n${SNIPPETS[1].lines}`,
  child: SNIPPETS[2].lines,
  replace: SNIPPETS[3].lines,
  ops: SNIPPETS[5].lines,
  state: SNIPPETS[6].lines,
  garbage: SNIPPETS[7].lines,
};

/** Show the exact patch lines inside a solution note. */
function Lines({ id }: { id: string }) {
  return (
    <span className="mt-0.5 block whitespace-pre-wrap break-all font-mono text-[11.5px] leading-[1.5] text-foreground">
      {LINES[id]}
    </span>
  );
}

/** The spec `compiler.getResult()` returns once the lines up to and including this task have been pushed. */
function specAfter(...ids: string[]): Spec {
  const c = createSpecStreamCompiler<Spec>();
  for (const id of ids) {
    for (const line of LINES[id].split('\n')) {
      // A failing `test` throws out of push — the one op that does. Without
      // this guard the ops snippet would take the module down at import.
      try {
        c.push(`${line}\n`);
      } catch {
        /* the op is rejected, the lines around it are not */
      }
    }
  }
  return c.getResult() as Spec;
}

export const TASKS: Task[] = [
  {
    id: 'root',
    goal: (
      <>
        Push a patch that sets <code>/root</code>, then one that defines that element. Nothing renders until both
        exist.
      </>
    ),
    steps: [
      <>
        Click the <strong>root</strong> chip. The box titled <strong>your patch lines (one JSON object per
        line)</strong> fills with one patch.
      </>,
      <>
        Press <strong>push →</strong>. The <strong>rendered</strong> panel still says{' '}
        <em>No root yet.</em> — <code>/root</code> names an element that does not exist.
      </>,
      <>
        Click the <strong>screen</strong> chip, then press <strong>push →</strong> again.
      </>,
      <>
        The <strong>rendered</strong> panel shows an empty <em>My dashboard</em> screen, and the counter beside{' '}
        <strong>reset compiler</strong> reads <strong>1 elements</strong>.
      </>,
      <>
        Read <strong>compiler.getResult()</strong> at the bottom right: two lines built{' '}
        <code>{'{ "root": "screen", "elements": { "screen": … } }'}</code>.
      </>,
    ],
    solution: {
      spec: specAfter('root'),
      note: (
        <>
          Press <strong>apply to editor</strong> to put both lines in the draft, then press{' '}
          <strong>push →</strong>.
          <Lines id="root" />
        </>
      ),
    },
    check: ({ spec }) => Boolean(spec?.root && spec.elements?.[spec.root]),
  },
  {
    id: 'child',
    goal: (
      <>
        Add a child. Note the <code>/-</code> segment — RFC 6902&rsquo;s &ldquo;append to array&rdquo; pointer.
      </>
    ),
    steps: [
      <>
        Click the <strong>append child</strong> chip. Two lines: one appends <code>"m1"</code> to{' '}
        <code>/elements/screen/children/-</code>, one defines <code>/elements/m1</code>.
      </>,
      <>
        Press <strong>push →</strong>.
      </>,
      <>
        A <em>Revenue</em> metric appears inside the screen in <strong>rendered</strong>, and the counter reads{' '}
        <strong>2 elements</strong>.
      </>,
      <>
        In <strong>compiler.getResult()</strong>, check <code>screen.children</code> is now{' '}
        <code>["m1"]</code> — <code>/-</code> appended to the array instead of replacing it.
      </>,
    ],
    solution: {
      spec: specAfter('root', 'child'),
      note: (
        <>
          The child reference and the element it names are two separate patches, in that order — the renderer
          tolerates the gap.
          <Lines id="child" />
        </>
      ),
    },
    check: ({ spec }) => Object.keys(spec?.elements ?? {}).length >= 2,
  },
  {
    id: 'replace',
    goal: (
      <>
        Use <code>replace</code> to change a prop on an element you already sent — models revise constantly.
      </>
    ),
    steps: [
      <>
        Click the <strong>replace a prop</strong> chip. One line, <code>"op":"replace"</code>, aimed at{' '}
        <code>/elements/m1/props/tone</code>.
      </>,
      <>
        Press <strong>push →</strong>.
      </>,
      <>
        The Revenue metric turns red in <strong>rendered</strong>, and{' '}
        <strong>compiler.getResult()</strong> shows <code>"tone": "danger"</code> where it said{' '}
        <code>"success"</code>.
      </>,
      <>
        Check the <strong>accepted / rejected</strong> list: the line is there with a green{' '}
        <strong>✓</strong>. Nothing was re-sent — one field moved.
      </>,
    ],
    solution: {
      spec: specAfter('root', 'child', 'replace'),
      note: (
        <>
          A <code>replace</code> on a path the compiler already holds rewrites it in place.
          <Lines id="replace" />
        </>
      ),
    },
    // Task 2 already put the Metric on screen, so checking for its existence
    // would tick this the moment the learner arrived. Watch the replaced field.
    check: ({ spec }) =>
      Object.values(spec?.elements ?? {}).some(
        (e) => e.type === 'Metric' && (e.props as { tone?: unknown })?.tone === 'danger',
      ),
  },
  {
    id: 'ops',
    goal: (
      <>
        Push the <strong>copy · move · remove · test</strong> snippet. Six lines, the four ops the
        first three tasks never used.
      </>
    ),
    hint: 'RFC 6902 has six ops and json-render implements all of them. move and copy do nothing at all when `from` is missing — no error, no line in the log. test is the only op that throws, so the push loop that feeds the compiler needs a try/catch or one bad assertion kills the stream.',
    steps: [
      <>
        Click the <strong>copy · move · remove · test</strong> chip and read the six lines before you
        send them: an <code>Alert</code> is added, copied to <code>/elements/spare</code>, moved to{' '}
        <code>/elements/moved</code>, removed, and then a <code>test</code> asserts{' '}
        <code>/root</code> is <code>"nope"</code>.
      </>,
      <>
        Press <strong>push →</strong>.
      </>,
      <>
        In <strong>rendered</strong>, a blue <em>Draft</em> alert joins the screen. In{' '}
        <strong>compiler.getResult()</strong>, <code>elements</code> holds <code>note</code> and
        neither <code>spare</code> nor <code>moved</code> — <code>copy</code> duplicated a value,{' '}
        <code>move</code> relocated it, <code>remove</code> deleted it.
      </>,
      <>
        The last line is red in <strong>accepted / rejected</strong>, tagged{' '}
        <code>Test operation failed</code>. It parsed perfectly; it threw on the way in. Everything
        pushed before it survived.
      </>,
    ],
    solution: {
      spec: specAfter('root', 'child', 'replace', 'ops'),
      note: (
        <>
          <code>copy</code> and <code>move</code> read <code>from</code>, not <code>value</code>, and{' '}
          <code>test</code> carries the value it expects to find.
          <Lines id="ops" />
        </>
      ),
    },
    // The spec alone cannot prove the `test` fired, so the console pairs this
    // with its own throw counter where the items are built.
    check: ({ spec }) => {
      const els = spec?.elements ?? {};
      return Boolean(els.note) && !els.spare && !els.moved;
    },
  },
  {
    id: 'state',
    goal: (
      <>
        Push the <strong>state + repeat</strong> snippet and get two client names on screen.
      </>
    ),
    hint: 'The compiler writes /state into the spec, but the renderer ignores spec.state — the console mirrors it into the store for you. That mirroring is code YOU have to write.',
    steps: [
      <>
        Click the <strong>state + repeat</strong> chip. Six lines: a <code>repeat</code> container, a row, and
        three <code>/state</code> patches.
      </>,
      <>
        Press <strong>push →</strong>.
      </>,
      <>
        In <strong>rendered</strong>, a <em>Clients</em> card lists <em>Acme Oy</em> and{' '}
        <em>Borealis AB</em> — one row per array item.
      </>,
      <>
        In <strong>compiler.getResult()</strong>, find <code>state.clients</code>. The rows do not read that:
        they read the store this console mirrored the <code>/state</code> patches into.
      </>,
    ],
    solution: {
      spec: specAfter('root', 'child', 'replace', 'ops', 'state'),
      note: (
        <>
          <code>/state/clients</code> is added as an empty array first, then one item per line — exactly how a
          model streams a list.
          <Lines id="state" />
        </>
      ),
    },
    check: ({ state }) => Array.isArray(state.clients) && (state.clients as unknown[]).length >= 2,
  },
  {
    id: 'garbage',
    goal: (
      <>
        Push the <strong>garbage</strong> snippet. Confirm a malformed line is skipped rather than throwing.
      </>
    ),
    steps: [
      <>
        Click the red <strong>garbage</strong> chip. Two lines: one prose, one patch with no <code>path</code>.
      </>,
      <>
        Press <strong>push →</strong>.
      </>,
      <>
        In <strong>accepted / rejected</strong>, both new lines carry a red <strong>✕</strong> —{' '}
        <code>parseSpecStreamLine</code> returned <code>null</code> for each.
      </>,
      <>
        The <strong>rendered</strong> panel is unchanged and the element counter has not moved. A bad line costs
        you the line, not the stream.
      </>,
    ],
    solution: {
      spec: specAfter('root', 'child', 'replace', 'ops', 'state', 'garbage'),
      note: (
        <>
          The spec is identical to the one before these lines — both were dropped.
          <Lines id="garbage" />
        </>
      ),
    },
    check: ({ spec }) => Boolean(spec?.root),
  },
];

/** The console's tasks, in the order the stages present them. */
const TASK_ORDER = ['root', 'child', 'replace', 'ops', 'state', 'garbage'];

export function useStreamConsole(openAt = 0) {
  const [draft, setDraft] = useState(() => SNIPPETS[Math.min(openAt, SNIPPETS.length - 1)]?.lines ?? SNIPPETS[0].lines);
  const [sent, setSent] = useState<Array<{ line: string; ok: boolean; why?: string }>>([]);
  const [, force] = useState(0);
  /** How many pushes the compiler threw on. Only a failing `test` can do it. */
  const [threw, setThrew] = useState(0);

  /**
   * Arriving mid-run replays everything the earlier stages pushed.
   *
   * The console is cumulative by nature — stage three's `replace` targets a
   * pointer stage two created — so a deep link to it used to open on an empty
   * compiler where the instruction could not succeed. Walking the rail was
   * fine; a link was not.
   */
  const compilerRef = useRef<ReturnType<typeof createSpecStreamCompiler<Spec>>>(undefined as never);
  if (!compilerRef.current) {
    const c = createSpecStreamCompiler<Spec>();
    for (const id of TASK_ORDER.slice(0, Math.max(0, openAt))) {
      for (const line of (LINES[id] ?? '').split('\n')) {
        try {
          c.push(`${line}\n`);
        } catch {
          /* a rejected op is part of the lesson, not a failure to seed */
        }
      }
    }
    compilerRef.current = c;
  }
  const storeRef = useRef(createStateStore({}));
  const [runId, setRunId] = useState(0);

  const push = useCallback(() => {
    const lines = draft.split('\n').map((l) => l.trim()).filter(Boolean);
    const results: Array<{ line: string; ok: boolean; why?: string }> = [];
    let threwHere = 0;

    for (const line of lines) {
      // parseSpecStreamLine returns null for anything that is not a patch.
      const parsed = parseSpecStreamLine(line);
      const row: { line: string; ok: boolean; why?: string } = { line, ok: parsed !== null };
      results.push(row);

      // A `test` op that does not match throws straight out of push(), and it
      // is the only one that can. Feed a stream without this guard and one bad
      // assertion ends the whole response.
      try {
        compilerRef.current.push(`${line}\n`);
      } catch (err) {
        row.ok = false;
        row.why = err instanceof Error ? err.message : String(err);
        threwHere += 1;
      }

      if (parsed) {
        // Mirror /state patches into the live store. The renderer never reads
        // spec.state, so without this a repeat renders zero rows.
        const p = parsed as { path?: string; value?: unknown };
        if (p.path === '/state' && p.value && typeof p.value === 'object') {
          for (const [k, v] of Object.entries(p.value as Record<string, unknown>)) {
            storeRef.current.set(`/${k}`, v);
          }
        } else if (p.path?.startsWith('/state/')) {
          storeRef.current.set(p.path.slice('/state'.length), p.value);
        }
      }
    }

    setSent((prev) => [...results.reverse(), ...prev].slice(0, 60));
    if (threwHere) setThrew((n) => n + threwHere);
    force((n) => n + 1);
  }, [draft]);

  /** "apply to editor" here means the draft box. Pushing stays the learner's move. */
  const applySolution = useCallback((sol: TaskSolution) => {
    const task = TASKS.find((t) => t.solution === sol);
    if (task && LINES[task.id]) setDraft(LINES[task.id]);
  }, []);

  const reset = useCallback(() => {
    compilerRef.current = createSpecStreamCompiler<Spec>();
    storeRef.current = createStateStore({});
    setSent([]);
    setThrew(0);
    setRunId((r) => r + 1);
    force((n) => n + 1);
  }, []);

  const spec = compilerRef.current.getResult() as Spec | null;
  const hasRoot = Boolean(spec?.root && spec.elements?.[spec.root]);

  const ctx: TaskContext = {
    spec: spec ?? null,
    state: storeRef.current.getSnapshot(),
    fired: [],
    written: [],
  };

  /**
   * The console’s tasks as checklist items, so the stage rail above this
   * lab can own them. The checks need the ctx built just above, which is
   * why they are derived here rather than exported as a constant.
   */
  const items: ChecklistItem[] = TASKS.map((task) => ({
    label: task.goal,
    // `ops` ends in a failing `test`, and a rejected assertion leaves the spec
    // byte-identical — so that one check needs the console's throw counter too.
    done: safeCheck(task, ctx) && (task.id !== 'ops' || threw > 0),
    hint: task.hint,
    steps: task.steps,
    ...(task.solution ? { apply: { label: 'Apply to editor', run: () => applySolution(task.solution!) } } : {}),
  }));

  const body = (
    <div className="flex flex-col gap-3">

      <div className="flex flex-wrap gap-1.5">
        {SNIPPETS.map((s) => (
          <Chip key={s.label} danger={s.label === 'garbage'} onClick={() => setDraft(s.lines)}>
            {s.label}
          </Chip>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Panel title="your patch lines (one JSON object per line)" bodyClassName="flex flex-col">
            <textarea
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-[170px] w-full resize-none bg-transparent p-3 font-mono text-[12px] leading-[1.55] text-foreground outline-none"
            />
            <div className="flex items-center gap-2 border-t bg-muted px-3 py-1.5">
              <ActionButton size="chrome" onClick={push}>
                push →
              </ActionButton>
              <ChromeButton onClick={reset}>reset compiler</ChromeButton>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                {Object.keys(spec?.elements ?? {}).length} elements
              </span>
            </div>
          </Panel>

          <Panel title="accepted / rejected">
            <div className="max-h-[150px] overflow-auto p-2 font-mono text-[11.5px]">
              {sent.length === 0 ? (
                <div className="p-1.5 text-muted-foreground">Nothing pushed yet.</div>
              ) : (
                sent.map((r, i) => (
                  <div key={i} className="flex gap-2 rounded px-1.5 py-0.5">
                    <span className={r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {r.ok ? '✓' : '✕'}
                    </span>
                    <span className="min-w-0 break-all text-muted-foreground">
                      {r.line}
                      {r.why && <span className="block text-red-600 dark:text-red-400">{r.why}</span>}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          <Panel title="rendered" bodyClassName="overflow-auto">
            <div className="p-3" style={{ minHeight: 290, maxHeight: 340 }}>
              {hasRoot ? (
                <JSONUIProvider key={runId} registry={demoRegistry} store={storeRef.current}>
                  <Renderer spec={spec} registry={demoRegistry} fallback={UnknownComponent} />
                </JSONUIProvider>
              ) : (
                <div className="flex h-[140px] items-center justify-center text-[12px] text-muted-foreground">
                  No root yet.
                </div>
              )}
            </div>
          </Panel>

          <Panel title="compiler.getResult()">
            <pre className="max-h-[220px] overflow-auto p-3 font-mono text-[11.5px] leading-[1.55] text-muted-foreground">
              <code>{JSON.stringify(spec, null, 2)}</code>
            </pre>
          </Panel>
        </div>
      </div>
    </div>
  );

  return { items, body };
}

/** The console on its own, for anywhere that does not stage it. */
export function StreamConsole() {
  return useStreamConsole().body;
}
