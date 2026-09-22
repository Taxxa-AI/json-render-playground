import { ConditionTester } from '@/components/lab/condition-tester';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="conditions"
      lab={<ConditionTester />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        <code>visible</code> is the only branching a spec has. The lab takes one way of defining a condition per
        stage, on a tree you can operate: the condition sits on a real element, the controls beside it write the
        state that condition reads, and the element leaves the page when it goes false.
      </p>


      <Code lang="json" title="the complete grammar">{`{ "$state": "/path" }                  // truthy
{ "$state": "/path", "not": true }     // falsy — "not" inverts any form
{ "$state": "/path", "eq": "active" }  // also neq, gt, gte, lt, lte
{ "$item":  "status", "eq": "unpaid" } // a field on the current repeat item
{ "$index": true, "gt": 0 }            // the current repeat index

[ condA, condB ]                        // implicit AND
{ "$and": [ condA, condB ] }            // explicit AND (needed inside $or)
{ "$or":  [ condA, condB ] }            // OR
true / false                            // always / never

// The first-tab idiom: visible before anything has been clicked.
{ "$or": [ { "$state": "/tab", "eq": "home" },
           { "$state": "/tab", "not": true } ] }`}</Code>

      <Facts
        rows={[
          { k: 'one operator per object', v: <>Multiple? Only the first wins, by <code key="a">eq &gt; neq &gt; gt &gt; gte &gt; lt &gt; lte</code>. No operator at all = a truthiness test.</> },
          { k: 'one scope per object', v: <><code key="b">$state</code> <em>or</em> <code key="c">$item</code> <em>or</em> <code key="d">$index</code> — never two. Compose with <code key="e">$and</code>/<code key="f">$or</code>.</> },
          { k: 'hidden means absent', v: 'Not display:none. Children never mount, effects never run — but bound state keeps its last value.' },
          { k: 'numeric only', v: <><code key="k">gt/gte/lt/lte</code> return false unless <em key="l">both</em> sides are numbers — comparing a string always hides.</> },
          { k: 'helpers', v: <><code key="g">visibility.when/unless/eq/neq/gt/gte/lt/lte/and/or/always/never</code></> },
        ]}
      />

      <Gotchas>
        <Gotcha>A malformed condition is <strong>not an error, and not reliably hidden either</strong>. An unknown
            operator is ignored and the condition degrades to a truthiness test, so{' '}
            <code>{'{ "$state": "/count", "greaterThan": 4 }'}</code> becomes &ldquo;count is truthy&rdquo;. An object
            with no <code>$</code>-key — <code>{'{ "status": "active" }'}</code>, or even <code>{'{}'}</code> — tests
            the whole state model and is <em>always visible</em>. A typo&rsquo;d <code>$</code> <em>with</em> an
            operator compares that model to a number and is always false. Four shapes, four different wrong
            answers.</Gotcha>
        <Gotcha>A <code>visible</code> that is <code>null</code>, a string or a number does not degrade — it{' '}
            <strong>throws</strong>, out of <code>evaluateVisibility</code> and through your render. Only{' '}
            <code>true</code> and <code>false</code> are valid non-object conditions.</Gotcha>
        <Gotcha><code>validateSpec</code> is the only thing that catches those, as <code>invalid_visible</code>. Run
            it over every generated spec — <StepRef slug="repair" />.</Gotcha>
        <Gotcha>An element with <code>repeat</code> splits its condition: <code>$item</code> conjuncts filter the
            items, the rest gate the container. An <code>$or</code> that mixes the two scopes cannot be split, so the
            whole thing runs per item and the container can no longer be hidden by it. <StepRef slug="lists" />.</Gotcha>
        <Gotcha>Hiding a form section does not clear the answers underneath it. You cannot rely on unmounting to reset
            anything — and an unmounted field is invisible to <code>validateForm</code>.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
