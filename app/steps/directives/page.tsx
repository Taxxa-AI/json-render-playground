import { DirectiveLab } from '@/components/lab/directive-lab';
import { Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="directives"
      lab={<DirectiveLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        The eight built-in <code>$</code>-keys are fixed; the expression language is not. The lab assembles the{' '}
        <code>defineDirective</code> call from whatever you type and shows it as source you can paste into a file.
      </p>

      <Facts
        rows={[
          { k: <code key="a">$computed</code>, v: 'A flat call with named args. No schema, invisible to the prompt. One-off app logic.' },
          { k: 'a directive', v: 'Its own key, a Zod schema, and a description. A vocabulary item specs across your product reuse — formatting, i18n, units.' },
          { k: 'name + schema + description', v: <>Only <code key="s1">name</code> and <code key="s2">resolve</code> do anything at runtime. <code key="s3">schema</code> and <code key="s4">description</code> are prompt metadata.</> },
          { k: 'resolution order', v: <>All built-ins first, then <code key="b">findDirective</code> over your registry, then literal passthrough.</> },
          {
            k: 'the eight built-ins',
            v: (
              <>
                <code key="c">$state</code>, <code key="d">$item</code>, <code key="e">$index</code>,{' '}
                <code key="f">$bindState</code>, <code key="g">$bindItem</code>, <code key="h">$cond</code>,{' '}
                <code key="i">$computed</code>, <code key="j">$template</code>. These names are reserved.
              </>
            ),
          },
          {
            k: 'collisions',
            v: (
              <>
                <code key="k">defineDirective</code> throws at registration — &ldquo;conflicts with a built-in
                prop expression key&rdquo; — and separately if the name does not start with <code key="l">$</code>.
              </>
            ),
          },
          { k: 'where they work', v: <>Anywhere props resolve — including action <code key="m">params</code>, <code key="n">$cond</code> branches and <code key="o">$computed</code> args.</> },
          { k: 'registering', v: <>An array on <code key="p">JSONUIProvider</code> (or <code key="q">createRenderer</code>), converted to a Map internally by <code key="r">createDirectiveRegistry</code>.</> },
        ]}
      />

      <Gotchas>
        <Gotcha>An unregistered directive is <strong>not</strong> <code>undefined</code>. It falls through as a literal
            object with sub-expressions already resolved, so your component gets{' '}
            <code>{'{ $money: 3480.5, currency: "EUR" }'}</code> and React throws. Worse than a blank, and the
            reason this lab starts with everything registered.</Gotcha>
        <Gotcha>Error boundaries do not catch during SSR, so a spec that throws on the server takes out the whole
            response — boundary or not. The per-component guard from <StepRef slug="registry" /> only saves you
            after hydration.</Gotcha>
        <Gotcha>A resolver that reads <code>value.$money</code> directly gets the raw expression object, not a
            number. Composition is opt-in: you only get it by calling <code>resolvePropValue</code> on your own
            sub-values.</Gotcha>
        <Gotcha><strong>The schema never runs.</strong> <code>resolvePropValue</code> calls{' '}
            <code>directive.resolve(value, ctx)</code> directly — it does not parse first. The schema exists so{' '}
            <code>catalog.prompt()</code> can print the key under <code>CUSTOM DYNAMIC VALUES</code>; at runtime it
            guards nothing. Your resolver receives whatever the spec said, which is why a bad state path arrives
            as <code>NaN</code> rather than an error. Validate inside <code>resolve</code> if you need it.</Gotcha>
        <Gotcha><strong>Two registered directive keys on one object throws.</strong>{' '}
            <code>findDirective</code> scans the whole registry and raises{' '}
            <code>Ambiguous directive</code> if more than one matches — so{' '}
            <code>{'{ "$money": 10, "$join": [] }'}</code> is a render-time error, not a precedence rule.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
