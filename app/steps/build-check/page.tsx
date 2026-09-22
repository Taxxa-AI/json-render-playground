import { BuildCheckLab } from '@/components/lab/build-check-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="build-check"
      lab={<BuildCheckLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        Two extension points that are not components, and one shared idea: a spec names a string, you supply the
        function. Both are looked up at runtime, and both fail quietly when you forget — an unknown check passes
        the field forever, an unknown handler does nothing at all. Register each one below, then take it away and
        watch.
      </p>

      <Code lang="tsx" title="the provider is where both get registered">{`<JSONUIProvider
  registry={registry}
  store={store}

  // (value, args?) => boolean, by name. A spec's checks: [{ type: 'iban' }]
  // finds it here. Unregistered = the field validates clean, forever.
  validationFunctions={{
    iban: (value) => /^IE\\d{2}[A-Z]{4}\\d{14}$/.test(String(value).replace(/\\s+/g, '')),
  }}

  // Action handlers. params arrive RESOLVED; the dispatcher AWAITS these,
  // then runs onSuccess or onError depending on resolve vs throw.
  handlers={{
    archiveInvoice: async (params) => {
      const res = await fetch(\`/api/invoices/\${params.id}/archive\`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());   // -> onError
      return res.json();                                 // -> onSuccess
    },
  }}
>`}</Code>

      <Code lang="json" title="and the spec side of the same two things">{`// a field's checks travel as an ordinary PROP, not a spec-level field
{ "type": "TextInput",
  "props": { "label": "IBAN",
             "value": { "$bindState": "/form/iban" },
             "checks": [{ "type": "iban", "args": null, "message": "Not an IBAN" }] },
  "children": [] }

// the binding that drives the handler
{ "action": "archiveInvoice",
  "params":  { "id": { "$state": "/selected" } },
  "confirm": { "title": "Archive this invoice?", "variant": "danger" },
  "onSuccess": { "set": { "/status": "archived" } },
  "onError":   { "action": "notify", "params": { "message": "Archive failed." } } }`}</Code>

      <Facts
        rows={[
          {
            k: <code key="a">ValidationFunction</code>,
            v: <><code key="b">(value: unknown, args?: Record&lt;string, unknown&gt;) =&gt; boolean</code>. Args come from the check&rsquo;s <code key="c">args</code> object.</>,
          },
          {
            k: 'built-in checks',
            v: 'required, email, minLength, maxLength, pattern, min, max, numeric, url, matches, equalTo, lessThan, greaterThan, requiredIf. Yours are merged on top.',
          },
          {
            k: 'who runs them',
            v: <>The component, by calling <code key="d">useFieldValidation(path, config)</code>. A control that never registers is invisible to <code key="e">validateForm</code> — see <StepRef slug="validation" />.</>,
          },
          {
            k: <code key="f">validateForm</code>,
            v: <>A built-in action. Validates every registered field and writes <code key="g">{'{ valid, errors }'}</code> to <code key="h">params.statePath</code> (default <code key="i">/formValidation</code>).</>,
          },
          {
            k: 'handler signature',
            v: <>On the provider: <code key="j">(params) =&gt; Promise&lt;unknown&gt;</code>. In <code key="k">defineRegistry</code>: <code key="l">(params, setState, state) =&gt; Promise&lt;void&gt;</code>.</>,
          },
          {
            k: <code key="m">onSuccess</code> ,
            v: <>Runs when the promise resolves. Either <code key="n">{'{ set: { "/path": value } }'}</code> or another <code key="o">{'{ action, params }'}</code> binding.</>,
          },
          {
            k: <code key="p">onError</code>,
            v: 'Runs when it rejects. Same two shapes. The thrown error itself is not passed to the branch — put the message in state yourself if you need it.',
          },
          {
            k: <code key="q">executeAction</code>,
            v: <>From <code key="r">defineRegistry</code>. Runs a registry action imperatively, for work outside the React tree such as loading initial data.</>,
          },
        ]}
      />

      <Gotchas>
        <Gotcha>
          <strong>An unknown validation function fails open.</strong> The check is reported <code>valid: true</code>
          , the form submits, and the only trace is a <code>console.warn</code> reading &ldquo;Unknown validation
          function: iban&rdquo;. A typo in a model-generated <code>checks</code> array disables the rule silently.
        </Gotcha>
        <Gotcha>
          <strong>Resolving is success, whatever you return.</strong> To reach <code>onError</code> you must throw
          or reject — returning <code>false</code> or <code>{'{ ok: false }'}</code> still runs{' '}
          <code>onSuccess</code>.
        </Gotcha>
        <Gotcha>
          <strong>Handlers must be async.</strong> <code>ActionFn</code> returns <code>Promise&lt;void&gt;</code>,
          so a plain <code>{'() => {}'}</code> fails to compile. That is on purpose: the dispatcher has to await
          something before choosing a branch.
        </Gotcha>
        <Gotcha>
          <strong>Built-in actions ignore confirm, onSuccess and onError.</strong>{' '}
          <code>{'{ "action": "removeState", "confirm": {…} }'}</code> deletes with no dialog. Route confirmed
          deletes through a custom action — see <StepRef slug="actions" />.
        </Gotcha>
        <Gotcha>
          <strong><code>executeAction</code> bypasses the dispatcher.</strong> No confirm, no{' '}
          <code>onSuccess</code>/<code>onError</code>, and no <code>registerActionObserver</code> row. An unknown
          name only <code>console.warn</code>s and resolves.
        </Gotcha>
        <Gotcha>
          <strong>
            <code>defineRegistry(...).handlers</code> no-ops when <code>getSetState()</code> returns undefined.
          </strong>{' '}
          It returns a getter-based factory precisely so handlers read fresh refs; wire it before first render or
          the first dispatch vanishes.
        </Gotcha>
      </Gotchas>
    </StepPage>
  );
}
