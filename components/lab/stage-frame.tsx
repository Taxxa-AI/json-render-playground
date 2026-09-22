'use client';

import { useEffect, useRef, useState } from 'react';
import type { Stage } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';
import { StageRail } from './stage-rail';

/**
 * The staged shell for a lab that is NOT spec-driven.
 *
 * `SpecPlayground` stages itself, because it owns the spec, the store and the
 * log that a stage's `check` runs against. Every other lab is its own
 * instrument — a REPL, a truth table, two registries side by side — so it
 * keeps computing its own completion, exactly as it did for `Checklist`, and
 * only borrows the lesson column.
 *
 * The render prop hands the lab the stage it is on, so an instrument can scope
 * itself to the one thing that stage teaches instead of showing all seven tabs
 * at once.
 */
export function StageFrame({
  slug,
  stages,
  onStageChange,
  children,
}: {
  slug: string;
  stages: Stage[];
  /**
   * Called when the learner moves to a stage, from the click that moves them —
   * so a lab can scope its instrument to that stage (switch a tab, load a
   * preset) instead of asking them to go and find it.
   */
  onStageChange?: (stage: Stage, index: number) => void;
  children: (stage: Stage, index: number) => React.ReactNode;
}) {
  const [index, setIndex] = useState(useInitialStage(stages.length));

  function go(next: number) {
    setIndex(next);
    onStageChange?.(stages[next], next);
  }

  /**
   * Scope the lab to the FIRST stage too.
   *
   * `go` only runs when the learner navigates, so without this the lab opens
   * showing whatever pane its own state defaulted to, which is only correct by
   * accident when stage one happens to live in that pane.
   */
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    onStageChange?.(stages[index], index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row lg:gap-4">
      <StageRail slug={slug} stages={stages} index={index} onGo={go} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">{children(stages[index], index)}</div>
    </div>
  );
}
