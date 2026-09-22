import { RepairLab } from '@/components/lab/repair-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';

export default function Page() {
  return (
    <StepPage
      slug="repair"
      lab={<RepairLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        Eight specs, each broken the way a model actually breaks them. Diagnose, fix by hand, then press{' '}
        <code>autoFixSpec</code> and see whether it agrees with you.
      </p>


      <Facts
        rows={[
          { k: <code key="a">missing_child</code>, v: 'children names an undefined element.' },
          { k: <><code key="b">missing_child</code> <span key="b2" className="text-muted-foreground">(slot)</span></>, v: 'Same code for a named slot — the message names the slot.' },
          { k: <code key="c">invalid_visible</code>, v: 'A condition outside the grammar. Not an error at runtime: an unknown operator degrades to a truthiness check and an object with no $-key is always visible.' },
          { k: <code key="d">repeat_without_children</code>, v: 'A repeat container with nothing to expand.' },
          { k: <code key="e">repeat_item_outside_scope</code>, v: 'A relative $item statePath with no enclosing repeat.' },
          { k: <code key="f">repeat_state_mismatch</code>, v: 'statePath does not point at an array in the spec’s own state.' },
          { k: <code key="g">visible_in_props · on_in_props · repeat_in_props · watch_in_props</code>, v: 'An element field written inside props. Inert at runtime; autoFixSpec relocates it losslessly.' },
          { k: <code key="h">missing_root · root_not_found · empty_spec</code>, v: 'No root, a root that names no element, or no elements at all. Reported early, nothing else is checked.' },
          { k: <code key="i">orphaned_element</code>, v: 'Defined but unreachable from root. A warning, and only with { checkOrphans: true } — the spec still counts as valid.' },
        ]}
      />

      <Code lang="typescript" title="a repair loop worth shipping">{`function prepare(raw: unknown, attempt: number, maxAttempts: number) {
  if (!isNonEmptySpec(raw)) return { ok: false, reason: 'empty' } as const;

  // Lossless fixes always. Withhold PRUNING until the last attempt, or you
  // silently ship a half-empty UI that looks valid.
  const lastChance = attempt >= maxAttempts;
  const { spec, fixDetails } = autoFixSpec(raw, { lossy: lastChance });

  const { valid, issues } = validateSpec(spec);
  if (!valid && !lastChance) return { ok: false, reason: 'retry', issues } as const;

  log({ fixes: fixDetails, issues });
  return { ok: true, spec } as const;
}`}</Code>

      <Gotchas>
        <Gotcha>Feed <code>issues</code> back into the retry prompt verbatim. A model told{' '}
            <em>&ldquo;Element X references child Y which does not exist&rdquo;</em> fixes it far more reliably
            than one told to try again.</Gotcha>
        <Gotcha><code>validateSpec</code> checks <em>structure</em> only. It does not check that a <code>type</code>{' '}
            exists in your registry, and it does not type-check props against your Zod schemas — so you still need
            a <code>fallback</code> and per-component guards.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
