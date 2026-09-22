'use client';

import { type Spec, validateSpec } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CodeBlock } from '@/components/playground/code-block';
import { ActionButton, ChromeButton, Panel, Pill } from '@/components/playground/ui';
import { StepRef } from '@/components/shell/step-ref';
import type { Question, Quiz } from '@/lib/checkpoints';
import { FILL } from '@/lib/checkpoints';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { setCheckpointScore } from '@/lib/progress';
import { cn } from '@/lib/utils';

/**
 * A checkpoint quiz.
 *
 * The design rule: never let the learner take our word for it. A `predict`
 * question renders the real spec through the real registry after they answer,
 * a `spot` question runs the real `validateSpec`, and a `fill` question
 * substitutes the option they actually chose. If a question in this file were
 * wrong, the reveal would contradict it on screen.
 */
export function CheckpointQuiz({
  quiz,
  nextHref,
  nextLabel,
}: {
  quiz: Quiz;
  nextHref: string | null;
  nextLabel: string | null;
}) {
  // In the data files the correct option is always first, so they stay readable
  // and reviewable. Shuffle deterministically per question id here, so the
  // order is stable across renders and retakes but never "always (a)".
  const questions = useMemo(() => quiz.questions.map(permute), [quiz]);
  const total = questions.length;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [at, setAt] = useState(0);
  const [done, setDone] = useState(false);

  const score = questions.reduce((n, q) => n + (answers[q.id] === q.answer ? 1 : 0), 0);
  const answered = Object.keys(answers).length;

  function choose(q: Question, i: number) {
    if (answers[q.id] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [q.id]: i }));
  }

  function finish() {
    setDone(true);
    setCheckpointScore(quiz.slug, { score, total, at: Date.now() });
  }

  function retake() {
    setAnswers({});
    setAt(0);
    setDone(false);
  }

  if (done) {
    return (
      <ScoreScreen
        questions={questions}
        answers={answers}
        score={score}
        total={total}
        onRetake={retake}
        nextHref={nextHref}
        nextLabel={nextLabel}
      />
    );
  }

  const q = questions[at];
  const picked = answers[q.id];
  const locked = picked !== undefined;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        {questions.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setAt(i)}
            title={`Question ${i + 1}`}
            aria-label={`Question ${i + 1}`}
            className={cn(
              'h-1.5 min-w-0 flex-1 rounded-full transition-colors',
              answers[x.id] === undefined
                ? i === at
                  ? 'bg-orange-500'
                  : 'bg-muted'
                : answers[x.id] === x.answer
                  ? 'bg-emerald-500'
                  : 'bg-red-500',
            )}
          />
        ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>
          {at + 1} / {total} · {q.kind}
        </span>
        <span>
          {answered} answered · {score} right
        </span>
      </div>

      <QuestionCard key={q.id} q={q} picked={picked} onPick={(i) => choose(q, i)} />

      <div className="mt-4 flex items-center gap-2">
        <ChromeButton onClick={() => setAt((i) => Math.max(0, i - 1))} disabled={at === 0}>
          ← prev
        </ChromeButton>
        {at < total - 1 ? (
          <ActionButton onClick={() => setAt((i) => Math.min(total - 1, i + 1))} disabled={!locked}>
            next question →
          </ActionButton>
        ) : (
          <ActionButton onClick={finish} disabled={answered < total}>
            see your score
          </ActionButton>
        )}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {answered < total ? `${total - answered} left` : 'all answered'}
        </span>
      </div>
    </div>
  );
}

