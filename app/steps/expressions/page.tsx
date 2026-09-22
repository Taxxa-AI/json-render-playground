import { ExpressionsLab } from '@/components/lab/expression-repl';
import { Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="expressions"
      lab={<ExpressionsLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        Six <code>$</code>-forms, resolved before your component sees a prop. The lab takes one form per stage on a
        real tree: the expression is in the spec you edit, the value it produced is in the component beside it, and
        the function that received that value is underneath.
      </p>

      <Facts
        rows={[
          { k: <code key="a">{'{ "$state": "/p" }'}</code>, v: 'One-way read. Missing path → undefined, silently.' },
          { k: <code key="b">{'{ "$bindState": "/p" }'}</code>, v: <>Two-way. <StepRef slug="state" />.</> },
          { k: <code key="c">{'{ "$cond", "$then", "$else" }'}</code>, v: 'Same grammar as visible. $then/$else may nest — and all three keys are required.' },
          { k: <code key="d">{'{ "$template": "…${/p}…" }'}</code>, v: '${/absolute} reads state; ${bare} reads the repeat item first. Missing → empty string.' },
          { k: <code key="e">{'{ "$computed": "fn", "args": {} }'}</code>, v: 'Calls a function you registered. Args resolve first.' },
          { k: <code key="f">{'{ "$item": "f" } { "$index": true }'}</code>, v: <>Inside a repeat only. <StepRef slug="lists" />.</> },
        ]}
      />

      <Gotchas>
        <Gotcha>An unknown <code>$</code>-key is <strong>not</strong> undefined — it passes through as a literal object
            with sub-expressions already resolved, and React throws on it. <StepRef slug="directives" /> turns that
            passthrough into a feature.</Gotcha>
        <Gotcha>An unknown <code>$computed</code> resolves to <code>undefined</code> and logs a console warning — the
            one place this library warns you. <code>catalog.prompt()</code> does not list your functions, so tell
            the model about them in <code>customRules</code>.</Gotcha>
        <Gotcha><code>$cond</code> needs <code>$cond</code>, <code>$then</code> <em>and</em> <code>$else</code>. Drop
            the <code>$else</code> and it stops being a conditional: the object falls through as a literal and your
            component receives <code>{'{ "$cond": …, "$then": … }'}</code>.</Gotcha>
        <Gotcha>Resolution is eager and per-render, for every visible element. Fine for forms and dashboards; not for a
            10k-row table — precompute into state and use plain <code>$state</code>.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
