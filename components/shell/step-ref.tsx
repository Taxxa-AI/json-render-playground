import Link from 'next/link';
import { stepBySlug } from '@/lib/steps';

/**
 * A link to another step, by slug. Renders "step 19 · Streaming".
 *
 * Always use this instead of writing "step 14" in prose — the numbers are
 * display labels and move whenever a step is added.
 */
export function StepRef({ slug, short }: { slug: string; short?: boolean }) {
  const step = stepBySlug(slug);
  if (!step) return <span className="font-mono text-[12px] text-red-600">?{slug}</span>;
  return (
    <Link
      href={`/steps/${step.slug}`}
      className="whitespace-nowrap rounded-sm border bg-surface px-1 py-px font-mono text-[12px] text-foreground no-underline transition-colors hover:bg-surface-hover"
    >
      step {step.n}
      {!short && <span className="text-muted-foreground"> · {step.title}</span>}
    </Link>
  );
}
