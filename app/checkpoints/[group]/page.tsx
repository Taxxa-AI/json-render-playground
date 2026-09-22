import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckpointQuiz } from '@/components/checkpoint/quiz';
import { StepRef } from '@/components/shell/step-ref';
import { quizFor } from '@/lib/checkpoints';
import { GROUP_SLUG, GROUP_SLUGS, groupFromSlug, nextGroup } from '@/lib/path';
import { GROUP_BLURB, stepsInGroup } from '@/lib/steps';

/** Next 16: params is a promise on both the page and generateMetadata. */
type Params = { params: Promise<{ group: string }> };

export function generateStaticParams() {
  return GROUP_SLUGS.map((group) => ({ group }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { group } = await params;
  const g = groupFromSlug(group);
  return {
    title: g ? `Checkpoint · ${g}` : 'Checkpoint',
    description: g ? GROUP_BLURB[g] : undefined,
  };
}

export default async function CheckpointPage({ params }: Params) {
  const { group } = await params;
  const g = groupFromSlug(group);
  const quiz = quizFor(group);
  if (!g || !quiz) notFound();

  const steps = stepsInGroup(g);
  const after = nextGroup(g);

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-10 sm:px-5 lg:px-10 lg:py-12">
      <Link
        href="/path"
        className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground no-underline hover:text-foreground"
      >
        ← the path
      </Link>
      <h1 className="mt-2 font-display text-[36px] leading-[1.1] tracking-tight text-foreground">
        Checkpoint · {g}
      </h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{quiz.intro}</p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">covers</span>
        {steps.map((s) => (
          <StepRef key={s.slug} slug={s.slug} />
        ))}
      </div>

      <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
        {quiz.questions.length} questions. Every answer was checked against the installed library, and the ones that
        show a spec render it — or validate it — for real once you have answered. Guessing is cheap; retaking is
        free.
      </p>

      <CheckpointQuiz
        quiz={quiz}
        nextHref={after ? `/checkpoints/${GROUP_SLUG[after]}` : null}
        nextLabel={after ?? null}
      />
    </div>
  );
}
