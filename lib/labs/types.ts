import type { Spec } from '@json-render/core';
import type { ChecklistItem } from '@/components/lab/checklist';
import type { Task, TaskContext, TaskSolution } from '@/components/lab/task-list';

/**
 * What the learner does on a stage.
 *
 * The same three levels of help the old strips offered, in the order that
 * gives away the least: the goal, then the rule (`hint`), then the
 * click-by-click (`steps`), then the finished answer (`solution`). `apply`
 * exists for labs that are not spec-driven, where "do it for me" means
 * flipping a switch rather than loading JSON.
 */
export interface StagePart {
  goal: React.ReactNode;
  hint?: React.ReactNode;
  steps?: React.ReactNode[];
  solution?: TaskSolution;
  apply?: { label?: string; run: () => void };
  /** Bespoke labs: completion the lab worked out itself. */
  done?: boolean;
  /** Spec-driven labs: completion checked live against the playground. */
  check?: (ctx: TaskContext) => boolean;
}

/**
 * One STAGE of a lab.
 *
 * A stage is the unit the concept strip already implied but never enforced:
 * one idea, one thing to do, and the whole setup as it stands when you arrive.
 *
 * For a SPEC-DRIVEN lab, `spec` and `seed` are complete snapshots, never
 * fragments — arriving at a stage puts the editor into exactly that state, so
 * a learner who wandered off experimenting in stage two starts stage three
 * from the right place rather than from their own mess. The chain is
 * cumulative: `stages[i].assignment.solution.spec` IS `stages[i + 1].spec`.
 * Write them as the same constant and the two cannot drift.
 *
 * For a BESPOKE lab (its own instrument rather than a spec editor) there is no
 * snapshot to load and no spec to check. Those labs leave `spec`/`check` unset
 * and hand `StageFrame` a `done` array they compute themselves, exactly as
 * they used to hand `Checklist` a `done` flag per item.
 */
export interface Stage {
  id: string;
  /** The one idea, in three or four words. Always shown, as the stage heading. */
  title: string;
  /** Concept id from `lib/concepts` — the "before you start" chip, promoted to this stage's lesson. */
  concept?: string;
  /** Further concepts worth having to hand here. */
  also?: string[];
  /** Stage-local teaching text, for a stage no concept covers yet. */
  summary?: React.ReactNode;
  /**
   * The json-render feature this stage teaches, as a `/reference` anchor.
   *
   * Every stage must name a real feature — through `concept`, through `ref`,
   * or both. `scripts/check-stages.ts` fails the build otherwise, because a
   * stage that names no feature is almost always a permutation of the one
   * before it rather than a thing of its own.
   */
  ref?: string;
  /** Further reference entries this stage genuinely covers, beyond `ref`. */
  refs?: string[];
  /**
   * WHEN you reach for this feature, and when you should not.
   *
   * Knowing what a thing does is half of it; the half people actually get
   * wrong is knowing when it is the right tool. This is the place for "use it
   * for X, not for Y — for Y use Z", and it is deliberately separate from
   * `summary` so it cannot degrade into a restatement of what the feature is.
   */
  when?: React.ReactNode;
  /**
   * What the lab should SHOW for this stage.
   *
   * A stage teaches one feature, so the body beside it has to be that feature
   * and nothing else — a learner on the `children` stage should not be reading
   * past `props`, `bindings` and `slots` to find it. Labs interpret this key
   * themselves: an instrument scopes to one field, a spec lab to one pane.
   */
  focus?: string;
  /** Spec-driven labs: only the panes this stage needs, overriding the lab's default. */
  panes?: Array<'tree' | 'spec' | 'state' | 'log' | 'catalog' | 'impl' | 'wiring'>;
  /** Spec-driven labs: the complete spec on arrival. */
  spec?: Spec;
  /** Spec-driven labs: the complete state seed on arrival. */
  seed?: Record<string, unknown>;
  /**
   * What to do here, in order.
   *
   * One stage is one FEATURE; its parts are the steps that demonstrate it. Two
   * parts beat two stages whenever the second is the same feature seen from
   * the other side — shrinking a catalog and putting it back is one lesson
   * about `catalog.prompt()`, not two.
   */
  parts: StagePart[];
}

export interface LabScript {
  /** Step slug from `lib/steps.ts`. */
  slug: string;
  stages: Stage[];
}

/** A stage of a spec-driven lab, where the snapshot and the check are guaranteed. */
export interface SpecStage extends Stage {
  spec: Spec;
  seed: Record<string, unknown>;
}

