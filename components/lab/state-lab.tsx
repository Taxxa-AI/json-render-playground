'use client';

import { SpecPlayground } from '../playground/spec-playground';
import { STATE_LAB } from '@/lib/labs/state';

/**
 * State & binding, as five stages.
 *
 * The spec, the seed and the tasks live in `lib/labs/state.tsx` — a chain of
 * complete snapshots rather than one spec plus a task list, so every stage
 * shows the whole setup as it stands at that point. This file is just the
 * wiring.
 */
export function StateLab() {
  const first = STATE_LAB.stages[0];

  return (
    <SpecPlayground
      spec={first.spec}
      seedState={first.seed}
      // Stage one is about the state model and the write log, so the lab's
      // own default opens there too — a stage's `panes` narrows this list.
      panes={['state', 'log', 'spec', 'tree', 'catalog', 'impl']}
      height={540}
      stages={STATE_LAB.stages}
      labSlug={STATE_LAB.slug}
      hint={
        <>
          The <strong>log</strong> tab records every write with its path — it is a <code>StateStore</code> decorator,
          twenty lines, in <code>lib/demo/logging-store.ts</code>.
        </>
      }
    />
  );
}
