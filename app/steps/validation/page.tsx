import { ValidationLab } from '@/components/lab/validation-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="validation"
      lab={<ValidationLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        Validation has <strong>no field in the spec schema</strong>. Checks travel as a prop; the component
        registers them. Add three, then find out what <code>validateForm</code> will not do.
      </p>

      <Code lang="text" title="the fourteen built-in checks">{`required   email      url          numeric
minLength  maxLength  min          max        pattern
matches    equalTo    lessThan     greaterThan      <- cross-field
requiredIf                                          <- cross-field`}</Code>

      <Code lang="json" title="a cross-field check">{`{ "type": "matches",
  "args": { "other": { "$state": "/form/password" } },
  "message": "Passwords do not match" }`}</Code>

      <Facts
        rows={[
          { k: 'who registers', v: <>The component, via <code key="a">useFieldValidation(path, config)</code>. A control that never calls it is invisible to <code key="b">validateForm</code>.</> },
          { k: 'keyed by', v: 'State path. An unbound control needs a synthetic key or it collides with every other unbound control.' },
          { k: 'cross-field args', v: <>A <code key="c">$state</code> expression, resolved against the live model at validation time.</> },
          { k: 'TypeScript', v: <><code key="d">check.required()</code>, <code key="e">check.matches(path)</code>, <code key="f">check.greaterThan(path)</code>, <code key="g">check.requiredIf(path)</code></> },
          { k: 'custom', v: <><code key="h">validationFunctions</code> on the provider — <StepRef key="i" slug="build-check" />.</> },
        ]}
      />

      <Gotchas>
        <Gotcha>
          <strong><code>validateForm</code> reports, it does not block.</strong> It writes{' '}
          <code>{'{ valid, errors }'}</code> to a path and returns. The next action in the array still runs and
          your submit handler still fires. It fails open.
        </Gotcha>
        <Gotcha>
          An unknown check type never runs and is reported as <strong>valid</strong> — a field naming{' '}
          <code>&quot;iban&quot;</code> you never registered validates clean forever. That is exactly the check a
          model is most likely to invent.
        </Gotcha>
        <Gotcha>
          A hidden field is an unmounted field, so it never registers and <code>validateForm</code> cannot see it.
          Conditional form sections silently shrink what gets validated — <StepRef slug="conditions" />.
        </Gotcha>
        <Gotcha>
          None of this is a security boundary. Client-side checks, in a spec the client can edit, against state
          the client controls. Re-validate on the server. Doubly so when a model authored the rules.
        </Gotcha>
      </Gotchas>
    </StepPage>
  );
}
