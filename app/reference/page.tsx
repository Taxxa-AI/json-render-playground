import type { Metadata } from 'next';
import { ReferenceExplorer } from '@/components/reference/explorer';
import { StepRef } from '@/components/shell/step-ref';
import { REFERENCE_ENTRIES, categorySlug, coverage } from '@/lib/reference';

export const metadata: Metadata = {
  title: 'Reference · json-render playground',
  description: 'Every field, expression, operator, action, hook, provider and utility in json-render 0.20.0 — each with a live, editable example.',
};

/**
 * The map the labs do not give you.
 *
 * A lab teaches one idea properly. This page answers "what can I even say
 * here", for the whole 0.20.0 surface, and every answer is checkable: spec
 * entries render a spec you can edit, utility entries call the real function
 * in your browser.
 */
export default function ReferencePage() {
  const rows = coverage();
  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      live: acc.live + r.live,
      failures: acc.failures + r.failures,
      runs: acc.runs + r.runs,
    }),
    { total: 0, live: 0, failures: 0, runs: 0 },
  );

  return (
    <article className="mx-auto w-full max-w-[1760px] px-5 py-8 lg:px-10 lg:py-10">
      <header className="mb-6 border-b pb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[30px] leading-tight tracking-tight text-foreground">Reference</h1>
          <span className="ml-auto hidden font-mono text-[11px] uppercase tracking-wide text-muted-foreground sm:block">
            {REFERENCE_ENTRIES.length} entries · v0.20.0
          </span>
        </div>
        <p className="mt-3 max-w-[76ch] text-[14.5px] leading-relaxed text-muted-foreground">
          Every field, expression, operator, built-in action, check, hook, provider and utility the library
          exposes, grouped by what you are trying to do. Spec-level entries carry an editable spec and render it
          live, so you can change a value and watch the result; the ones with a{' '}
          <span className="font-mono text-foreground">what goes wrong</span> toggle also render the broken version,
          because the interesting half of this library is what it does <em>not</em> tell you. Utility entries call
          the real function in your browser — the runners import the same package your app would. Every claim on
          this page was checked against the installed 0.20.0 build, not the docs. Start at{' '}
          <StepRef slug="shape" /> if you have never seen a spec.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">coverage</h2>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-muted">
                <Th className="text-left">category</Th>
                <Th>entries</Th>
                <Th>live example</Th>
                <Th>failure demo</Th>
                <Th>runnable</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.category} className="border-b last:border-b-0">
                  <Td className="text-left">
                    <a href={`#${categorySlug(r.category)}`} className="font-mono text-[12px] text-foreground no-underline">
                      {r.category}
                    </a>
                  </Td>
                  <Td>{r.total}</Td>
                  <Td dim={r.live === 0}>{r.live}</Td>
                  <Td dim={r.failures === 0}>{r.failures}</Td>
                  <Td dim={r.runs === 0}>{r.runs}</Td>
                </tr>
              ))}
              <tr className="bg-surface">
                <Td className="text-left">
                  <span className="font-mono text-[12px] text-foreground">total</span>
                </Td>
                <Td>{totals.total}</Td>
                <Td>{totals.live}</Td>
                <Td>{totals.failures}</Td>
                <Td>{totals.runs}</Td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 max-w-[76ch] text-[13px] leading-relaxed text-muted-foreground">
          The gaps are honest. Hooks, the component context and the providers are TypeScript surfaces rather than
          spec grammar, so several are documented by signature and exercised through the demo components rather
          than by a spec of their own; three streaming APIs need a server route and a model key, which this page
          deliberately does not have.
        </p>
      </section>

      <ReferenceExplorer />
    </article>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-1.5 text-right font-mono text-[10px] font-normal uppercase tracking-wide text-muted-foreground ${className ?? ''}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className, dim }: { children: React.ReactNode; className?: string; dim?: boolean }) {
  return (
    <td
      className={`px-3 py-1.5 text-right font-mono text-[12px] tabular-nums ${dim ? 'text-muted-foreground/50' : 'text-foreground'} ${className ?? ''}`}
    >
      {children}
    </td>
  );
}
