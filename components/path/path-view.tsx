'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Pill } from '@/components/playground/ui';
import { formatMinutes, type PathGroup, type Track, type TrackId } from '@/lib/path';
import { setStepDone, setTrack, useProgress } from '@/lib/progress';
import { cn } from '@/lib/utils';

/**
 * The interactive half of /path: pick a goal, then tick your way down it.
 *
 * All data arrives as plain props from the server page — nothing here imports
 * `lib/steps.ts`, so the numbers, minutes and blurbs have exactly one source.
 */
export function PathView({
  tracks,
  groups,
  initialTrack,
  pinned,
  hasKey,
}: {
  tracks: Track[];
  groups: PathGroup[];
  initialTrack: TrackId;
  /** True when the URL carried an explicit ?track= — it then beats the stored one. */
  pinned: boolean;
  hasKey: boolean;
}) {
  const progress = useProgress();
  const [active, setActive] = useState<TrackId>(initialTrack);

  // With no ?track= in the URL, restore the last track the learner picked.
  // In an effect, not in the initial state, so SSR and hydration agree.
  useEffect(() => {
    if (pinned) return;
    const stored = progress.track;
    if (stored && tracks.some((t) => t.id === stored)) setActive(stored as TrackId);
    // Only on the first snapshot that carries a track.
  }, [pinned, progress.track, tracks]);

  const track = tracks.find((t) => t.id === active) ?? tracks[0];
  const inTrack = new Set(track.slugs);

  function choose(id: TrackId) {
    setActive(id);
    setTrack(id);
    try {
      window.history.replaceState(null, '', `/path?track=${id}`);
    } catch {
      /* history is unavailable in some embedded contexts */
    }
  }

  return (
    <>
      <section className="mt-9">
        <h2 className="font-mono text-[12px] uppercase tracking-wide text-muted-foreground">Pick your goal</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {tracks.map((t) => {
            const done = t.slugs.filter((s) => progress.done[s]).length;
            const keyed = t.slugs.filter((s) => groups.flatMap((g) => g.steps).find((x) => x.slug === s)?.needsKey);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => choose(t.id)}
                className={cn(
                  'flex flex-col rounded-lg border bg-card p-3.5 text-left transition-colors',
                  t.id === active ? 'border-orange-500 bg-surface' : 'hover:bg-surface',
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    track {t.id}
                  </span>
                  {t.id === active && <Pill tone="ok">selected</Pill>}
                </div>
                <div className="mt-1 font-mono text-[15px] text-foreground">{t.title}</div>
                <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{t.who}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Stat>{t.slugs.length} labs</Stat>
                  <Stat>{formatMinutes(minutes(groups, t.slugs))}</Stat>
                  {keyed.length > 0 && !hasKey && (
                    <span className="rounded-sm border border-yellow-200 bg-yellow-50 px-1 py-px font-mono text-[10px] uppercase text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300">
                      {keyed.length} need a key
                    </span>
                  )}
                </div>
                <ProgressBar done={done} total={t.slugs.length} />
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">Track {track.id}:</strong> {track.outcome}
        </p>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-mono text-[12px] uppercase tracking-wide text-muted-foreground">
            The path · {track.slugs.length} labs · {formatMinutes(minutes(groups, track.slugs))}
          </h2>
          <span className="font-mono text-[11px] text-muted-foreground">
            {track.slugs.filter((s) => progress.done[s]).length} / {track.slugs.length} done
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-5">
          {groups.map((g) => {
            const mine = g.steps.filter((s) => inTrack.has(s.slug));
            const score = progress.checkpoints[g.slug];
            return (
              <div key={g.slug}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-mono text-[14px] text-foreground">{g.group}</h3>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">{g.blurb}</span>
                </div>

                <div className="mt-2 overflow-hidden rounded-lg border">
                  {g.steps.map((s, i) => {
                    const off = !inTrack.has(s.slug);
                    const done = Boolean(progress.done[s.slug]);
                    return (
                      <div
                        key={s.slug}
                        className={cn(
                          'flex items-baseline gap-3 bg-surface px-3 py-2',
                          i > 0 && 'border-t',
                          off && 'opacity-45',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={(e) => setStepDone(s.slug, e.target.checked)}
                          aria-label={`Mark ${s.title} done`}
                          className="mt-1 size-3.5 shrink-0 accent-orange-500"
                        />
                        <span className="w-5 shrink-0 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                          {String(s.n).padStart(2, '0')}
                        </span>
                        <Link
                          href={`/steps/${s.slug}`}
                          className={cn(
                            'min-w-0 flex-1 truncate font-mono text-[14px] text-foreground no-underline hover:underline sm:w-[32%] sm:flex-none sm:shrink-0',
                            done && 'text-muted-foreground line-through',
                          )}
                        >
                          {s.title}
                        </Link>
                        <span className="hidden min-w-0 flex-1 text-[13.5px] leading-snug text-muted-foreground sm:block">
                          {s.does}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {s.minutes}m
                        </span>
                        {s.needsKey && (
                          <span
                            title="Needs AI_GATEWAY_API_KEY"
                            className="shrink-0 rounded-sm border border-yellow-200 bg-yellow-50 px-1 py-px font-mono text-[10px] uppercase text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300"
                          >
                            key
                          </span>
                        )}
                      </div>
                    );
                  })}

                  <Link
                    href={`/checkpoints/${g.slug}`}
                    className="flex items-center gap-3 border-t bg-muted px-3 py-2 transition-colors hover:bg-surface-hover"
                  >
                    <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      checkpoint
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                      {mine.length} lab{mine.length === 1 ? '' : 's'} on your track — prove you can use them.
                    </span>
                    {score ? (
                      <Pill tone={score.score === score.total ? 'ok' : score.score * 2 >= score.total ? 'warn' : 'bad'}>
                        {score.score}/{score.total}
                      </Pill>
                    ) : (
                      <Pill tone="idle">not taken</Pill>
                    )}
                    <span className="font-mono text-[12px] text-muted-foreground">→</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function Stat({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm border bg-muted px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-orange-500 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}

function minutes(groups: PathGroup[], slugs: string[]) {
  const all = new Map(groups.flatMap((g) => g.steps).map((s) => [s.slug, s.minutes]));
  return slugs.reduce((n, s) => n + (all.get(s) ?? 0), 0);
}
