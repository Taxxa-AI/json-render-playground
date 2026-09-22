import type { Metadata } from 'next';
import Link from 'next/link';
import { QUIZZES } from '@/lib/checkpoints';
import { GROUP_SLUG } from '@/lib/path';
import { GROUPS, GROUP_BLURB } from '@/lib/steps';

export const metadata: Metadata = {
  title: 'Checkpoints · json-render playground',
  description: 'One quiz per group. Every answer verified against the installed library.',
};

/** An index, so /checkpoints is not a dead end. The path page is the real entry. */
export default function CheckpointsIndex() {
  const totalQuestions = Object.values(QUIZZES).reduce((n, q) => n + q.questions.length, 0);

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-10 sm:px-5 lg:px-10 lg:py-12">
      <h1 className="font-display text-[36px] leading-[1.1] tracking-tight text-foreground">Checkpoints</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        One quiz per group, {totalQuestions} questions in all. They are answerable from the labs and nowhere else, and
        the ones that show a spec render or validate it for real after you answer.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border">
        {GROUPS.map((g, i) => {
          const slug = GROUP_SLUG[g];
          const quiz = QUIZZES[slug];
          return (
            <Link
              key={slug}
              href={`/checkpoints/${slug}`}
              className={`flex items-baseline gap-3 bg-surface px-3 py-2.5 transition-colors hover:bg-surface-hover ${
                i > 0 ? 'border-t' : ''
              }`}
            >
              <span className="w-[26%] shrink-0 font-mono text-[14px] text-foreground">{g}</span>
              <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-muted-foreground">{GROUP_BLURB[g]}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {quiz?.questions.length ?? 0} q
              </span>
            </Link>
          );
        })}
      </div>

      <p className="mt-5 text-[14px] text-muted-foreground">
        <Link href="/path" className="underline underline-offset-2 hover:text-foreground">
          The path
        </Link>{' '}
        tracks which ones you have taken.
      </p>
    </div>
  );
}
