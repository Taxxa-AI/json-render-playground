import { CompilerLab } from '@/components/lab/compiler-lab';
import { Code, Facts, Gotcha, Gotchas, Takeaway } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="patterns"
      lab={<CompilerLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        The highest-value production use of json-render usually involves no model at all. A spec your own code
        produces is deterministic, snapshot-testable and reviewable. Edit the field definitions below and watch a
        real compiler rebuild the form.
      </p>


      <Takeaway>
        Notice what you <em>cannot</em> do in that editor: write a state path. Bindings are derived from{' '}
        <code>/answers/&lt;id&gt;</code>, always. That single property is what makes it safe to point a generated
        UI at a real record — a model that invents{' '}
        <code>{'{"$bindState": "/answers/vat_number"}'}</code> is one hallucinated pointer from writing into the
        wrong field of a filing.
      </Takeaway>

      <p>
        Add a field with a new <code>section</code> and a whole card appears. Change a <code>kind</code> to{' '}
        <code>&quot;choice&quot;</code> and add <code>options</code>. Flip <code>required</code> and watch a
        validation check get compiled in. Now notice what you <em>cannot</em> do from that editor: write a state
        path by hand.
      </p>

      <Code lang="typescript" title="the compiler, verbatim from the lab">{`function buildSpec(fields: FieldDef[], title: string): Spec {
  const elements: Spec['elements'] = {};
  const sections = [...new Set(fields.map((f) => f.section))];

  elements.form = {
    type: 'Screen',
    props: { title, subtitle: \`\${fields.length} fields\` },
    children: sections.map((s) => \`section:\${s}\`),
  };

  for (const section of sections) {
    const inSection = fields.filter((f) => f.section === section);
    elements[\`section:\${section}\`] = {
      type: 'Card', props: { title: section, subtitle: null },
      children: inSection.map((f) => \`field:\${f.id}\`),
    };
    for (const f of inSection) {
      elements[\`field:\${f.id}\`] = {
        type: CONTROL_FOR[f.kind],              // exhaustive: a new kind fails to compile
        props: { label: f.label, required: f.required,
                 value: { $bindState: \`/answers/\${f.id}\` } },  // derived, never authored
        children: [],
      };
    }
  }
  return { root: 'form', elements };
}

// Test it like any pure function:
expect(buildSpec(FIELDS, 'Onboarding')).toMatchSnapshot();`}</Code>

      <h3>Four ways to ship, by risk</h3>
      <Facts
        rows={[
          { k: '1 · fixed specs', v: <>
              Compiled from your domain model. No model, no token bill, no latency. Gets you database-driven UI and
              one renderer across web and PDF. <strong>Most teams should stop here.</strong>
            </>, },
          { k: '2 · AI fills state', v: <>
              Your code owns the structure; the model produces values that pass validation into the state model.
              Failure degrades to &ldquo;a wrong value the user can see and fix&rdquo;, not &ldquo;a missing
              section&rdquo;. This is the assistive-fill pattern, and it needs a controlled store (<StepRef slug="stores" />).
            </>, },
          { k: '3 · generated, read-only', v: <>
              Ad-hoc views over data you supply. Narrow catalog, no mutating actions, no bindings into real
              records. Validate, auto-fix, cap size, render.
            </>, },
          { k: '4 · generated + actions', v: <>
              Only with server-side authorisation on every handler, an allow-list of bindable actions, and human
              confirmation for anything destructive.
            </>, },
        ]}
      />

      <Gotchas>
        <Gotcha><strong>Keys must be stable if you intend to patch.</strong> A compiler that derives keys from field
            ids (<code>field:vat</code>) gives you stable addresses; one that counts (<code>el-0</code>) does not.
            Same reason <code>nestedToFlat</code> output should not be patched.</Gotcha>
        <Gotcha><strong>Compile-time exhaustiveness is the point.</strong> Type <code>CONTROL_FOR</code> as{' '}
            <code>Record&lt;Kind, ComponentName&gt;</code> so adding a field kind fails the build until you map it.
            A runtime <code>switch</code> with a default silently renders the wrong control.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