function QuestionCard({ q, picked, onPick }: { q: Question; picked: number | undefined; onPick: (i: number) => void }) {
  const locked = picked !== undefined;
  const [revealed, setRevealed] = useState(false);
  const seed: Record<string, unknown> = q.kind === 'predict' || q.kind === 'fill' ? (q.seed ?? {}) : {};

  // For `fill`, the live spec depends on the option the learner picked.
  const liveSpec = useMemo<Spec | null>(() => {
    if (q.kind === 'predict') return q.spec;
    if (q.kind === 'fill' && picked !== undefined) return substitute(q.spec, q.fills[picked]);
    return null;
  }, [q, picked]);

  return (
    <article className="mt-3 overflow-hidden rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{q.prompt}</p>
      </div>

      {(q.kind === 'predict' || q.kind === 'spot' || q.kind === 'fill') && (
        <div className="border-b bg-muted/40 px-4 py-3">
          <Panel title={q.kind === 'fill' ? 'spec · fill the ___' : 'spec'}>
            <CodeBlock code={JSON.stringify(q.spec, null, 2)} lang="json" maxHeight={260} showLineNumbers={false} />
          </Panel>
          {Object.keys(seed).length > 0 && (
            <Panel title="seed state (passed to the store — the renderer ignores spec.state)" className="mt-2">
              <CodeBlock code={JSON.stringify(seed, null, 2)} lang="json" maxHeight={140} showLineNumbers={false} />
            </Panel>
          )}
        </div>
      )}

      <ul className="divide-y">
        {q.options.map((opt, i) => {
          const isPicked = picked === i;
          const isRight = i === q.answer;
          return (
            <li key={opt}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onPick(i)}
                className={cn(
                  'flex w-full items-baseline gap-3 px-4 py-2.5 text-left transition-colors',
                  !locked && 'hover:bg-surface',
                  locked && isRight && 'bg-emerald-50 dark:bg-emerald-950',
                  locked && isPicked && !isRight && 'bg-red-50 dark:bg-red-950',
                )}
              >
                <span className="mt-px shrink-0 font-mono text-[11px] uppercase text-muted-foreground">
                  {String.fromCharCode(97 + i)}
                </span>
                <span className="min-w-0 flex-1 text-[14px] leading-snug text-foreground">{opt}</span>
                {locked && isRight && <Pill tone="ok">correct</Pill>}
                {locked && isPicked && !isRight && <Pill tone="bad">your answer</Pill>}
              </button>
            </li>
          );
        })}
      </ul>

      {locked && (
        <div className="border-t bg-muted/40 px-4 py-3">
          <p className="text-[14px] leading-relaxed text-muted-foreground">{q.explain}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StepRef slug={q.step} />
            <Link
              href={`/reference#${q.ref}`}
              className="rounded-sm border bg-surface px-1 py-px font-mono text-[12px] text-muted-foreground no-underline transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              reference#{q.ref}
            </Link>
          </div>

          {q.kind === 'spot' && (
            <Panel title="the real validateSpec, run on that spec" className="mt-3">
              <CodeBlock
                code={JSON.stringify(validateSpec(q.spec, { checkOrphans: Boolean(q.checkOrphans) }), null, 2)}
                lang="json"
                maxHeight={260}
                showLineNumbers={false}
              />
            </Panel>
          )}

          {liveSpec &&
            (revealed ? (
              <Panel title="the real render · demoRegistry" className="mt-3" bodyClassName="p-4">
                <div key={`${q.id}-${picked}`}>
                  <JSONUIProvider registry={demoRegistry} initialState={seed}>
                    <Renderer spec={liveSpec} registry={demoRegistry} fallback={UnknownComponent} />
                  </JSONUIProvider>
                </div>
              </Panel>
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed px-3 py-2">
                <span className="text-[13px] text-muted-foreground">
                  Do not take our word for it{q.kind === 'fill' ? ' — your option is substituted verbatim.' : '.'}
                </span>
                <span className="ml-auto">
                  <ActionButton onClick={() => setRevealed(true)}>reveal what renders</ActionButton>
                </span>
              </div>
            ))}
        </div>
      )}
    </article>
  );
}

function ScoreScreen({
  questions,
  answers,
  score,
  total,
  onRetake,
  nextHref,
  nextLabel,
}: {
  questions: Question[];
  answers: Record<string, number>;
  score: number;
  total: number;
  onRetake: () => void;
  nextHref: string | null;
  nextLabel: string | null;
}) {
  const pct = Math.round((score / total) * 100);
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline gap-3 rounded-lg border bg-card px-4 py-4">
        <span className="font-display text-[40px] leading-none tracking-tight text-foreground">
          {score}
          <span className="text-muted-foreground">/{total}</span>
        </span>
        <span className="font-mono text-[12px] uppercase tracking-wide text-muted-foreground">{pct}%</span>
        <span className="min-w-0 flex-1 text-[14px] text-muted-foreground">
          {pct === 100
            ? 'Nothing left to catch you out here. Move on.'
            : pct >= 70
              ? 'Solid. Re-read the ones you missed — they are the ones that cost a day later.'
              : 'Go back through the labs for this group before the next one; these compound.'}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border">
        {questions.map((q, i) => {
          const ok = answers[q.id] === q.answer;
          return (
            <div key={q.id} className={cn('flex items-baseline gap-3 bg-surface px-3 py-2', i > 0 && 'border-t')}>
              <span className="w-5 shrink-0 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
              <Pill tone={ok ? 'ok' : 'bad'}>{ok ? 'right' : 'wrong'}</Pill>
              <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-foreground">{q.prompt.split('\n')[0]}</span>
              <span className="hidden shrink-0 sm:block">
                <StepRef slug={q.step} short />
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ActionButton onClick={onRetake}>retake</ActionButton>
        <Link
          href="/path"
          className="rounded-md border bg-surface px-2.5 py-1 font-mono text-[12px] text-muted-foreground no-underline transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          ← back to the path
        </Link>
        {nextHref && (
          <Link
            href={nextHref}
            className="rounded-md border bg-surface px-2.5 py-1 font-mono text-[12px] text-muted-foreground no-underline transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            next checkpoint · {nextLabel} →
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Deterministic per-question option shuffle. A Fisher-Yates walk driven by a
 * string hash of the question id: same order every render, every retake and
 * every visitor, so a wrong answer can be talked about — but not the same
 * position every time.
 */
function permute(q: Question): Question {
  let h = 2166136261;
  for (let i = 0; i < q.id.length; i++) {
    h ^= q.id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 1 | h);
    h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const options = order.map((i) => q.options[i]);
  const answer = order.indexOf(q.answer);
  if (q.kind === 'fill') return { ...q, options, answer, fills: order.map((i) => q.fills[i]) };
  return { ...q, options, answer };
}

/**
 * Replace every occurrence of the "___" placeholder with the chosen option.
 * Structural clone; the question data is never mutated.
 */
function substitute(spec: Spec, fill: string): Spec {
  let value: unknown;
  try {
    value = JSON.parse(fill);
  } catch {
    value = fill;
  }
  const walk = (node: unknown): unknown => {
    if (node === FILL) return value;
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, walk(v)]));
    }
    return node;
  };
  return walk(spec) as Spec;
}
