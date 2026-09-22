import { ListsLab } from '@/components/lab/lists-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';

export default function Page() {
  return (
    <StepPage
      slug="lists"
      lab={<ListsLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        Six tasks: plain list → filtered list → editable rows → list of lists. Watch the{' '}
        <strong>tree</strong> tab — repeat containers show their live item count.
      </p>


      <Code lang="json" title="everything repeat gives you">{`{ "repeat": { "statePath": "/invoices", "key": "id" }, "children": ["row"] }

{ "$item": "client" }     // a field on the current item
{ "$item": "" }           // the whole item object
{ "$index": true }        // zero-based position
{ "$bindItem": "note" }   // TWO-WAY into the current item's field
{ "$template": "\${client} owes \${amount}" }   // bare names hit the item first

// FILTERED: repeat + an $item condition on the SAME element.
{ "repeat": {…}, "visible": { "$item": "status", "eq": "unpaid" } }

// NESTED: an array on the enclosing item.
{ "repeat": { "statePath": { "$item": "lines" }, "key": "sku" } }

// Remove by position, from inside a row.
{ "action": "removeState", "params": { "statePath": "/invoices", "index": { "$index": true } } }`}</Code>

      <Facts
        rows={[
          { k: 'the container renders once', v: 'Its children are expanded once per item. One definition, N renders.' },
          { k: 'no filter field', v: <>Filtering is <code key="a">repeat</code> + an <code key="b">$item</code> condition on one element. The renderer splits it: <code key="c">$item</code> conjuncts pick items, <code key="d">$state</code> conjuncts gate the container.</> },
          { k: <code key="e">key</code>, v: 'A field name for React keys. Omit it and you get index keys.' },
        ]}
      />

      <Gotchas>
        <Gotcha>A missing or non-array path renders zero children — identical to a bug elsewhere. <code>repeat_state_mismatch</code>.</Gotcha>
        <Gotcha>A repeat with no children does nothing. <code>repeat_without_children</code>.</Gotcha>
        <Gotcha>A relative <code>{'{"$item": …}'}</code> statePath outside a repeat: <code>repeat_item_outside_scope</code>.</Gotcha>
        <Gotcha>No <code>key</code> → index keys → deleting a middle row reuses the wrong component instance. The last task reproduces it.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
