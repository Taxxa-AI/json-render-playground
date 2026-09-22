'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GROUPS, PAGES, STEPS } from '@/lib/steps';

type Theme = 'light' | 'dark' | 'system';

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    setTheme((localStorage.getItem('jr-theme') as Theme) ?? 'system');
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    localStorage.setItem('jr-theme', next);
    const dark = next === 'dark' || (next === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5">
      {(['light', 'system', 'dark'] as Theme[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => apply(t)}
          className={`flex-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors ${
            theme === t ? 'bg-surface-hover text-foreground' : 'text-muted-foreground hover:bg-surface'
          }`}
        >
          {t === 'system' ? 'auto' : t}
        </button>
      ))}
    </div>
  );
}

export function Sidebar({ hasKey }: { hasKey: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-5">
      <Link
        href="/"
        onClick={() => setOpen(false)}
        className={`rounded-md px-2.5 py-1.5 text-[14px] transition-colors ${
          pathname === '/' ? 'bg-surface-hover font-medium text-foreground' : 'text-muted-foreground hover:bg-surface'
        }`}
      >
        Setup &amp; overview
      </Link>

      <div className="flex flex-col gap-px">
        {PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            onClick={() => setOpen(false)}
            className={`relative flex items-center gap-2.5 rounded-md px-2.5 py-1 text-[14px] transition-colors ${
              pathname === p.href || pathname.startsWith(`${p.href}/`)
                ? 'bg-surface-hover text-foreground'
                : 'text-muted-foreground hover:bg-surface'
            }`}
          >
            {(pathname === p.href || pathname.startsWith(`${p.href}/`)) && (
              <span className="absolute left-0 h-4 w-[3px] rounded-full bg-orange-500" aria-hidden />
            )}
            <span className="w-4 shrink-0 text-right font-mono text-[11px] text-muted-foreground">§</span>
            <span className="truncate">{p.title}</span>
          </Link>
        ))}
      </div>

      {GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-px">
          <div className="px-2.5 pb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{group}</div>
          {STEPS.filter((s) => s.group === group).map((s) => {
            const active = pathname === `/steps/${s.slug}`;
            return (
              <Link
                key={s.slug}
                href={`/steps/${s.slug}`}
                onClick={() => setOpen(false)}
                className={`relative flex items-center gap-2.5 rounded-md px-2.5 py-1 text-[14px] transition-colors ${
                  active ? 'bg-surface-hover text-foreground' : 'text-muted-foreground hover:bg-surface'
                }`}
              >
                {/* One orange moment: the active rail. */}
                {active && (
                  <span className="absolute left-0 h-4 w-[3px] rounded-full bg-orange-500" aria-hidden />
                )}
                <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {s.n}
                </span>
                <span className="truncate">{s.title}</span>
                {s.needsKey && !hasKey && (
                  <span title="Needs AI_GATEWAY_API_KEY" className="ml-auto font-mono text-[10px] text-yellow-600 dark:text-yellow-400">
                    key
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/90 px-4 py-2 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border bg-surface px-2 py-0.5 font-mono text-[12px] text-muted-foreground"
        >
          {open ? 'close' : 'labs'}
        </button>
        <span className="font-mono text-[12px] text-muted-foreground">json-render</span>
      </div>
      {open && <div className="border-b bg-card px-4 py-4 lg:hidden">{nav}</div>}

      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-[252px] shrink-0 flex-col overflow-y-auto border-r bg-card px-3 py-5 lg:flex">
        <div className="mb-5 px-2.5">
          <div className="font-mono text-[14px] font-medium text-foreground">json-render</div>
          <div className="font-mono text-[11px] text-muted-foreground">playground · v0.20</div>
        </div>

        {nav}

        <div className="mt-auto flex flex-col gap-2 border-t px-2.5 pt-4">
          <ThemeToggle />
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className={`size-1.5 rounded-full ${hasKey ? 'bg-emerald-500' : 'bg-yellow-500'}`} aria-hidden />
            <span className="text-muted-foreground">{hasKey ? 'gateway key set' : 'no gateway key'}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