export interface SpecLabScript extends LabScript {
  stages: SpecStage[];
}

/** The lesson half of a stage: everything the task itself does not already say. */
export interface StageMeta {
  title: string;
  concept?: string;
  also?: string[];
  summary?: React.ReactNode;
  ref?: string;
  refs?: string[];
  when?: React.ReactNode;
  focus?: string;
  panes?: Array<'tree' | 'spec' | 'state' | 'log' | 'catalog' | 'impl' | 'wiring'>;
  /** How many of the lab's tasks this one feature takes. Defaults to 1. */
  tasks?: number;
  /** The complete spec on arrival — normally the previous task's solution. */
  spec: Spec;
  seed?: Record<string, unknown>;
}

/**
 * Zip a lab's existing `Task[]` with per-stage lesson metadata.
 *
 * Every lab already carries its goals, hints, click-by-click steps and
 * solutions; what staging adds is a heading, the concept being taught, and the
 * snapshot to arrive at. Pairing the two beats copying the prose into a new
 * file — the task text keeps exactly one home, so it cannot drift, and a
 * conversion is a dozen lines rather than several hundred.
 *
 * `meta[i]` pairs with `tasks[i]`, so the two arrays must be the same length.
 */
/**
 * The same zip for a lab that is not spec-driven.
 *
 * A `ChecklistItem` already carries the label, hint, steps and "do it for me"
 * button; it computes `done` itself, which is why the resulting stages have no
 * `check` and the lab hands `StageFrame` the flags separately.
 */
export function stagesFromChecklist(
  items: ChecklistItem[],
  meta: Array<Omit<StageMeta, 'spec' | 'seed'> & { id: string }>,
): Stage[] {
  const want = meta.reduce((n, m) => n + (m.tasks ?? 1), 0);
  if (items.length !== want) {
    throw new Error(`stagesFromChecklist: ${items.length} items but the stages ask for ${want}`);
  }
  let at = 0;
  return meta.map((m) => {
    const mine = items.slice(at, at + (m.tasks ?? 1));
    at += mine.length;
    return {
      id: m.id,
      title: m.title,
      concept: m.concept,
      also: m.also,
      summary: m.summary,
      ref: m.ref,
      refs: m.refs,
      when: m.when,
      focus: m.focus,
      panes: m.panes,
      parts: mine.map((item) => ({
        goal: item.label,
        hint: item.hint,
        steps: item.steps,
        apply: item.apply,
        done: item.done,
      })),
    };
  });
}

export function stagesFromTasks(tasks: Task[], meta: StageMeta[], seed: Record<string, unknown> = {}): SpecStage[] {
  const want = meta.reduce((n, m) => n + (m.tasks ?? 1), 0);
  if (tasks.length !== want) {
    throw new Error(`stagesFromTasks: ${tasks.length} tasks but the stages ask for ${want}`);
  }
  let at = 0;
  return meta.map((m) => {
    const mine = tasks.slice(at, at + (m.tasks ?? 1));
    at += mine.length;
    return {
      id: mine[0].id,
      title: m.title,
      concept: m.concept,
      also: m.also,
      summary: m.summary,
      ref: m.ref,
      refs: m.refs,
      when: m.when,
      focus: m.focus,
      panes: m.panes,
      spec: m.spec,
      seed: m.seed ?? seed,
      parts: mine.map((task) => ({
        goal: task.goal,
        hint: task.hint,
        steps: task.steps,
        solution: task.solution,
        check: task.check,
      })),
    };
  });
}

export interface SpecChange {
  key: string;
  kind: 'added' | 'changed' | 'removed';
}

/**
 * Which elements differ between two consecutive stages.
 *
 * Element-granular rather than line-granular on purpose: the spec pane is a
 * JSON editor the learner is about to retype, so "card and city changed" is
 * actionable in a way that "lines 40-58" is not. The line-level machinery in
 * `scripts/gen-tutorial-source.ts` stays where it belongs, on whole files.
 */
export function specChanges(prev: Spec | null | undefined, next: Spec | null | undefined): SpecChange[] {
  if (!prev || !next) return [];
  const before = prev.elements ?? {};
  const after = next.elements ?? {};
  const out: SpecChange[] = [];

  for (const key of Object.keys(after)) {
    if (!(key in before)) out.push({ key, kind: 'added' });
    else if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) out.push({ key, kind: 'changed' });
  }
  for (const key of Object.keys(before)) {
    if (!(key in after)) out.push({ key, kind: 'removed' });
  }
  return out;
}
