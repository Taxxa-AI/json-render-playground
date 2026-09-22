import type { Metadata } from 'next';
import Link from 'next/link';
import { Code, Facts } from '@/components/playground/ui';
import { PathView } from '@/components/path/path-view';
import { GROUP_SLUG, type PathGroup, TRACKS, type TrackId, trackById } from '@/lib/path';
import { GROUPS, GROUP_BLURB, stepsInGroup } from '@/lib/steps';

export const metadata: Metadata = {
  title: 'Learning path · json-render playground',
  description: 'Three tracks through the labs, with checkpoints.',
};

export const dynamic = 'force-dynamic';

/**
 * /path — the answer to "I have four hours, what do I do?".
 *
 * A server component: it reads the key and derives every list from
 * `lib/steps.ts`, then hands plain data to one client component that owns the
 * checkboxes and the stored track.
 */
export default async function PathPage({
  searchParams,
}: {
  // Next 16: searchParams is a promise. Awaiting it opts this page into
  // request-time rendering, which is what we want — it also reads the key.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.track) ? sp.track[0] : sp.track;
  const pinned = raw === 'a' || raw === 'b' || raw === 'c';
  const initialTrack = (pinned ? raw : trackById(undefined).id) as TrackId;
  const hasKey = Boolean(process.env.AI_GATEWAY_API_KEY);

  const groups: PathGroup[] = GROUPS.map((g) => ({
    group: g,
    slug: GROUP_SLUG[g],
    blurb: GROUP_BLURB[g],
    steps: stepsInGroup(g).map((s) => ({
      slug: s.slug,
      n: s.n,
      title: s.title,
      does: s.does,
      minutes: s.minutes ?? 0,
      needsKey: Boolean(s.needsKey),
    })),
  }));

  return (
    <div className="mx-auto w-full max-w-[1760px] px-4 py-10 sm:px-5 lg:px-10 lg:py-12">
      <h1 className="font-display text-[40px] leading-[1.1] tracking-tight text-foreground">The fast path</h1>
      <div className="mt-3 max-w-3xl space-y-2 text-[15px] leading-relaxed text-muted-foreground">
        <p>
          json-render renders a JSON <em>spec</em> — a flat map of keyed elements — as React. Your{' '}
          <strong className="font-medium text-foreground">catalog</strong> declares which components may exist and what
          props they take; your <strong className="font-medium text-foreground">registry</strong> says what each one
          renders as. The spec itself is written by a model, or by your own code, or by you.
        </p>
        <p>
          That is the whole library. Everything below is detail on one of those three nouns, plus the state model they
          all read from.
        </p>
      </div>

      <Facts
        rows={[
          {
            k: 'spec',
            v: (
              <>
                <code key="s1">{'{ root, elements }'}</code> — a flat map. Children are <em>keys</em>, not nested
                objects, which is what makes a streamed UI one patch per element.
              </>
            ),
          },
          {
            k: 'catalog',
            v: (
              <>
                <code key="s2">defineCatalog</code> — Zod props plus a description per component. It is the compile-time
                contract <em>and</em> the AI system prompt.
              </>
            ),
          },
          {
            k: 'registry',
            v: (
              <>
                <code key="s3">defineRegistry</code> — one React function per catalog entry. Props arrive already
                resolved, so these are ordinary components.
              </>
            ),
          },
          {
            k: 'state',
            v: (
              <>
                One JSON-Pointer model, seeded by you. <code key="s4">$state</code> reads it;{' '}
                <code key="s5">$bindState</code> reads and writes it.
              </>
            ),
          },
        ]}
      />

      <PathView tracks={TRACKS} groups={groups} initialTrack={initialTrack} pinned={pinned} hasKey={hasKey} />

      <section className="mt-10">
        <h2 className="font-mono text-[12px] uppercase tracking-wide text-muted-foreground">How to use a lab</h2>
        <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-muted-foreground">
          Every lab opens on the interactive part, not on prose. The concept strip above it defines the terms the tasks
          are about to use; <span className="font-mono text-[13px]">notes</span> in the app bar opens the reference
          material. Do the tasks, then take the checkpoint for that group — the questions are answerable from the labs
          and nowhere else.
        </p>
        <Code lang="json" title="the smallest complete spec">{`{
  "root": "card",
  "elements": {
    "card": { "type": "Card", "props": { "title": "Q3" }, "children": ["m1"] },
    "m1":   { "type": "Metric",
              "props": { "label": "Revenue", "value": { "$state": "/revenue" } },
              "children": [] }
  }
}`}</Code>
        <div className="flex flex-wrap gap-2">
          <Sideways href="/reference" title="Reference">
            Every field, form, operator and action, live.
          </Sideways>
          <Sideways href="/cheatsheet" title="Cheat sheet">
            The whole library on one printable page.
          </Sideways>
        </div>
      </section>
    </div>
  );
}

function Sideways({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-w-[240px] flex-1 flex-col rounded-md border bg-surface px-3 py-2 transition-colors hover:bg-surface-hover"
    >
      <span className="font-mono text-[13px] text-foreground">{title}</span>
      <span className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{children}</span>
    </Link>
  );
}
